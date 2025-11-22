
import { GoogleGenAI, Type } from "@google/genai";
import { VerificationResult, DistractionType } from '../types';

// Get API key from environment (Vite uses import.meta.env, but we also define process.env in vite.config)
const apiKey = (import.meta.env?.GEMINI_API_KEY || 
                import.meta.env?.VITE_GEMINI_API_KEY || 
                (typeof process !== 'undefined' && process.env?.GEMINI_API_KEY) ||
                (typeof process !== 'undefined' && process.env?.API_KEY) ||
                '').trim();

if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY not found in environment variables');
}

const ai = new GoogleGenAI({ apiKey });

export const verifyWork = async (workContent: string): Promise<VerificationResult> => {
  if (!workContent || workContent.length < 10) {
    return {
      verified: false,
      score: 0,
      comment: "Not enough work produced to verify.",
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `
        You are the referee of a 'Productivity Battle Royale'. 
        Analyze the following text which represents the work a user did during a 25-minute deep work session.
        
        Determine a 'Productivity Score' (0-100) based on:
        1. Coherence
        2. Substance (is it just gibberish or actual content?)
        3. Completeness relative to a short sprint.

        Work Content:
        """
        ${workContent}
        """
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            verified: {
              type: Type.BOOLEAN,
              description: "True if the text looks like legitimate work, False if gibberish or spam."
            },
            score: {
              type: Type.INTEGER,
              description: "A score from 0 to 100 based on quality and quantity."
            },
            comment: {
              type: Type.STRING,
              description: "A short, witty comment about their performance."
            }
          },
          required: ["verified", "score", "comment"]
        }
      }
    });

    const jsonStr = response.text;
    if (!jsonStr) throw new Error("Empty response from Gemini");
    
    return JSON.parse(jsonStr) as VerificationResult;

  } catch (error) {
    console.error("Gemini Verification Error:", error);
    return {
      verified: true,
      score: 75,
      comment: "Verification system bypassed due to interference. Points awarded by default.",
    };
  }
};

export const analyzeUserStatus = async (base64Image: string): Promise<DistractionType> => {
  try {
    const cleanBase64 = base64Image.split(',')[1] || base64Image;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: cleanBase64
            }
          },
          {
            text: `
            You are analyzing a webcam frame for a productivity monitoring app. Your job is to detect specific user behaviors.

            **DETECTION RULES (in priority order):**

            1. **NO_FACE**: Return this ONLY if:
               - No human face is visible
               - The chair/desk is empty
               - The room is too dark to see a face
               - Face is severely cropped or obscured

            2. **TALKING**: Return this if you see ANY of these:
               - Mouth is OPEN (lips parted, visible gap between lips)
               - Mouth is MOVING (lips forming words, speaking motion)
               - User appears to be speaking (even if looking at screen)
               - Head turned as if talking to someone
               - Clear speaking/verbal communication indicators
               **BE AGGRESSIVE**: If mouth is open, assume TALKING unless clearly eating.

            3. **EYES_CLOSED**: Return this if:
               - Eyes are completely closed (eyelids covering eyes)
               - Eyes are mostly closed (only slits visible)
               - User appears to be sleeping or resting with eyes shut
               **IMPORTANT**: Do NOT return this if user is just looking down at keyboard - only if eyes are actually closed.

            4. **PHONE**: User is holding or looking at a phone/device.

            5. **EATING**: User is eating/drinking (food visible, hand bringing food to mouth).

            6. **FOCUS**: User is present, eyes open, not talking, not on phone, not eating - actively working.

            **CRITICAL INSTRUCTIONS:**
            - Be CONFIDENT in your detections - if you see mouth open, return TALKING
            - If you see eyes closed, return EYES_CLOSED
            - Don't be overly conservative - detect what you actually see
            - Return the MOST DISTRACTING state if multiple apply (TALKING > EATING > PHONE > EYES_CLOSED > FOCUS)

            Analyze the image and return the appropriate status.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faceVisible: {
              type: Type.BOOLEAN,
              description: "Is a human face clearly visible in the frame?"
            },
            headOrientation: {
              type: Type.STRING,
              enum: ["FACING_SCREEN", "LOOKING_DOWN", "LOOKING_AWAY", "ABSENT"],
              description: "The general direction of the head."
            },
            status: {
              type: Type.STRING,
              enum: ['PHONE', 'EATING', 'EYES_CLOSED', 'TALKING', 'NO_FACE', 'FOCUS'],
              description: "The final classification. Be confident: if mouth is open = TALKING, if eyes are closed = EYES_CLOSED, if face not visible = NO_FACE, otherwise FOCUS."
            }
          },
          required: ["faceVisible", "headOrientation", "status"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    // Debug logging
    console.log('🔍 Gemini Detection Result:', {
      faceVisible: result.faceVisible,
      headOrientation: result.headOrientation,
      status: result.status
    });
    
    // 1. Strict Enforcement of NO_FACE
    if (result.faceVisible === false || result.headOrientation === 'ABSENT' || result.status === 'NO_FACE') {
      console.log('❌ NO_FACE detected');
      return 'NO_FACE';
    }

    // 2. Fix "Looking Down = Eyes Closed" false positive
    // If the model thinks eyes are closed but the user is looking down (working), override to FOCUS.
    if (result.status === 'EYES_CLOSED' && result.headOrientation === 'LOOKING_DOWN') {
      console.log('👀 Eyes closed but looking down - treating as FOCUS (working)');
      return 'NONE'; // Maps to FOCUS
    }

    // 3. Map API status to App DistractionType
    const status = result.status as DistractionType | 'FOCUS';
    
    if (status === 'FOCUS') {
      return 'NONE';
    }
    
    // Log important detections with emphasis
    if (status === 'TALKING') {
      console.log('🎤🎤🎤 TALKING DETECTED BY GEMINI 🎤🎤🎤');
    } else if (status === 'EYES_CLOSED') {
      console.log('😴😴😴 EYES_CLOSED DETECTED BY GEMINI 😴😴😴');
    } else {
      console.log(`📊 Detected: ${status}`);
    }
    
    return status as DistractionType;

  } catch (error) {
    console.warn("Vision check failed, assuming focus:", error);
    return 'NONE';
  }
};

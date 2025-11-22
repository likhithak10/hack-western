
import { GoogleGenAI, Type } from "@google/genai";
import { VerificationResult, DistractionType } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
            Analyze this webcam frame for a "Focus Royale" game to detect user presence and attention.
            
            **PRIORITY 1: PRESENCE DETECTION (NO_FACE)**
            - **CRITICAL**: If the chair is empty, or the user has walked away, or the room is too dark to see a face, you MUST return 'NO_FACE'.
            - If you only see a background, wall, or furniture -> 'NO_FACE'.
            - If the face is severely cropped or not visible -> 'NO_FACE'.
            
            **PRIORITY 2: HEAD ORIENTATION**
            - **LOOKING_DOWN**: User is looking down at keyboard/notebook. This is productive work.
            - **FACING_SCREEN**: User is looking at the monitor.
            - **ABSENT**: No user found.

            **PRIORITY 3: STATE CLASSIFICATION**
            - **FOCUS**: User is present and looking at screen OR looking down working.
            - **EYES_CLOSED**: User is asleep or resting eyes (head usually back or upright). Do NOT trigger this if user is looking down/typing.
            - **PHONE**: User is holding a phone or looking at a phone.
            - **TALKING**: User is engaging in conversation.
            - **EATING**: User is eating/drinking.

            Return a JSON object based on these rules.
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
              description: "The final classification of the user's behavior."
            }
          },
          required: ["faceVisible", "headOrientation", "status"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");
    
    // 1. Strict Enforcement of NO_FACE
    if (result.faceVisible === false || result.headOrientation === 'ABSENT' || result.status === 'NO_FACE') {
      return 'NO_FACE';
    }

    // 2. Fix "Looking Down = Eyes Closed" false positive
    // If the model thinks eyes are closed but the user is looking down (working), override to FOCUS.
    if (result.status === 'EYES_CLOSED' && result.headOrientation === 'LOOKING_DOWN') {
      return 'NONE'; // Maps to FOCUS
    }

    // 3. Map API status to App DistractionType
    const status = result.status as DistractionType | 'FOCUS';
    if (status === 'FOCUS') return 'NONE';
    
    return status as DistractionType;

  } catch (error) {
    console.warn("Vision check failed, assuming focus:", error);
    return 'NONE';
  }
};

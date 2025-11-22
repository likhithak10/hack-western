import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { IDL } from '../idl/focus_royale';
import { WalletContextState } from '@solana/wallet-adapter-react';

// Program ID - Update this after deployment
export const PROGRAM_ID = new PublicKey('NativeLoader1111111111111111111111111111111');

// RPC Endpoint - Using Devnet
const RPC_ENDPOINT = 'https://api.devnet.solana.com';
// For local testing: 'http://127.0.0.1:8899'

export interface EscrowAccount {
  user: PublicKey;
  stakeAmount: BN;
  focusScore: BN;
  completed: boolean;
  bump: number;
}

/**
 * Get connection to Solana network
 */
export const getConnection = (): Connection => {
  return new Connection(RPC_ENDPOINT, 'confirmed');
};

/**
 * Get Anchor provider from wallet
 */
export const getProvider = (wallet: WalletContextState): AnchorProvider | null => {
  if (!wallet.publicKey || !wallet.signTransaction) {
    return null;
  }

  const connection = getConnection();
  const walletAdapter: Wallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction.bind(wallet),
    signAllTransactions: wallet.signAllTransactions?.bind(wallet) || (async (txs) => {
      const signed = [];
      for (const tx of txs) {
        signed.push(await wallet.signTransaction!(tx));
      }
      return signed;
    }),
  };

  return new AnchorProvider(connection, walletAdapter, {
    commitment: 'confirmed',
  });
};

/**
 * Get Anchor program instance
 */
export const getProgram = (wallet: WalletContextState): Program | null => {
  const provider = getProvider(wallet);
  if (!provider) return null;

  return new Program(IDL, PROGRAM_ID, provider);
};

/**
 * Derive Escrow PDA for a user
 * PDA seeds: ["escrow", user_pubkey]
 */
export const getEscrowPDA = async (userPubkey: PublicKey): Promise<[PublicKey, number]> => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), userPubkey.toBuffer()],
    PROGRAM_ID
  );
};

/**
 * Derive Penalty Pool PDA
 * PDA seeds: ["penalty_pool"]
 */
export const getPenaltyPoolPDA = async (): Promise<[PublicKey, number]> => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('penalty_pool')],
    PROGRAM_ID
  );
};

/**
 * Initialize escrow account for a user
 */
export const initializeEscrow = async (
  wallet: WalletContextState,
  stakeAmount: number
): Promise<string> => {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(wallet);
  if (!program) {
    throw new Error('Failed to get program');
  }

  const [escrowPDA] = await getEscrowPDA(wallet.publicKey);
  const stakeAmountBN = new BN(stakeAmount);

  try {
    const tx = await program.methods
      .initializeEscrow(stakeAmountBN)
      .accounts({
        escrow: escrowPDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Initialize escrow error:', error);
    throw new Error(error.message || 'Failed to initialize escrow');
  }
};

/**
 * Deposit SOL stake into escrow
 */
export const depositStake = async (
  wallet: WalletContextState,
  amount: number
): Promise<string> => {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(wallet);
  if (!program) {
    throw new Error('Failed to get program');
  }

  const [escrowPDA] = await getEscrowPDA(wallet.publicKey);
  const amountBN = new BN(amount);

  try {
    const tx = await program.methods
      .depositStake(amountBN)
      .accounts({
        escrow: escrowPDA,
        user: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Deposit stake error:', error);
    throw new Error(error.message || 'Failed to deposit stake');
  }
};

/**
 * Update focus score for user's session
 */
export const updateFocusScore = async (
  wallet: WalletContextState,
  focusScore: number
): Promise<string> => {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(wallet);
  if (!program) {
    throw new Error('Failed to get program');
  }

  const [escrowPDA] = await getEscrowPDA(wallet.publicKey);
  const scoreBN = new BN(Math.floor(focusScore));

  try {
    const tx = await program.methods
      .updateFocusScore(scoreBN)
      .accounts({
        escrow: escrowPDA,
        user: wallet.publicKey,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Update focus score error:', error);
    throw new Error(error.message || 'Failed to update focus score');
  }
};

/**
 * Complete session - marks escrow as completed
 */
export const completeSession = async (
  wallet: WalletContextState
): Promise<string> => {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(wallet);
  if (!program) {
    throw new Error('Failed to get program');
  }

  const [escrowPDA] = await getEscrowPDA(wallet.publicKey);

  try {
    const tx = await program.methods
      .completeSession()
      .accounts({
        escrow: escrowPDA,
        user: wallet.publicKey,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Complete session error:', error);
    throw new Error(error.message || 'Failed to complete session');
  }
};

/**
 * Claim reward - winner gets stake back + bonus
 */
export const claimReward = async (
  wallet: WalletContextState
): Promise<string> => {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(wallet);
  if (!program) {
    throw new Error('Failed to get program');
  }

  const [escrowPDA] = await getEscrowPDA(wallet.publicKey);
  const [penaltyPoolPDA] = await getPenaltyPoolPDA();

  try {
    const tx = await program.methods
      .claimReward()
      .accounts({
        escrow: escrowPDA,
        user: wallet.publicKey,
        penaltyPool: penaltyPoolPDA,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Claim reward error:', error);
    throw new Error(error.message || 'Failed to claim reward');
  }
};

/**
 * Forfeit stake - sends SOL to penalty pool
 */
export const forfeitStake = async (
  wallet: WalletContextState
): Promise<string> => {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const program = getProgram(wallet);
  if (!program) {
    throw new Error('Failed to get program');
  }

  const [escrowPDA] = await getEscrowPDA(wallet.publicKey);
  const [penaltyPoolPDA] = await getPenaltyPoolPDA();

  try {
    const tx = await program.methods
      .forfeitStake()
      .accounts({
        escrow: escrowPDA,
        penaltyPool: penaltyPoolPDA,
        user: wallet.publicKey,
      })
      .rpc();

    return tx;
  } catch (error: any) {
    console.error('Forfeit stake error:', error);
    throw new Error(error.message || 'Failed to forfeit stake');
  }
};

/**
 * Fetch escrow account data
 */
export const fetchEscrowAccount = async (
  wallet: WalletContextState
): Promise<EscrowAccount | null> => {
  // Wrap everything in a promise to catch any unhandled rejections
  return new Promise(async (resolve) => {
    try {
      if (!wallet.publicKey) {
        resolve(null);
        return;
      }

      const program = getProgram(wallet);
      if (!program) {
        resolve(null);
        return;
      }

      // Check if PROGRAM_ID is still the placeholder - if so, program isn't deployed
      const PLACEHOLDER_ID = 'NativeLoader1111111111111111111111111111111';
      if (PROGRAM_ID.toString() === PLACEHOLDER_ID) {
        // Program not deployed yet - return null
        resolve(null);
        return;
      }

      const [escrowPDA] = await getEscrowPDA(wallet.publicKey);
      
      // Check if account exists and is owned by the program
      const connection = getConnection();
      let accountInfo;
      try {
        accountInfo = await connection.getAccountInfo(escrowPDA);
      } catch (e) {
        resolve(null);
        return;
      }
      
      if (!accountInfo) {
        // Account doesn't exist yet
        resolve(null);
        return;
      }

      // Verify the account is owned by our program
      try {
        if (!accountInfo.owner.equals(PROGRAM_ID)) {
          // Account exists but is not owned by our program
          resolve(null);
          return;
        }
      } catch (e) {
        resolve(null);
        return;
      }

      // Check account data size before deserialization
      // Escrow account should be: 8 (discriminator) + 32 (user) + 8 (stakeAmount) + 8 (focusScore) + 1 (completed) + 1 (bump) = 58 bytes
      const expectedSize = 8 + 32 + 8 + 8 + 1 + 1; // 58 bytes
      if (!accountInfo.data || accountInfo.data.length < expectedSize) {
        // Account data is too small - not a valid escrow account
        resolve(null);
        return;
      }

      // Check the account discriminator before attempting to decode
      // This prevents Anchor from trying to decode invalid account data
      const accountData = accountInfo.data;
      let discriminatorValid = false;
      try {
        // Get the expected discriminator for the Escrow account
        const discriminator = program.account.escrow.coder.accounts.discriminator('escrow');
        const accountDiscriminator = accountData.slice(0, 8);
        
        // Compare discriminators - if they don't match, this isn't an escrow account
        discriminatorValid = Buffer.from(discriminator).equals(Buffer.from(accountDiscriminator));
        if (!discriminatorValid) {
          // Account exists but doesn't have the correct discriminator
          resolve(null);
          return;
        }
      } catch (discriminatorError: any) {
        // Failed to get discriminator or compare - account is likely invalid
        resolve(null);
        return;
      }

      // Only try to decode if discriminator is valid
      if (!discriminatorValid) {
        resolve(null);
        return;
      }

      // Now try to decode the account - we know it has the correct discriminator
      // Use a separate promise to catch any errors during decode
      let escrowAccount;
      try {
        // Use setTimeout to ensure this runs in a new tick and errors can be caught
        escrowAccount = await Promise.resolve(
          program.account.escrow.coder.accounts.decode('escrow', accountData)
        ).catch(() => null);
        
        if (!escrowAccount) {
          resolve(null);
          return;
        }
      } catch (decodeError: any) {
        // Decoding failed - this catches BN deserialization errors
        resolve(null);
        return;
      }
      
      // Validate that all required fields exist and are valid
      try {
        if (!escrowAccount || 
            escrowAccount.stakeAmount === undefined || 
            escrowAccount.stakeAmount === null ||
            escrowAccount.focusScore === undefined ||
            escrowAccount.focusScore === null) {
          // Account exists but has invalid data
          resolve(null);
          return;
        }
        
        // Try to access BN methods to verify they're valid BN objects
        // If this throws, the BN objects are invalid
        if (typeof escrowAccount.stakeAmount.toNumber !== 'function' ||
            typeof escrowAccount.focusScore.toNumber !== 'function') {
          resolve(null);
          return;
        }
      } catch (validationError: any) {
        // Validation failed - return null
        resolve(null);
        return;
      }
      
      try {
        resolve({
          user: escrowAccount.user,
          stakeAmount: escrowAccount.stakeAmount,
          focusScore: escrowAccount.focusScore,
          completed: escrowAccount.completed ?? false,
          bump: escrowAccount.bump ?? 0,
        });
      } catch (returnError: any) {
        // Failed to construct return object
        resolve(null);
      }
    } catch (error: any) {
      // Catch any other errors (network, etc.) and return null
      // Don't log these as they're expected for new users or network issues
      resolve(null);
    }
  });
};

/**
 * Get user's SOL balance
 */
export const getBalance = async (wallet: WalletContextState): Promise<number> => {
  if (!wallet.publicKey) {
    return 0;
  }

  const connection = getConnection();
  const balance = await connection.getBalance(wallet.publicKey);
  return balance / 1e9; // Convert lamports to SOL
};


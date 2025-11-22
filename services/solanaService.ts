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
  if (!wallet.publicKey) {
    return null;
  }

  const program = getProgram(wallet);
  if (!program) {
    return null;
  }

  try {
    const [escrowPDA] = await getEscrowPDA(wallet.publicKey);
    const escrowAccount = await program.account.escrow.fetch(escrowPDA);
    
    return {
      user: escrowAccount.user,
      stakeAmount: escrowAccount.stakeAmount,
      focusScore: escrowAccount.focusScore,
      completed: escrowAccount.completed,
      bump: escrowAccount.bump,
    };
  } catch (error) {
    // Account doesn't exist yet
    return null;
  }
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


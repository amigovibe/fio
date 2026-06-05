/**
 * walletConnectors.ts — connect the CORRECT wallet type per network.
 *
 *   • EVM (Ethereum/Base/Polygon/Sepolia) → injected wallet via wagmi (handled in the component)
 *   • Solana                              → Phantom / Solflare (window.solana / window.solflare)
 *   • Bitcoin                             → Unisat (window.unisat)
 *
 * Dependency-free + SSR-safe (all access guarded by `typeof window`). For broader
 * wallet coverage (more Solana wallets, Xverse/Leather for BTC, mobile deep-links)
 * this can be swapped for @solana/wallet-adapter + sats-connect later.
 */

import { ChainId } from './ethereum';

export type ChainFamily = 'evm' | 'solana' | 'bitcoin';

/** Which wallet family a chain belongs to. */
export function getChainFamily(chain: ChainId): ChainFamily {
  if (chain === 'solana') return 'solana';
  if (chain === 'bitcoin') return 'bitcoin';
  return 'evm';
}

export class WalletConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletConnectError';
  }
}

interface SolanaProvider {
  connect: () => Promise<{ publicKey?: { toString(): string } }>;
  publicKey?: { toString(): string } | null;
}
interface UnisatProvider {
  requestAccounts: () => Promise<string[]>;
}

function getWindow(): Record<string, any> | undefined {
  return typeof window !== 'undefined' ? (window as unknown as Record<string, any>) : undefined;
}

function isRejection(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return m.includes('reject') || m.includes('denied') || m.includes('cancel');
}

/** Connect a Solana wallet (Phantom / Solflare). Returns the base58 address. */
export async function connectSolanaWallet(): Promise<string> {
  const w = getWindow();
  const provider: SolanaProvider | undefined = w?.phantom?.solana || w?.solana || w?.solflare;
  if (!provider || typeof provider.connect !== 'function') {
    throw new WalletConnectError('No Solana wallet found. Install Phantom or Solflare — or paste your Solana address above to scan it.');
  }
  try {
    const res = await provider.connect();
    const address = res?.publicKey?.toString() ?? provider.publicKey?.toString();
    if (!address) throw new WalletConnectError('Could not read the Solana wallet address.');
    return address;
  } catch (err) {
    if (err instanceof WalletConnectError) throw err;
    throw new WalletConnectError(isRejection(err) ? 'You rejected the Solana wallet connection.' : 'Failed to connect the Solana wallet.');
  }
}

/** Connect a Bitcoin wallet (Unisat). Returns the address. */
export async function connectBitcoinWallet(): Promise<string> {
  const w = getWindow();
  const unisat: UnisatProvider | undefined = w?.unisat;
  if (!unisat || typeof unisat.requestAccounts !== 'function') {
    throw new WalletConnectError('No Bitcoin wallet found. Install Unisat — or paste your Bitcoin address above to scan it.');
  }
  try {
    const accounts = await unisat.requestAccounts();
    if (!accounts?.[0]) throw new WalletConnectError('Could not read the Bitcoin wallet address.');
    return accounts[0];
  } catch (err) {
    if (err instanceof WalletConnectError) throw err;
    throw new WalletConnectError(isRejection(err) ? 'You rejected the Bitcoin wallet connection.' : 'Failed to connect the Bitcoin wallet.');
  }
}

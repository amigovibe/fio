/**
 * walletConnectors.ts — connect the CORRECT wallet type per network, with a
 * per-wallet picker.
 *
 *   • EVM (Ethereum/Base/Polygon/Sepolia) → injected wallets via wagmi (component)
 *   • Solana                              → Phantom / Solflare
 *   • Bitcoin                             → Unisat / Xverse
 *
 * Dependency-free + SSR-safe (all access guarded by `typeof window`).
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

/** A selectable wallet in the picker. */
export interface WalletOption {
  id: string;
  name: string;
  installUrl: string;
  isInstalled: () => boolean;
  connect: () => Promise<string>; // resolves to the wallet address
}

interface SolanaProvider {
  connect: () => Promise<{ publicKey?: { toString(): string } }>;
  publicKey?: { toString(): string } | null;
}
interface XverseProvider {
  request: (method: string, params?: unknown) => Promise<any>;
}

function getWindow(): Record<string, any> | undefined {
  return typeof window !== 'undefined' ? (window as unknown as Record<string, any>) : undefined;
}
function isRejection(err: unknown): boolean {
  const m = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return m.includes('reject') || m.includes('denied') || m.includes('cancel');
}

async function connectSolana(provider: SolanaProvider | undefined, name: string): Promise<string> {
  if (!provider || typeof provider.connect !== 'function') throw new WalletConnectError(`${name} is not installed.`);
  try {
    const res = await provider.connect();
    const address = res?.publicKey?.toString() ?? provider.publicKey?.toString();
    if (!address) throw new WalletConnectError(`Could not read the ${name} address.`);
    return address;
  } catch (err) {
    if (err instanceof WalletConnectError) throw err;
    throw new WalletConnectError(isRejection(err) ? `You rejected the ${name} connection.` : `Failed to connect ${name}.`);
  }
}

async function connectUnisat(): Promise<string> {
  const unisat = getWindow()?.unisat;
  if (typeof unisat?.requestAccounts !== 'function') throw new WalletConnectError('Unisat is not installed.');
  try {
    const accounts: string[] = await unisat.requestAccounts();
    if (!accounts?.[0]) throw new WalletConnectError('Could not read the Unisat address.');
    return accounts[0];
  } catch (err) {
    if (err instanceof WalletConnectError) throw err;
    throw new WalletConnectError(isRejection(err) ? 'You rejected the Unisat connection.' : 'Failed to connect Unisat.');
  }
}

async function connectXverse(): Promise<string> {
  const provider: XverseProvider | undefined = getWindow()?.XverseProviders?.BitcoinProvider ?? getWindow()?.BitcoinProvider;
  if (typeof provider?.request !== 'function') throw new WalletConnectError('Xverse is not installed.');
  try {
    const res = await provider.request('getAccounts', { purposes: ['payment'], message: 'Connect your Bitcoin wallet to Fio' });
    const accounts = res?.result ?? res?.addresses ?? res; // shape varies across versions
    const account = Array.isArray(accounts)
      ? accounts.find((a: { purpose?: string }) => a?.purpose === 'payment') ?? accounts[0]
      : null;
    if (!account?.address) throw new WalletConnectError('Could not read the Xverse address.');
    return account.address;
  } catch (err) {
    if (err instanceof WalletConnectError) throw err;
    throw new WalletConnectError(isRejection(err) ? 'You rejected the Xverse connection.' : 'Failed to connect Xverse.');
  }
}

const SOLANA_WALLETS: WalletOption[] = [
  {
    id: 'phantom',
    name: 'Phantom',
    installUrl: 'https://phantom.app/download',
    isInstalled: () => !!(getWindow()?.phantom?.solana || getWindow()?.solana?.isPhantom),
    connect: () => connectSolana(getWindow()?.phantom?.solana ?? getWindow()?.solana, 'Phantom'),
  },
  {
    id: 'solflare',
    name: 'Solflare',
    installUrl: 'https://solflare.com/download',
    isInstalled: () => !!getWindow()?.solflare,
    connect: () => connectSolana(getWindow()?.solflare, 'Solflare'),
  },
];

const BITCOIN_WALLETS: WalletOption[] = [
  {
    id: 'unisat',
    name: 'Unisat',
    installUrl: 'https://unisat.io/download',
    isInstalled: () => typeof getWindow()?.unisat?.requestAccounts === 'function',
    connect: connectUnisat,
  },
  {
    id: 'xverse',
    name: 'Xverse',
    installUrl: 'https://www.xverse.app/download',
    isInstalled: () => !!(getWindow()?.XverseProviders?.BitcoinProvider || getWindow()?.BitcoinProvider),
    connect: connectXverse,
  },
];

/** Picker options for a non-EVM family (EVM is handled via wagmi connectors). */
export function getWalletOptions(family: ChainFamily): WalletOption[] {
  if (family === 'solana') return SOLANA_WALLETS;
  if (family === 'bitcoin') return BITCOIN_WALLETS;
  return [];
}

// ── Auto-connect helpers (first installed wallet) — kept for fallback callers ──
export async function connectSolanaWallet(): Promise<string> {
  const opt = SOLANA_WALLETS.find((w) => w.isInstalled());
  if (!opt) throw new WalletConnectError('No Solana wallet found. Install Phantom or Solflare — or paste your Solana address above to scan it.');
  return opt.connect();
}
export async function connectBitcoinWallet(): Promise<string> {
  const opt = BITCOIN_WALLETS.find((w) => w.isInstalled());
  if (!opt) throw new WalletConnectError('No Bitcoin wallet found. Install Unisat or Xverse — or paste your Bitcoin address above to scan it.');
  return opt.connect();
}

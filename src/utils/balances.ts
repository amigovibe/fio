/**
 * balances.ts — keyless, out-of-the-box wallet BALANCE fetching.
 *
 * Works natively with free PUBLIC endpoints (no API key required). Each network
 * has a primary endpoint plus backups, so a 429 / failure on one node falls
 * through to the next automatically.
 *
 * NOTE: this is distinct from the transaction-history scanner in `ethereum.ts`.
 * JSON-RPC nodes return *balances* (eth_getBalance / getBalance), not tx lists —
 * listing an address's transactions requires an indexer/explorer (Blockscout,
 * mempool.space, Helius), which the scanner already uses keyless.
 */

import { formatWei } from './ethereum';

export type BalanceNetwork = 'ethereum' | 'bsc' | 'polygon' | 'base' | 'sepolia' | 'solana' | 'bitcoin';

export interface WalletBalance {
  network: BalanceNetwork;
  address: string;
  raw: string; // smallest unit (wei / lamports / satoshis) as a base-10 string
  decimals: number;
  formatted: string; // human-readable amount, e.g. "1.2345"
  symbol: string; // ETH / BNB / POL / SOL / BTC
  source: string; // the endpoint that actually served the data
}

/** Error type that flags whether all nodes were rate-limited (for nice UI alerts). */
export class BalanceError extends Error {
  rateLimited: boolean;
  constructor(message: string, rateLimited = false) {
    super(message);
    this.name = 'BalanceError';
    this.rateLimited = rateLimited;
  }
}

// ── Default public endpoints (keyless). [0] is primary; the rest are backups. ──
const EVM_ENDPOINTS: Record<'ethereum' | 'bsc' | 'polygon' | 'base' | 'sepolia', string[]> = {
  ethereum: [
    'https://cloudflare-eth.com',
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com',
  ],
  bsc: [
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.defibit.io/',
    'https://bsc-rpc.publicnode.com',
  ],
  polygon: [
    'https://polygon-rpc.com',
    'https://polygon-bor-rpc.publicnode.com',
    'https://rpc.ankr.com/polygon',
  ],
  base: [
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
    'https://base.llamarpc.com',
  ],
  sepolia: [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://rpc.sepolia.org',
    'https://1rpc.io/sepolia',
  ],
};

// NOTE: rpc.ankr.com/solana now returns 403 without a key, so the official
// keyless endpoint is tried first; Ankr stays as a backup for when a key is set.
const SOLANA_ENDPOINTS = ['https://api.mainnet-beta.solana.com', 'https://rpc.ankr.com/solana'];

const BITCOIN_ENDPOINTS = ['https://blockstream.info/api', 'https://mempool.space/api'];

const NATIVE: Record<BalanceNetwork, { symbol: string; decimals: number }> = {
  ethereum: { symbol: 'ETH', decimals: 18 },
  bsc: { symbol: 'BNB', decimals: 18 },
  polygon: { symbol: 'POL', decimals: 18 },
  base: { symbol: 'ETH', decimals: 18 },
  sepolia: { symbol: 'ETH', decimals: 18 },
  solana: { symbol: 'SOL', decimals: 9 },
  bitcoin: { symbol: 'BTC', decimals: 8 },
};

/** fetch with a hard timeout (browser & Node both honour AbortController). */
async function timedFetch(url: string, init: RequestInit, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Try each endpoint in order; skip on 429/any error; throw once all are exhausted. */
async function withFallback<T>(
  endpoints: string[],
  attempt: (endpoint: string) => Promise<T>,
  label: string,
): Promise<T> {
  let rateLimited = false;
  for (const endpoint of endpoints) {
    try {
      return await attempt(endpoint);
    } catch (err) {
      if (err instanceof BalanceError && err.rateLimited) rateLimited = true;
      // fall through to the next backup endpoint
    }
  }
  throw new BalanceError(
    rateLimited
      ? `Every public ${label} node is rate-limited right now. Wait a few seconds and retry, or add your own endpoint in Settings.`
      : `Could not reach any ${label} endpoint. Check the address and your connection, then retry.`,
    rateLimited,
  );
}

// ── EVM: eth_getBalance over JSON-RPC ──
async function fetchEvmBalance(
  network: 'ethereum' | 'bsc' | 'polygon' | 'base' | 'sepolia',
  address: string,
  endpoints: string[],
): Promise<WalletBalance> {
  const meta = NATIVE[network];
  return withFallback(
    endpoints,
    async (endpoint) => {
      const res = await timedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
      });
      if (res.status === 429) throw new BalanceError(`${network} RPC rate-limited`, true);
      if (!res.ok) throw new BalanceError(`${network} RPC responded ${res.status}`);
      const data = await res.json();
      if (data.error) throw new BalanceError(data.error.message || `${network} RPC error`);
      const raw = BigInt(data.result as string).toString(); // hex wei → decimal string
      return { network, address, raw, decimals: meta.decimals, formatted: formatWei(raw, meta.decimals), symbol: meta.symbol, source: endpoint };
    },
    network,
  );
}

// ── Solana: getBalance over JSON-RPC ──
async function fetchSolanaBalance(address: string, endpoints: string[]): Promise<WalletBalance> {
  const meta = NATIVE.solana;
  return withFallback(
    endpoints,
    async (endpoint) => {
      const res = await timedFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
      });
      if (res.status === 429) throw new BalanceError('Solana RPC rate-limited', true);
      if (!res.ok) throw new BalanceError(`Solana RPC responded ${res.status}`);
      const data = await res.json();
      if (data.error) throw new BalanceError(data.error.message || 'Solana RPC error');
      const lamports = String(data.result?.value ?? 0);
      return { network: 'solana', address, raw: lamports, decimals: meta.decimals, formatted: formatWei(lamports, meta.decimals), symbol: meta.symbol, source: endpoint };
    },
    'Solana',
  );
}

// ── Bitcoin: Blockstream/Esplora REST. Balance = funded − spent (confirmed + mempool). ──
async function fetchBitcoinBalance(address: string, endpoints: string[]): Promise<WalletBalance> {
  const meta = NATIVE.bitcoin;
  return withFallback(
    endpoints,
    async (endpoint) => {
      const res = await timedFetch(`${endpoint}/address/${encodeURIComponent(address)}`, { method: 'GET' });
      if (res.status === 429) throw new BalanceError('Bitcoin API rate-limited', true);
      if (res.status === 400) throw new BalanceError('That does not look like a valid Bitcoin address.');
      if (!res.ok) throw new BalanceError(`Bitcoin API responded ${res.status}`);
      const data = await res.json();
      // Blockstream schema: { chain_stats: { funded_txo_sum, spent_txo_sum }, mempool_stats: {…} }
      const chain = data.chain_stats || {};
      const mem = data.mempool_stats || {};
      const confirmed = BigInt(chain.funded_txo_sum ?? 0) - BigInt(chain.spent_txo_sum ?? 0);
      const unconfirmed = BigInt(mem.funded_txo_sum ?? 0) - BigInt(mem.spent_txo_sum ?? 0);
      const sats = (confirmed + unconfirmed).toString();
      return { network: 'bitcoin', address, raw: sats, decimals: meta.decimals, formatted: formatWei(sats, meta.decimals), symbol: meta.symbol, source: endpoint };
    },
    'Bitcoin',
  );
}

/** Best-effort network family detection from an address's format. */
export function detectAddressType(address: string): 'evm' | 'solana' | 'bitcoin' | 'unknown' {
  const a = (address || '').trim();
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return 'evm';
  if (/^(bc1|[13])[a-zA-HJ-NP-Za-km-z0-9]{25,62}$/.test(a)) return 'bitcoin';
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return 'solana';
  return 'unknown';
}

/**
 * Fetch the native-asset balance for an address on a given network, using
 * keyless public endpoints by default. Pass `options.customRpc` to prefer your
 * own node/key (the public endpoints still act as a fallback).
 */
export async function getWalletBalance(
  address: string,
  network: BalanceNetwork,
  options: { customRpc?: string } = {},
): Promise<WalletBalance> {
  const addr = (address || '').trim();
  if (!addr) throw new BalanceError('No wallet address provided.');

  const withCustom = (defaults: string[]) => (options.customRpc ? [options.customRpc, ...defaults] : defaults);

  switch (network) {
    case 'ethereum':
    case 'bsc':
    case 'polygon':
    case 'base':
    case 'sepolia':
      return fetchEvmBalance(network, addr, withCustom(EVM_ENDPOINTS[network]));
    case 'solana':
      return fetchSolanaBalance(addr, withCustom(SOLANA_ENDPOINTS));
    case 'bitcoin':
      return fetchBitcoinBalance(addr, withCustom(BITCOIN_ENDPOINTS));
    default:
      throw new BalanceError(`Unsupported network: ${network}`);
  }
}

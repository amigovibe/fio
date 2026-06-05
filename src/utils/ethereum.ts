import { Transaction } from './types';

export type ChainId = 'ethereum' | 'base' | 'polygon' | 'sepolia' | 'solana' | 'bitcoin';

export interface ChainConfig {
  name: string;
  nativeCurrency: string;
  apiUrl: string;        // keyless block-explorer (Blockscout/Esplora) base URL
  explorerUrl: string;   // public explorer for the "verify" links / QR
  priceKey: string;
  defaultApiKey: string;
  chainId?: number;      // EVM chain id (also used for the Etherscan V2 multichain API)
}

export const CHAINS: Record<ChainId, ChainConfig> = {
  ethereum: {
    name: 'Ethereum Mainnet',
    nativeCurrency: 'ETH',
    apiUrl: 'https://eth.blockscout.com/api',
    explorerUrl: 'https://etherscan.io',
    priceKey: 'ethprice',
    defaultApiKey: '',
    chainId: 1,
  },
  base: {
    name: 'Base',
    nativeCurrency: 'ETH',
    apiUrl: 'https://base.blockscout.com/api',
    explorerUrl: 'https://basescan.org',
    priceKey: 'ethprice',
    defaultApiKey: '',
    chainId: 8453,
  },
  polygon: {
    name: 'Polygon',
    nativeCurrency: 'POL',
    apiUrl: 'https://polygon.blockscout.com/api',
    explorerUrl: 'https://polygonscan.com',
    priceKey: 'maticprice',
    defaultApiKey: '',
    chainId: 137,
  },
  sepolia: {
    name: 'Sepolia Testnet',
    nativeCurrency: 'ETH',
    apiUrl: 'https://eth-sepolia.blockscout.com/api',
    explorerUrl: 'https://sepolia.etherscan.io',
    priceKey: 'ethprice',
    defaultApiKey: '',
    chainId: 11155111,
  },
  solana: {
    name: 'Solana Mainnet',
    nativeCurrency: 'SOL',
    apiUrl: 'https://api.helius.xyz/v0/addresses',
    explorerUrl: 'https://solscan.io',
    priceKey: 'solprice',
    defaultApiKey: 'YourHeliusKey',
  },
  bitcoin: {
    name: 'Bitcoin Mainnet',
    nativeCurrency: 'BTC',
    apiUrl: 'https://mempool.space/api',
    explorerUrl: 'https://mempool.space',
    priceKey: 'btcprice',
    defaultApiKey: '',
  },
};

export const PRICE_FALLBACK = { ethereum: 3100.0, polygon: 0.72, solana: 150.0, bitcoin: 65000.0 };

// Formats short address (e.g. 0x1234...5678)
export function formatAddress(address: string): string {
  if (!address) return '';
  if (address.length < 10) return address;
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// Convert wei string to decimal representation
export function formatWei(wei: string, decimals: number = 18): string {
  if (!wei || wei === '0') return '0';
  try {
    const value = BigInt(wei);
    const divisor = BigInt(10 ** decimals);
    const integerPart = value / divisor;
    const remainder = value % divisor;

    let fractionalPart = remainder.toString().padStart(decimals, '0');
    fractionalPart = fractionalPart.replace(/0+$/, '');

    if (fractionalPart.length === 0) return integerPart.toString();
    return `${integerPart}.${fractionalPart.substring(0, 6)}`;
  } catch {
    return '0';
  }
}

// Format Unix timestamp to localized string
export function formatDate(timestamp: string | number): string {
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp;
  if (isNaN(ts)) return '';
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// Fallback method-name parser from transaction input hex
export function getFallbackMethodName(input: string): string {
  if (!input || input === '0x') return 'Transfer';
  const methodSig = input.substring(0, 10);
  switch (methodSig.toLowerCase()) {
    case '0xa9059cbb': return 'transfer(to, value)';
    case '0x095ea7b3': return 'approve(spender, value)';
    case '0x23b872dd': return 'transferFrom(from, to, value)';
    case '0x7ff36ab5': return 'swapExactETHForTokens(amountOutMin, path, to, deadline)';
    case '0x38ed1739': return 'swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline)';
    case '0xfb0f3ee1': return 'fulfillBasicOrder(parameters)';
    case '0x2e1a7d4d': return 'withdraw(amount)';
    case '0xd0e30db0': return 'deposit()';
    default: return `Contract Interaction (${methodSig})`;
  }
}

// ── Low-level helpers (shared by the API route + the client fallback) ──────

export interface ScanError extends Error { status?: number }
function scanError(message: string, status = 502): ScanError {
  const e = new Error(message) as ScanError;
  e.status = status;
  return e;
}

// fetch + JSON with a hard timeout (browser & Node both honour AbortController).
async function fetchJson(url: string, timeoutMs = 15000, init?: RequestInit): Promise<{ res: Response; json: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = { __raw: text }; }
    return { res, json };
  } finally {
    clearTimeout(timer);
  }
}

// ── EVM (Ethereum, Base, Polygon, Sepolia) ────────────────────────────────
// Keyless Blockscout by default; Etherscan V2 multichain when a key is supplied.
async function fetchEvmTxs(chainId: ChainId, address: string, key: string): Promise<Transaction[]> {
  const cfg = CHAINS[chainId];
  const useEtherscan = !!key && !!cfg.chainId;
  // Cap to the most recent 1,000 txns: the receipts list paginates client-side,
  // and fetching a whale's full 10k history is slow and can exceed the timeout.
  const addr = encodeURIComponent(address);
  const url = useEtherscan
    ? `https://api.etherscan.io/v2/api?chainid=${cfg.chainId}&module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc&apikey=${key}`
    : `${cfg.apiUrl}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=1000&sort=desc`;

  let data: any;
  try {
    ({ json: data } = await fetchJson(url, 20000));
  } catch {
    throw scanError(`Could not reach the ${cfg.name} block explorer. Please retry.`, 502);
  }

  if (data.status === '1' && Array.isArray(data.result)) {
    return data.result.map((tx: any): Transaction => ({
      hash: tx.hash,
      blockNumber: String(tx.blockNumber ?? ''),
      timeStamp: String(tx.timeStamp ?? ''),
      from: tx.from || '',
      to: tx.to || '',
      value: String(tx.value ?? '0'),
      gas: String(tx.gas ?? '0'),
      gasPrice: String(tx.gasPrice ?? '0'),
      gasUsed: String(tx.gasUsed ?? '0'),
      isError: String(tx.isError ?? '0'),
      txreceipt_status: tx.txreceipt_status || (tx.isError === '0' ? '1' : '0'),
      input: tx.input || '0x',
      contractAddress: tx.contractAddress || '',
      methodName: tx.functionName || tx.methodName || getFallbackMethodName(tx.input || '0x'),
      chain: chainId,
    }));
  }
  if (data.message === 'No transactions found' || (Array.isArray(data.result) && data.result.length === 0)) {
    return [];
  }
  const msg = (typeof data.result === 'string' && data.result) || data.message || 'Failed to retrieve the transaction list.';
  if (/Invalid API Key|Missing\/?Invalid API Key|apikey/i.test(msg)) {
    throw scanError('The block explorer API key is invalid. Clear it in Settings to use the keyless tier, or paste a valid key.', 401);
  }
  if (msg === 'NOTOK' || /rate limit|max rate|too many requests/i.test(msg)) {
    throw scanError('Explorer rate limit reached. Wait a few seconds and retry, or add your own free API key in Settings.', 429);
  }
  throw scanError(msg, 502);
}

// ── Bitcoin (Esplora API: mempool.space primary, blockstream.info fallback) ─
function mapBitcoinTx(address: string) {
  return (tx: any): Transaction => {
    const txid = tx.txid || 'unknown';
    const blockHeight = tx.status?.block_height || 0;
    const blockTime = tx.status?.block_time || Math.floor(Date.now() / 1000);
    const feeSatoshis = tx.fee || 0;
    const size = tx.size || 140;

    const isOutgoing = Array.isArray(tx.vin) && tx.vin.some((v: any) => v.prevout?.scriptpubkey_address === address);

    let satoshis = 0n;
    if (isOutgoing) {
      let outgoingVal = 0n;
      if (Array.isArray(tx.vout)) tx.vout.forEach((o: any) => { if (o.scriptpubkey_address !== address) outgoingVal += BigInt(o.value || 0); });
      satoshis = outgoingVal;
    } else {
      let incomingVal = 0n;
      if (Array.isArray(tx.vout)) tx.vout.forEach((o: any) => { if (o.scriptpubkey_address === address) incomingVal += BigInt(o.value || 0); });
      satoshis = incomingVal;
    }

    const valueVirtualWei = (satoshis * BigInt(10 ** 10)).toString();
    const feeVirtualWei = BigInt(feeSatoshis) * BigInt(10 ** 10);
    const gasUsed = size.toString();
    const gasPrice = (feeVirtualWei / BigInt(size)).toString();

    const fromAddr = (tx.vin && tx.vin[0]?.prevout?.scriptpubkey_address) || 'unknown';
    const toAddr = isOutgoing
      ? (tx.vout && tx.vout.find((o: any) => o.scriptpubkey_address !== address)?.scriptpubkey_address) || (tx.vout && tx.vout[0]?.scriptpubkey_address) || ''
      : address;

    return {
      hash: txid, blockNumber: blockHeight.toString(), timeStamp: blockTime.toString(),
      from: isOutgoing ? address : fromAddr, to: toAddr || '',
      value: valueVirtualWei, gas: size.toString(), gasPrice, gasUsed,
      isError: '0', txreceipt_status: '1', input: '0x', contractAddress: '',
      methodName: isOutgoing ? 'Sent BTC' : 'Received BTC', chain: 'bitcoin',
    };
  };
}

async function fetchBitcoinTxs(address: string): Promise<Transaction[]> {
  const addr = encodeURIComponent(address);
  const sources = [
    `https://mempool.space/api/address/${addr}/txs`,
    `https://blockstream.info/api/address/${addr}/txs`,
  ];
  let lastError: ScanError | null = null;
  for (const url of sources) {
    try {
      const { res, json } = await fetchJson(url);
      if (!res.ok) {
        if (res.status === 400) throw scanError('That does not look like a valid Bitcoin address.', 400);
        lastError = scanError(`Bitcoin explorer responded with status ${res.status}.`, 502);
        continue;
      }
      if (!Array.isArray(json)) { lastError = scanError('Unexpected response from the Bitcoin explorer.', 502); continue; }
      return json.map(mapBitcoinTx(address));
    } catch (err: any) {
      if (err?.status === 400) throw err;
      lastError = err;
    }
  }
  throw lastError || scanError('Failed to fetch Bitcoin transactions.', 502);
}

// ── Solana ─────────────────────────────────────────────────────────────────
// Keyless out of the box via public JSON-RPC (getSignaturesForAddress +
// getTransaction). When a Helius key is supplied (Settings drawer or the
// HELIUS_API_KEY env var) we use Helius parsed transactions for richer data,
// falling back to the public RPC if Helius is unreachable.
async function fetchSolanaTxs(address: string, key: string): Promise<Transaction[]> {
  if (key && key !== 'YourHeliusKey') {
    try {
      return await fetchSolanaViaHelius(address, key);
    } catch {
      // Bad/unreachable key → transparently fall back to the keyless public RPC.
    }
  }
  return fetchSolanaViaRpc(address);
}

async function fetchSolanaViaHelius(address: string, key: string): Promise<Transaction[]> {
  let res: Response, data: any;
  try {
    ({ res, json: data } = await fetchJson(`https://api.helius.xyz/v0/addresses/${encodeURIComponent(address)}/transactions?api-key=${key}`));
  } catch {
    throw scanError('Could not reach the Solana (Helius) API. Please retry.', 502);
  }
  if (!res.ok) {
    if (res.status === 401) throw scanError('The Helius API key is invalid. Update it in Settings.', 401);
    throw scanError(data?.error || `Solana API responded with status ${res.status}.`, 502);
  }
  if (!Array.isArray(data)) throw scanError('Unexpected response from the Helius Solana API.', 502);

  return data.map((tx: any): Transaction => {
    const signature = tx.signature || 'unknown';
    const timestamp = tx.timestamp || Math.floor(Date.now() / 1000);
    const slot = tx.slot || 0;
    const feeLamports = tx.fee || 0;
    const isFailed = tx.transactionError !== null && tx.transactionError !== undefined;

    let valueLamports = 0n;
    if (Array.isArray(tx.nativeTransfers)) {
      tx.nativeTransfers.forEach((nt: any) => {
        if (nt.fromUserAccount?.toLowerCase() === address.toLowerCase() || nt.toUserAccount?.toLowerCase() === address.toLowerCase()) {
          valueLamports = BigInt(nt.amount || 0);
        }
      });
    }

    const valueVirtualWei = (BigInt(valueLamports) * BigInt(10 ** 9)).toString();
    const feeVirtualWei = BigInt(feeLamports) * BigInt(10 ** 9);
    const gasPrice = (feeVirtualWei / 200000n).toString();
    const fromAddr = tx.feePayer || (tx.nativeTransfers && tx.nativeTransfers[0]?.fromUserAccount) || 'unknown';
    const toAddr = (tx.nativeTransfers && tx.nativeTransfers[0]?.toUserAccount) || '';
    const rawType = tx.type || 'Transfer';

    return {
      hash: signature, blockNumber: slot.toString(), timeStamp: timestamp.toString(),
      from: fromAddr, to: toAddr, value: valueVirtualWei, gas: '200000', gasPrice, gasUsed: '200000',
      isError: isFailed ? '1' : '0', txreceipt_status: isFailed ? '0' : '1', input: '0x', contractAddress: '',
      methodName: rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase(), chain: 'solana',
    };
  });
}

// Keyless public Solana RPC endpoints. PublicNode is CORS-enabled (works from the
// browser fallback); mainnet-beta is a server-side backup. getTransaction batches
// are capped to 1 on public nodes, so we fetch each tx individually (bounded
// concurrency) after one getSignaturesForAddress call.
const SOLANA_RPCS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
];

async function solanaRpcCall(endpoint: string, method: string, params: unknown[], timeoutMs = 12000): Promise<any> {
  const { res, json } = await fetchJson(endpoint, timeoutMs, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw scanError(`Solana RPC responded with status ${res.status}.`, res.status === 429 ? 429 : 502);
  if (json?.error) throw scanError(json.error.message || 'Solana RPC returned an error.', 502);
  return json?.result;
}

// Run an async mapper over items with a fixed concurrency cap (keeps us under
// public-RPC rate limits while still parallelising).
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const toBigLamports = (n: unknown): bigint => {
  try { return BigInt(typeof n === 'number' ? Math.trunc(n) : ((n as any) ?? 0)); } catch { return 0n; }
};

// Normalise one RPC (signature + getTransaction) result into our Transaction shape.
function mapSolanaRpcTx(address: string, sig: any, tx: any): Transaction {
  const signature = sig?.signature || tx?.transaction?.signatures?.[0] || 'unknown';
  const blockTime = sig?.blockTime ?? tx?.blockTime ?? Math.floor(Date.now() / 1000);
  const slot = sig?.slot ?? tx?.slot ?? 0;
  const isFailed = (sig?.err ?? tx?.meta?.err) != null;
  const feeLamports = toBigLamports(tx?.meta?.fee ?? 0);

  const keys: any[] = tx?.transaction?.message?.accountKeys ?? [];
  const keyStr = (k: any): string => (typeof k === 'string' ? k : k?.pubkey) || '';
  const feePayer = keyStr(keys[0]) || 'unknown';

  // Native SOL transfers can be top-level or inner (CPI) instructions.
  const innerIx: any[] = (tx?.meta?.innerInstructions ?? []).flatMap((ii: any) => ii?.instructions ?? []);
  const allIx: any[] = [...(tx?.transaction?.message?.instructions ?? []), ...innerIx];

  let lamports = 0n;
  let fromAddr = feePayer;
  let toAddr = '';
  let matched = false;
  for (const ix of allIx) {
    const p = ix?.parsed;
    const isSystem = ix?.program === 'system' || ix?.programId === '11111111111111111111111111111111';
    if (!p || !isSystem || (p.type !== 'transfer' && p.type !== 'transferChecked')) continue;
    const info = p.info || {};
    const src: string = info.source || '';
    const dst: string = info.destination || '';
    const amt = toBigLamports(info.lamports);
    if (src === address || dst === address) { lamports = amt; fromAddr = src || fromAddr; toAddr = dst; matched = true; break; }
    if (!matched && !toAddr) { fromAddr = src || fromAddr; toAddr = dst; lamports = amt; }
  }

  const valueVirtualWei = (lamports * BigInt(10 ** 9)).toString();
  const feeVirtualWei = feeLamports * BigInt(10 ** 9);
  const gasPrice = (feeVirtualWei / 200000n).toString();

  let methodName = 'Interaction';
  if (allIx.some((ix) => ix?.program === 'system' && ix?.parsed?.type === 'transfer')) methodName = 'Transfer';
  else if (allIx.some((ix) => ix?.program === 'spl-token')) methodName = 'Token Transfer';
  else if (allIx[0]?.program) methodName = String(allIx[0].program).charAt(0).toUpperCase() + String(allIx[0].program).slice(1);

  return {
    hash: signature, blockNumber: String(slot), timeStamp: String(blockTime),
    from: fromAddr, to: toAddr, value: valueVirtualWei, gas: '200000', gasPrice, gasUsed: '200000',
    isError: isFailed ? '1' : '0', txreceipt_status: isFailed ? '0' : '1', input: '0x', contractAddress: '',
    methodName, chain: 'solana',
  };
}

async function fetchSolanaViaRpc(address: string): Promise<Transaction[]> {
  const LIMIT = 20;
  const txConfig = { maxSupportedTransactionVersion: 0, encoding: 'jsonParsed' };
  let lastError: ScanError | null = null;

  for (const endpoint of SOLANA_RPCS) {
    try {
      const sigs: any[] = await solanaRpcCall(endpoint, 'getSignaturesForAddress', [address, { limit: LIMIT }]);
      if (!Array.isArray(sigs)) { lastError = scanError('Unexpected response from the Solana RPC.', 502); continue; }
      if (sigs.length === 0) return [];

      const txResults = await mapWithConcurrency(sigs, 4, async (s: any) => {
        try { return await solanaRpcCall(endpoint, 'getTransaction', [s.signature, txConfig]); }
        catch { return null; } // a single failed lookup still leaves the signature row
      });

      return sigs.map((s, idx) => mapSolanaRpcTx(address, s, txResults[idx]));
    } catch (err: any) {
      lastError = err?.status ? err : scanError('Could not reach a public Solana RPC. Please retry.', 502);
      // try the next endpoint
    }
  }

  throw lastError || scanError('Could not load Solana transactions from public RPCs. Retry, or add a free Helius API key in Settings.', 502);
}

// Direct fetch+normalize for one chain. Runs server-side (API route) AND as the
// client fallback. `key` is an Etherscan key for EVM, a Helius key for Solana.
export async function fetchChainTransactions(chainId: ChainId, address: string, key?: string): Promise<Transaction[]> {
  const k = (key || '').trim();
  if (chainId === 'solana') return fetchSolanaTxs(address, k);
  if (chainId === 'bitcoin') return fetchBitcoinTxs(address);
  return fetchEvmTxs(chainId, address, k);
}

// ── Client entry points ────────────────────────────────────────────────────
// Prefer our backend (hides keys, no CORS). If the server can't reach the
// explorer (restricted egress in some hosts) fall back to a direct browser
// fetch, so scans always work. The flag avoids re-paying the timeout each scan.
let backendUnavailable = false;

export async function fetchTransactions(address: string, chainId: ChainId, apiKey?: string): Promise<Transaction[]> {
  const key = (apiKey || '').trim();

  if (!backendUnavailable && typeof window !== 'undefined') {
    try {
      const { res, json } = await fetchJson(
        `/api/transactions?chain=${encodeURIComponent(chainId)}&address=${encodeURIComponent(address)}`,
        6000,
        { headers: key ? { 'x-api-key': key } : undefined }
      );
      if (res.ok) return Array.isArray(json.transactions) ? (json.transactions as Transaction[]) : [];
      // 4xx = a real, actionable error (bad address / invalid key) → surface it.
      if (res.status >= 400 && res.status < 500) throw scanError(json?.error || `Scan failed (status ${res.status}).`, res.status);
      // 5xx = backend couldn't reach the explorer → switch to direct for this session.
      backendUnavailable = true;
    } catch (err: any) {
      if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) throw err;
      backendUnavailable = true; // network / timeout / abort → go direct
    }
  }

  return fetchChainTransactions(chainId, address, key);
}

export async function fetchLivePrices(): Promise<{ ethereum: number; polygon: number; solana: number; bitcoin: number }> {
  // Backend first.
  if (typeof window !== 'undefined') {
    try {
      const { res, json } = await fetchJson('/api/prices', 8000);
      if (res.ok) {
        return {
          ethereum: json.ethereum ?? PRICE_FALLBACK.ethereum,
          polygon: json.polygon ?? PRICE_FALLBACK.polygon,
          solana: json.solana ?? PRICE_FALLBACK.solana,
          bitcoin: json.bitcoin ?? PRICE_FALLBACK.bitcoin,
        };
      }
    } catch { /* fall through to direct */ }
  }
  // Direct CoinGecko fallback.
  try {
    const { res, json } = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network,solana,bitcoin&vs_currencies=usd', 8000);
    if (res.ok) {
      return {
        ethereum: json.ethereum?.usd ?? PRICE_FALLBACK.ethereum,
        polygon: json['matic-network']?.usd ?? PRICE_FALLBACK.polygon,
        solana: json.solana?.usd ?? PRICE_FALLBACK.solana,
        bitcoin: json.bitcoin?.usd ?? PRICE_FALLBACK.bitcoin,
      };
    }
  } catch { /* use fallback */ }
  return { ...PRICE_FALLBACK };
}

// Generate deterministic background gradient from address for user avatars
export function generateAvatarGradient(address: string): string {
  if (!address || address.length < 10) {
    return 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)';
  }
  let hash = 0;
  const cleanAddr = address.toLowerCase();
  for (let i = 0; i < cleanAddr.length; i++) {
    hash = cleanAddr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = Math.abs((hash >> 8) % 360);
  return `radial-gradient(circle at top left, hsl(${h1}, 80%, 60%), hsl(${h2}, 85%, 40%))`;
}

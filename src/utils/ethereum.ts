import { Transaction } from './types';

// Operator-provided default API keys (set in .env.local or the hosting env).
// Users can still override these per-chain in the in-app Settings drawer.
const ENV_ETHERSCAN_KEY = (process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '').trim();
const ENV_HELIUS_KEY = (process.env.NEXT_PUBLIC_HELIUS_API_KEY || '').trim();

export type ChainId = 'ethereum' | 'polygon' | 'sepolia' | 'solana' | 'bitcoin';

export interface ChainConfig {
  name: string;
  nativeCurrency: string;
  apiUrl: string;
  explorerUrl: string;
  priceKey: string;
  defaultApiKey: string;
  chainId?: number;
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
    
    // Format remainder to have trailing zeros trimmed, up to decimals precision
    let fractionalPart = remainder.toString().padStart(decimals, '0');
    fractionalPart = fractionalPart.replace(/0+$/, ''); // remove trailing zeros
    
    if (fractionalPart.length === 0) {
      return integerPart.toString();
    }
    
    // Return max 6 decimal places for readability
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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Fetch Solana transaction history using Helius parsed transactions endpoint
async function fetchSolanaTransactions(address: string, apiKey: string): Promise<Transaction[]> {
  const trimmedKey = (apiKey && apiKey.trim()) || ENV_HELIUS_KEY;
  const isPlaceholder = trimmedKey === 'YourHeliusKey';
  if (!trimmedKey || isPlaceholder) {
    throw new Error('Please configure a free Helius API Key in Settings to scan Solana addresses.');
  }
  const url = `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${trimmedKey}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Solana API responded with status ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid response from Helius Solana API');
    }
    
    return data.map((tx: any) => {
      const signature = tx.signature || 'unknown';
      const timestamp = tx.timestamp || Math.floor(Date.now() / 1000);
      const slot = tx.slot || 0;
      const feeLamports = tx.fee || 0;
      const isFailed = tx.transactionError !== null;
      
      let valueLamports = 0n;
      if (Array.isArray(tx.nativeTransfers)) {
        tx.nativeTransfers.forEach((nt: any) => {
          if (nt.fromUserAccount?.toLowerCase() === address.toLowerCase() || 
              nt.toUserAccount?.toLowerCase() === address.toLowerCase()) {
            valueLamports = BigInt(nt.amount || 0);
          }
        });
      }
      
      // Scale SOL decimals (9) to virtual Wei (18)
      const valueVirtualWei = (BigInt(valueLamports) * BigInt(10 ** 9)).toString();
      const feeVirtualWei = BigInt(feeLamports) * BigInt(10 ** 9);
      
      // Use 200,000 CU as standard Solana budget
      const gasUsed = "200000";
      const gasPrice = (feeVirtualWei / 200000n).toString();
      
      const fromAddr = tx.feePayer || (tx.nativeTransfers && tx.nativeTransfers[0]?.fromUserAccount) || 'unknown';
      const toAddr = (tx.nativeTransfers && tx.nativeTransfers[0]?.toUserAccount) || '';
      const rawType = tx.type || 'Transfer';
      const methodName = rawType.charAt(0).toUpperCase() + rawType.slice(1).toLowerCase();
      
      return {
        hash: signature,
        blockNumber: slot.toString(),
        timeStamp: timestamp.toString(),
        from: fromAddr,
        to: toAddr,
        value: valueVirtualWei,
        gas: '200000',
        gasPrice: gasPrice,
        gasUsed: gasUsed,
        isError: isFailed ? '1' : '0',
        txreceipt_status: isFailed ? '0' : '1',
        input: '0x',
        contractAddress: '',
        methodName: methodName,
        chain: 'solana',
      };
    });
  } catch (err: any) {
    console.error('Error fetching Solana transactions:', err);
    throw new Error(err.message || 'Error occurred while scanning Solana transactions.');
  }
}

// Fetch Bitcoin transaction history using Mempool.space open API
async function fetchBitcoinTransactions(address: string): Promise<Transaction[]> {
  const url = `https://mempool.space/api/address/${address}/txs`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Bitcoin API responded with status ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid response from Mempool.space Bitcoin API');
    }
    
    return data.map((tx: any) => {
      const txid = tx.txid || 'unknown';
      const blockHeight = tx.status?.block_height || 0;
      const blockTime = tx.status?.block_time || Math.floor(Date.now() / 1000);
      const feeSatoshis = tx.fee || 0;
      const size = tx.size || 140;
      
      const isOutgoing = Array.isArray(tx.vin) && tx.vin.some((v: any) => v.prevout?.scriptpubkey_address === address);
      
      let satoshis = 0n;
      if (isOutgoing) {
        let outgoingVal = 0n;
        if (Array.isArray(tx.vout)) {
          tx.vout.forEach((o: any) => {
            if (o.scriptpubkey_address !== address) {
              outgoingVal += BigInt(o.value || 0);
            }
          });
        }
        satoshis = outgoingVal;
      } else {
        let incomingVal = 0n;
        if (Array.isArray(tx.vout)) {
          tx.vout.forEach((o: any) => {
            if (o.scriptpubkey_address === address) {
              incomingVal += BigInt(o.value || 0);
            }
          });
        }
        satoshis = incomingVal;
      }
      
      // Scale BTC decimals (8) to virtual Wei (18)
      const valueVirtualWei = (satoshis * BigInt(10 ** 10)).toString();
      const feeVirtualWei = BigInt(feeSatoshis) * BigInt(10 ** 10);
      
      const gasUsed = size.toString();
      const gasPrice = (feeVirtualWei / BigInt(size)).toString();
      
      const fromAddr = (tx.vin && tx.vin[0]?.prevout?.scriptpubkey_address) || 'unknown';
      const toAddr = isOutgoing 
        ? (tx.vout && tx.vout.find((o: any) => o.scriptpubkey_address !== address)?.scriptpubkey_address) || (tx.vout && tx.vout[0]?.scriptpubkey_address) || ''
        : address;
      
      return {
        hash: txid,
        blockNumber: blockHeight.toString(),
        timeStamp: blockTime.toString(),
        from: isOutgoing ? address : fromAddr,
        to: toAddr || '',
        value: valueVirtualWei,
        gas: size.toString(),
        gasPrice: gasPrice,
        gasUsed: gasUsed,
        isError: '0',
        txreceipt_status: '1',
        input: '0x',
        contractAddress: '',
        methodName: isOutgoing ? 'Sent BTC' : 'Received BTC',
        chain: 'bitcoin',
      };
    });
  } catch (err: any) {
    console.error('Error fetching Bitcoin transactions:', err);
    throw new Error(err.message || 'Error occurred while scanning Bitcoin transactions.');
  }
}

// Fetch transaction history for an address on a specific chain
export async function fetchTransactions(
  address: string,
  chainId: ChainId,
  apiKey?: string
): Promise<Transaction[]> {
  if (chainId === 'solana') {
    return fetchSolanaTransactions(address, apiKey || '');
  }
  if (chainId === 'bitcoin') {
    return fetchBitcoinTransactions(address);
  }

  const chain = CHAINS[chainId];
  const trimmedKey = (apiKey && apiKey.trim()) || ENV_ETHERSCAN_KEY;
  const isPlaceholder = !trimmedKey || trimmedKey === 'YourEtherscanKey' || trimmedKey === 'YourPolygonscanKey' || (chain.defaultApiKey && trimmedKey === chain.defaultApiKey);

  const keyParam = isPlaceholder ? '' : `&apikey=${trimmedKey}`;
  const isEtherscan = chain.apiUrl.includes('etherscan.io');
  const chainIdParam = (isEtherscan && chain.chainId) ? `&chainid=${chain.chainId}` : '';
  const url = `${chain.apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc${chainIdParam}${keyParam}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result.map((tx: any) => ({
        ...tx,
        chain: chainId,
        txreceipt_status: tx.txreceipt_status || (tx.isError === '0' ? '1' : '0'),
        methodName: tx.functionName || tx.methodName || getFallbackMethodName(tx.input),
      }));
    } else if (
      data.message === 'No transactions found' || 
      (Array.isArray(data.result) && data.result.length === 0)
    ) {
      return [];
    } else {
      let errorMsg = 'Failed to retrieve transaction list';
      if (typeof data.result === 'string' && data.result) {
        errorMsg = data.result;
      } else if (data.message) {
        errorMsg = data.message;
      }
      
      if (
        errorMsg.includes('Missing/Invalid API Key') || 
        errorMsg.includes('Invalid API Key') || 
        errorMsg.includes('apikey')
      ) {
        errorMsg = 'The block explorer API key is invalid. Please verify it in Settings or clear it to use the public keyless tier.';
      } else if (errorMsg === 'NOTOK' || errorMsg.includes('rate limit') || errorMsg.includes('Max rate limit') || errorMsg.includes('too many requests')) {
        errorMsg = 'Rate limit exceeded. Please wait a few seconds, retry, or configure your own free API Key in Settings for higher limits.';
      }
      throw new Error(errorMsg);
    }
  } catch (err: any) {
    console.error('Error fetching transactions:', err);
    throw new Error(err.message || 'Network error occurred while fetching transactions.');
  }
}

// Fallback method name parser from transaction input hex
function getFallbackMethodName(input: string): string {
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

// Fetch live token/native currency price from CoinGecko (keyless)
export async function fetchLivePrices(): Promise<{ ethereum: number; polygon: number; solana: number; bitcoin: number }> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network,solana,bitcoin&vs_currencies=usd'
    );
    const data = await res.json();
    return {
      ethereum: data.ethereum?.usd || 3100.0,
      polygon: data['matic-network']?.usd || 0.72,
      solana: data.solana?.usd || 150.0,
      bitcoin: data.bitcoin?.usd || 65000.0,
    };
  } catch (e) {
    console.warn('Failed to fetch prices from CoinGecko, using fallback static prices.', e);
    return {
      ethereum: 3100.0,
      polygon: 0.72,
      solana: 150.0,
      bitcoin: 65000.0,
    };
  }
}

// Generate deterministic background gradient from address for user avatars
export function generateAvatarGradient(address: string): string {
  if (!address || address.length < 10) {
    return 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)';
  }
  
  // Calculate address character code hash
  let hash = 0;
  const cleanAddr = address.toLowerCase();
  for (let i = 0; i < cleanAddr.length; i++) {
    hash = cleanAddr.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Compute two different hues based on the hash
  const h1 = Math.abs(hash % 360);
  const h2 = Math.abs((hash >> 8) % 360);
  
  // Generates rich cybernetic visual gradient
  const color1 = `hsl(${h1}, 80%, 60%)`;
  const color2 = `hsl(${h2}, 85%, 40%)`;
  
  return `radial-gradient(circle at top left, ${color1}, ${color2})`;
}


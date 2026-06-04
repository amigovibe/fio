import { CHAINS, ChainId, fetchChainTransactions, ScanError } from '../../../utils/ethereum';

// Always run server-side; never cache a wallet scan.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Operator keys live ONLY on the server (no NEXT_PUBLIC_ prefix). Legacy
// NEXT_PUBLIC_* names are still honoured for backwards compatibility.
const ENV_ETHERSCAN_KEY = (process.env.ETHERSCAN_API_KEY || process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || '').trim();
const ENV_HELIUS_KEY = (process.env.HELIUS_API_KEY || process.env.NEXT_PUBLIC_HELIUS_API_KEY || '').trim();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') || '').trim();
  const chain = (searchParams.get('chain') || '') as ChainId;
  // A user's own key (from the in-app Settings drawer) takes precedence over the
  // operator key; otherwise we use the keyless public tier.
  const userKey = (request.headers.get('x-api-key') || searchParams.get('key') || '').trim();

  if (!address) {
    return Response.json({ error: 'Missing wallet address.' }, { status: 400 });
  }
  if (!CHAINS[chain]) {
    return Response.json({ error: `Unsupported chain: "${chain}".` }, { status: 400 });
  }

  const key = userKey || (chain === 'solana' ? ENV_HELIUS_KEY : ENV_ETHERSCAN_KEY);

  try {
    const transactions = await fetchChainTransactions(chain, address, key);
    return Response.json({ chain, address, count: transactions.length, transactions });
  } catch (err) {
    const status = (err as ScanError)?.status ?? 502;
    const message = (err as Error)?.message || 'Failed to fetch transactions.';
    console.error(`[/api/transactions] ${chain} ${address}: ${message}`);
    return Response.json({ error: message }, { status });
  }
}

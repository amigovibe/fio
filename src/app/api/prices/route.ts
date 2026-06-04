// Live native-asset prices in USD, proxied server-side so the client never hits
// CoinGecko directly (avoids browser rate-limit/CORS issues). Base & Sepolia use
// the ETH price, so only the four base assets are fetched.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK = { ethereum: 3100.0, polygon: 0.72, solana: 150.0, bitcoin: 65000.0 };

export async function GET() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network,solana,bitcoin&vs_currencies=usd',
      { headers: { 'User-Agent': 'Fio/1.0' } }
    );
    if (!res.ok) return Response.json(FALLBACK);
    const data = await res.json();
    return Response.json({
      ethereum: data.ethereum?.usd ?? FALLBACK.ethereum,
      polygon: data['matic-network']?.usd ?? FALLBACK.polygon,
      solana: data.solana?.usd ?? FALLBACK.solana,
      bitcoin: data.bitcoin?.usd ?? FALLBACK.bitcoin,
    });
  } catch {
    return Response.json(FALLBACK);
  }
}

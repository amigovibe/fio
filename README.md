<div align="center">

# Fio

**On-chain receipts & gas analytics.**

Turn any wallet or blockchain address into itemized, verifiable transaction receipts — with gas analytics and one-tap PDF/JPEG export.

</div>

---

## What it is

Fio is a Next.js Web3 accounting app. Connect a wallet (or paste any public address) and get a full transaction history, gas-spend analytics, and downloadable receipts for every transaction — each with a **scannable QR code** that links to the canonical block-explorer page for verification.

## Features

- 🔗 **Multi-chain** — Ethereum, Base, Polygon, Sepolia (EVM), plus Solana and Bitcoin
- 🧾 **Premium fintech receipts** — itemized, with a real scannable verification QR; download as **PDF or JPEG**, in light or dark (the on-screen preview matches the download exactly)
- ⛽ **Gas analytics** — total fees, average fee/tx, and success rate per scanned wallet
- 👛 **Connect a wallet or paste an address** — injected EVM wallets (MetaMask, etc.) or any public address
- 📱 **Fully responsive** — tuned layouts for mobile, tablet, and desktop, with a bottom-sheet receipt on mobile
- 🌗 **Light & dark themes**

## Supported networks

| Network | Data source | Key required? |
|---|---|---|
| Ethereum, Base, Polygon, Sepolia | Blockscout (keyless) or Etherscan V2 | No (key optional, raises rate limits) |
| Bitcoin | mempool.space → blockstream.info fallback | No |
| Solana | Public RPC (PublicNode), keyless · Helius when keyed | No (Helius optional, richer data) |

## Tech stack

- **Framework**: Next.js 16 (App Router), TypeScript
- **Web3**: wagmi v2 + viem (EVM wallet connection)
- **Backend**: Next.js Route Handlers (`/api/transactions`, `/api/prices`) proxy + normalize explorer data server-side
- **Styling**: a single `src/app/globals.css` with CSS custom properties (no Tailwind), dark + light themes
- **Charts**: Recharts · **Export**: html-to-image + jsPDF · **QR**: qrcode.react · **Icons**: lucide-react

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build
npm run start    # serve the production build
npm run lint     # ESLint
```

### Environment variables (optional)

Everything works **keyless** out of the box — including Solana. To raise rate limits (or get richer Solana data via Helius), copy `.env.local.example` to `.env.local` and fill in:

```bash
ETHERSCAN_API_KEY=   # one key covers Ethereum, Base, Polygon & Sepolia (Etherscan V2)
HELIUS_API_KEY=      # OPTIONAL — Solana works keyless; this adds richer parsed-transaction data
```

Keys are read **server-side only** (no `NEXT_PUBLIC_` prefix), so they never reach the browser.

## How scanning works

Wallet scans go through Fio's own backend routes, which fetch and normalize explorer data server-side (keeping any keys off the client and avoiding CORS). If the server can't reach an explorer (e.g. restricted egress), the client transparently **falls back to a direct browser fetch**, so scans work everywhere. Results are capped at the 1,000 most recent transactions per address.

## Project structure

```
src/
  app/
    page.tsx                  Main shell + app state
    layout.tsx                Root layout, metadata, wagmi provider
    globals.css               All styles (CSS variables, light/dark)
    icon.svg                  Fio favicon
    api/
      transactions/route.ts   Backend: scan + normalize wallet history
      prices/route.ts         Backend: live USD prices
  components/                 Dashboard, WalletConnect, TransactionList, ReceiptModal, Logo
  context/Web3Provider.tsx    wagmi + react-query setup
  utils/                      ethereum.ts (chains, formatters, fetchers), types.ts
```

## Deploy

Deploys cleanly to any Next.js host (e.g. Vercel). Set `ETHERSCAN_API_KEY` / `HELIUS_API_KEY` as environment variables on the host to use the keyed tier; otherwise the keyless tier is used automatically.

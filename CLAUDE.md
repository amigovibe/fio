# Fio — Claude Code Context

## What this project is
Fio (formerly TxReceipts) is a Next.js 14 Web3 blockchain accounting app. Users connect a wallet (or paste any address) and get a full transaction history with downloadable PDF/JPEG receipts. Supports Ethereum mainnet, Base, Polygon, Sepolia testnet, Solana, and Bitcoin.

## Commands
```bash
npm install          # install deps
npm run dev          # dev server at localhost:3000
npm run build        # production build
npm run lint         # ESLint
```

## Tech stack
- **Framework**: Next.js 14 App Router, TypeScript, `'use client'` components throughout
- **Web3**: wagmi v2 + viem for EVM wallet connection; custom fetch logic for Solana/Bitcoin
- **Styling**: Single `src/app/globals.css` with CSS custom properties — no Tailwind, no CSS modules (except `page.module.css` which is legacy/unused)
- **Charts**: Recharts `AreaChart` for gas history
- **Export**: `html-to-image` (JPEG), `window.print()` (PDF)
- **Icons**: lucide-react

## Project structure
```
src/
  app/
    globals.css        ← ALL styles live here — CSS variables + utility classes
    layout.tsx         ← Root layout, theme provider, wagmi config
    page.tsx           ← Main page shell
    api/
      transactions/route.ts  ← backend: scan + normalize wallet history (all chains)
      prices/route.ts        ← backend: live USD prices (CoinGecko)
  components/
    Dashboard.tsx      ← Top-level: stats, charts, LiveTicker, assembles everything
    WalletConnect.tsx  ← Wallet connect/disconnect, address search bar, demo mode
    TransactionList.tsx← Table (desktop) + card list (mobile), filters, pagination
    ReceiptModal.tsx   ← Transaction receipt detail, PDF/JPEG export
    LiveTicker.tsx     ← Scrolling price ticker strip
  context/
    Web3Provider.tsx   ← wagmi + viem provider setup
  utils/
    ethereum.ts        ← CHAINS config, ChainId type, formatters, shared explorer
                          fetchers (fetchChainTransactions) + backend-first client
    mockData.ts        ← Demo mode transaction data (used when isDemoMode=true)
```

## Design system — important
All colors and spacing go through CSS variables in `:root` (dark, default) and `[data-theme="light"]` (light) inside `globals.css`. **Never hardcode hex colors in components** — always use `var(--token-name)`.

### Key tokens
```
--bg-primary / --bg-secondary        backgrounds
--text-primary / --text-secondary / --text-muted    text hierarchy
--accent-cyan (#3b82f6 dark / #1e40af light)        primary interactive blue
--accent-purple (#1d4ed8 dark / #2563eb light)      secondary blue
--accent-gradient                    gradient for CTAs
--glass-bg / --glass-border / --glass-shadow        glassmorphism panels
--status-success/pending/error       green/amber/red
--gas-low (#10b981) / --gas-avg (#0ea5e9) / --gas-high (#f97316)
```

### Utility classes (defined in globals.css)
- `.glass-panel` — frosted glass card
- `.btn`, `.btn-primary`, `.btn-secondary` — buttons
- `.input-field` — styled text input
- `.badge`, `.badge-success`, `.badge-error`, `.badge-pending` — status pills
- `.tx-table-wrapper` — hidden on mobile (≤640px), shows desktop table
- `.tx-cards-mobile` — hidden on desktop, shows card list on mobile (≤640px)
- `.spinner` — rotating loader animation

## Responsive layout
- **Desktop (≥641px)**: standard table in `TransactionList`
- **Mobile (≤640px)**: card-based layout, bottom-sheet modal for receipts, stacked wallet search form
- Breakpoints defined in `globals.css` at 640px and 641–767px
- ReceiptModal uses bottom-sheet pattern on mobile: `align-items: flex-end`, `border-radius: 20px 20px 0 0`, `max-height: 92dvh`

## State management
All state lives in `page.tsx` and is passed down as props — no Redux, no Zustand. Key state:
- `activeAddress` — the address currently being viewed
- `isDemoMode` — whether mock data is active
- `selectedChain` — `ChainId` ('ethereum' | 'base' | 'polygon' | 'sepolia' | 'solana' | 'bitcoin')
- `theme` — 'dark' | 'light', applied as `data-theme` attribute on `<html>`

## APIs
All explorer calls go through our own backend routes (`src/app/api/*`), which fetch + normalize server-side and keep keys off the client. The client (`fetchTransactions` / `fetchLivePrices` in `utils/ethereum.ts`) calls the backend first and **falls back to a direct browser fetch** if the server can't reach the explorer (e.g. restricted egress), so scans work everywhere. The shared `fetchChainTransactions()` powers both paths.
- **EVM (Ethereum, Base, Polygon, Sepolia)**: keyless Blockscout by default; Etherscan V2 multichain when `ETHERSCAN_API_KEY` is set (one key, all EVM chains). Capped to the 1,000 most recent txns.
- **Bitcoin**: mempool.space (Esplora API), with blockstream.info as a fallback. Keyless.
- **Solana**: Helius parsed transactions — requires `HELIUS_API_KEY` (or a per-chain key in the Settings drawer).
- **Prices**: CoinGecko (keyless) via `/api/prices`.
- Optional keys are server-side env vars (`ETHERSCAN_API_KEY`, `HELIUS_API_KEY`) — see `.env.local.example`. Legacy `NEXT_PUBLIC_*` names are still honoured.

## Common tasks
- **Add a new chain**: add to `CHAINS` in `ethereum.ts`, add case in `WalletConnect.tsx` placeholder/validation
- **Change a color**: edit the CSS variable in `globals.css` `:root` or `[data-theme="light"]` — it propagates everywhere
- **Add a new receipt field**: add to `ReceiptModal.tsx` and the mock data shape in `mockData.ts`
- **Adjust mobile breakpoint**: change the `640px` values in the media queries at the bottom of `globals.css`

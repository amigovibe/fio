import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Web3Provider } from '../context/Web3Provider';

export const metadata: Metadata = {
  title: 'Fio — Web3 Receipts & Gas Analytics',
  description: 'Fio turns any wallet or blockchain address into itemized, verifiable transaction receipts — with gas analytics and one-tap PDF/JPEG export across Ethereum, Base, Polygon, Solana and Bitcoin.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0b1220',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          {children}
        </Web3Provider>
      </body>
    </html>
  );
}

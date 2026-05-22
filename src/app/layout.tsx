import type { Metadata } from 'next';
import './globals.css';
import { Web3Provider } from '../context/Web3Provider';

export const metadata: Metadata = {
  title: 'TxReceipts | Ledger Transaction Invoices & Gas Analytics',
  description: 'Instantly generate itemized, tax-compliant receipts and invoices for your Ethereum & EVM blockchain transactions. Visualize gas spending trends and export professional receipt prints.',
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

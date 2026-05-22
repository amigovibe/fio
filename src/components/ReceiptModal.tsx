'use client';

import React, { useRef } from 'react';
import { X, Printer, Copy, Check, FileText, Download, Sun, Moon } from 'lucide-react';
import { Transaction } from '../utils/types';
import { formatDate, formatWei, CHAINS, formatAddress, ChainId, generateAvatarGradient } from '../utils/ethereum';
import * as htmlToImage from 'html-to-image';

interface ReceiptModalProps {
  tx: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  nativePrice: number; // Native asset price in USD (ETH or POL/MATIC)
  activeAddress?: string | null; // viewed address — used to show send/receive direction
}

const getReceiptFunMessage = (chainId: ChainId, isSuccess: boolean): string => {
  if (isSuccess) {
    switch (chainId) {
      case 'ethereum':
        return 'Ultra Sound Money! Gas burned, block secured. 🦇🔊';
      case 'polygon':
        return 'Gas fees cheaper than a piece of gum! Polygon speedrun. 💜';
      case 'sepolia':
        return 'Testnet tokens cycled! No real ETH was harmed. 🧪';
      case 'solana':
        return 'Blink and you missed it! Speed of light execution. 🚀';
      case 'bitcoin':
        return 'Stacking sats like a pro. Built on digital gold. 🪙';
      default:
        return 'Transaction verified! Safe & secure on-chain. 🔒';
    }
  } else {
    switch (chainId) {
      case 'ethereum':
        return 'Out of gas! Vitalik sheds a tear. 😢';
      case 'polygon':
        return 'Checkpoint missed! Polygon validator went to sleep. 😴';
      case 'sepolia':
        return 'Sepolia faucet exhausted. Try again tomorrow! 🚰';
      case 'solana':
        return 'Transaction dropped! Solana congestion strikes back. 😫';
      case 'bitcoin':
        return 'Double spend rejected! Mempool congestion. 🕸️';
      default:
        return 'Execution reverted. Code failed to execute. ❌';
    }
  }
};

// Deterministic barcode derived from the transaction hash — unique per receipt,
// reproducible for the same tx (a visual fingerprint for verification).
function generateBarcode(seed: string, count = 44): { w: number; filled: boolean }[] {
  const clean = (seed || 'txreceipt').replace(/^0x/, '').toLowerCase();
  const bars: { w: number; filled: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const a = clean.charCodeAt(i % clean.length);
    const b = clean.charCodeAt((i * 3 + 7) % clean.length);
    const code = a + b * 5 + i;
    bars.push({ w: (code % 4) + 1, filled: i % 2 === 0 });
  }
  return bars;
}

export function ReceiptModal({ tx, isOpen, onClose, nativePrice, activeAddress }: ReceiptModalProps) {
  const [copiedFrom, setCopiedFrom] = React.useState(false);
  const [copiedTo, setCopiedTo] = React.useState(false);
  const [copiedHash, setCopiedHash] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);
  const [exportTheme, setExportTheme] = React.useState<'light' | 'dark'>('light');

  const receiptExportRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !tx) return null;

  const chainConfig = CHAINS[tx.chain];
  const nativeCurrency = chainConfig.nativeCurrency;

  // Values calculation
  const txValueEth = formatWei(tx.value, tx.tokenDecimal ? parseInt(tx.tokenDecimal, 10) : 18);
  const txValueUsd = parseFloat(txValueEth) * nativePrice;

  // Gas calculation: gasUsed * gasPrice in wei
  const gasUsedBig = BigInt(tx.gasUsed);
  const gasPriceBig = BigInt(tx.gasPrice);
  const gasFeeWei = (gasUsedBig * gasPriceBig).toString();
  const gasFeeEth = formatWei(gasFeeWei, 18);
  const gasFeeUsd = parseFloat(gasFeeEth) * nativePrice;

  // Total cost (value + gas fee) for outgoing transactions
  const totalEth = (parseFloat(txValueEth) + parseFloat(gasFeeEth)).toFixed(6);
  const totalUsd = txValueUsd + gasFeeUsd;

  const isSuccess = tx.txreceipt_status === '1' && tx.isError === '0';

  // Direction relative to the viewed address (for the +/- amount sign)
  const viewedAddr = (activeAddress || '').toLowerCase();
  const isIncoming = !!viewedAddr && tx.to?.toLowerCase() === viewedAddr;
  const isOutgoing = !!viewedAddr && tx.from.toLowerCase() === viewedAddr;
  const amountSign = isIncoming ? '+' : isOutgoing ? '−' : '';

  // Palette for the downloadable statement card — light (default) or dark variant
  const pal = exportTheme === 'dark'
    ? {
        cardBg: '#0c1829', cardBorder: 'rgba(255,255,255,0.09)', text: '#e8f0fe', muted: '#93aed4',
        faint: 'rgba(255,255,255,0.09)', accent: '#60a5fa',
        okBg: 'rgba(16,185,129,0.16)', okText: '#34d399', failBg: 'rgba(239,68,68,0.16)', failText: '#f87171',
        dotOk: '#10b981', dotFail: '#ef4444', footer: '#6f8bb0', qrBorder: 'rgba(255,255,255,0.18)',
        wm: '#60a5fa', wmOpacity: 0.08, incoming: '#34d399',
      }
    : {
        cardBg: '#ffffff', cardBorder: '#e6edf7', text: '#0a1628', muted: '#5a7aa5',
        faint: '#e6edf7', accent: '#1e40af',
        okBg: 'rgba(16,185,129,0.12)', okText: '#059669', failBg: 'rgba(239,68,68,0.12)', failText: '#dc2626',
        dotOk: '#10b981', dotFail: '#ef4444', footer: '#94a8c4', qrBorder: '#e6edf7',
        wm: '#1e40af', wmOpacity: 0.05, incoming: '#059669',
      };
  const amountColor = isIncoming ? pal.incoming : pal.text;

  // Unique verification barcode for this transaction
  const barcode = generateBarcode(tx.hash);

  // Chain-specific gas details
  let gasUsedLabel = 'Gas Used';
  let gasUsedVal = `${parseInt(tx.gasUsed).toLocaleString()} units`;
  let gasPriceLabel = 'Gas Price';
  let gasPriceVal = `${parseFloat(formatWei(tx.gasPrice, 9)).toFixed(2)} Gwei`;
  let feeLabel = 'Network Fee (Gas Cost)';

  if (tx.chain === 'solana') {
    gasUsedLabel = 'Compute Units (CU)';
    gasUsedVal = `${parseInt(tx.gasUsed).toLocaleString()} CU`;
    gasPriceLabel = 'Price per CU';
    const lamportsPerCU = Number(tx.gasPrice) / 1000000000;
    gasPriceVal = `${parseFloat(lamportsPerCU.toFixed(6))} lamports`;
    feeLabel = 'Solana Network Fee';
  } else if (tx.chain === 'bitcoin') {
    gasUsedLabel = 'Transaction Size';
    gasUsedVal = `${parseInt(tx.gasUsed).toLocaleString()} vB`;
    gasPriceLabel = 'Fee Rate';
    const feeRate = (BigInt(tx.gasPrice) / 10000000000n).toString();
    gasPriceVal = `${feeRate} sat/vB`;
    feeLabel = 'Bitcoin Network Fee';
  }

  const copyToClipboard = (text: string, type: 'from' | 'to' | 'hash') => {
    navigator.clipboard.writeText(text);
    if (type === 'from') {
      setCopiedFrom(true);
      setTimeout(() => setCopiedFrom(false), 2000);
    } else if (type === 'to') {
      setCopiedTo(true);
      setTimeout(() => setCopiedTo(false), 2000);
    } else if (type === 'hash') {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleDownloadJpeg = async () => {
    const node = receiptExportRef.current;
    if (!node) return;
    setIsExporting(true);
    try {
      // Ensure web fonts are loaded so the rasterized image isn't a fallback font
      if (document.fonts?.ready) await document.fonts.ready;

      const dataUrl = await htmlToImage.toJpeg(node, {
        quality: 0.98,
        pixelRatio: 2,
        backgroundColor: pal.cardBg,
      });

      const link = document.createElement('a');
      link.download = `tx-receipt-${tx.hash.substring(0, 8)}.jpeg`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error generating receipt JPEG:', error);
      alert('Failed to generate JPEG receipt.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    const node = receiptExportRef.current;
    if (!node) return;
    setIsExportingPdf(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;

      const dataUrl = await htmlToImage.toPng(node, {
        pixelRatio: 2,
        backgroundColor: pal.cardBg,
      });

      const width = node.offsetWidth;
      const height = node.offsetHeight;

      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({
        orientation: width > height ? 'l' : 'p',
        unit: 'pt',
        format: [width, height],
      });

      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(`tx-receipt-${tx.hash.substring(0, 8)}.pdf`);
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      alert('Failed to generate PDF receipt.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Styled inline vector QR Code representation of the blockchain explorer link
  const renderQrCode = (borderColor: string = 'var(--glass-border)', size: number = 78) => {
    return (
      <svg width={size} height={size} viewBox="0 0 29 29" style={{ background: '#ffffff', padding: '6px', borderRadius: '6px', border: `1px solid ${borderColor}` }}>
        {/* Corner alignment markers */}
        <path d="M0 0h7v7H0zm1 1v5h5V1zm1 1h3v3H2zm18-2h7v7h-7zm1 1v5h5V1zm1 1h3v3h-3zM0 20h7v7H0zm1 1v5h5V2zm1 1h3v3H2z" fill="#000000" />
        {/* Dynamic pixel layout maps */}
        <path d="M9 0h2v1H9zm4 0h1v3h-1zm2 0h1v1h-1zm2 0h2v2h-2zm-6 2h1v1h-1zm2 0h2v1h-2zm1 2h1v1h-1zm-3 1h2v1H9zm3 0h1v1h-1zm5-2h1v3h-1zm2 1h1v1h-1zm0 2h1v1h-1z" fill="#000000" />
        <path d="M9 9h1v1H9zm2 0h2v2H11zm3 0h3v1h-3zm4 0h2v1h-2zm3 0h1v2h-1zm-10 2h1v1h-1zm3 0h1v2h-1zm4 0h1v1h-1zm-9 2h2v1H9zm3 0h1v1h-1zm3 0h2v1h-2zm3 0h3v1h-3zm-6 2h1v1h-1zm2 0h1v2h-1zm3 0h2v1h-2zm3 0h1v1h-1zm-7 2h1v1h-1zm2 0h2v1h-2zm3 0h1v1h-1zm2 0h2v2h-2z" fill="#000000" />
        <path d="M0 9h2v1H0zm3 0h1v2H3zm2 0h1v1H5zm1 2h1v2H6zm-3 2h2v1H3zm5 0h1v1H8zm-6 2h1v1H2zm4 0h2v1H6zm-6 2h1v2H0zm3 0h1v1H3zm3 0h1v1H6zm2 0h1v1H8zm-7 2h2v1H1zm3 0h1v1H3zm3 0h2v1H6z" fill="#000000" />
        <path d="M9 20h1v1H9zm2 0h1v2h-1zm2 0h3v1h-3zm5 0h1v1h-1zm1 1h2v2h-2zm3-1h1v2h-1zm-7 2h1v1h-1zm3 0h1v1h-1zm-6 2h2v1H9zm4 0h1v2h-1zm2 0h2v1h-2zm3 0h3v1h-3z" fill="#000000" />
      </svg>
    );
  };

  return (
    <>
    <div id="receipt-modal-overlay" className="modal-overlay" onClick={onClose}>
      <div 
        id="receipt-modal-content"
        className="modal-content receipt-paper" 
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        {/* Modal Header (Hidden on print) */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--glass-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={20} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '1.25rem' }}>Transaction Receipt</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem' }}
            className="btn-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Receipt Content (on-screen detail view + print/PDF layout) */}
        <div
          className="modal-body dot-matrix-header"
          style={{ flex: 1, position: 'relative' }}
        >
          {/* Rotated Ink Stamp Overlay */}
          <div 
            className={`receipt-stamp ${isSuccess ? 'receipt-stamp-paid' : 'receipt-stamp-reverted'}`}
            style={{
              position: 'absolute',
              top: '42%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-12deg)',
              border: isSuccess ? '4px double #10b981' : '4px double #ef4444',
              color: isSuccess ? '#10b981' : '#ef4444',
              padding: '0.4rem 1.25rem',
              borderRadius: '6px',
              fontSize: '3.2rem',
              fontWeight: 900,
              fontFamily: 'monospace, "Courier New"',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              opacity: 0.18,
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 5,
              textAlign: 'center',
              boxShadow: isSuccess 
                ? '0 0 15px rgba(16, 185, 129, 0.2), inset 0 0 15px rgba(16, 185, 129, 0.2)' 
                : '0 0 15px rgba(239, 68, 68, 0.2), inset 0 0 15px rgba(239, 68, 68, 0.2)',
            }}
          >
            {isSuccess ? 'PAID' : 'REVERTED'}
          </div>

          <div className="receipt-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px dashed var(--glass-border)', paddingBottom: '1.5rem', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
              <div style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'Space Grotesk', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'inline-block' }} className="receipt-title">
                TXRECEIPTS
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                OFFICIAL TRANSACTION INVOICE
              </div>
              <div style={{ marginTop: '0.25rem' }}>
                <span className={`status-badge ${isSuccess ? 'success' : 'error'}`}>
                  {isSuccess ? 'Transaction Confirmed' : 'Transaction Failed'}
                </span>
              </div>
            </div>
 
            {/* Cryptographic verification QR Link */}
            <a 
              href={`${chainConfig.explorerUrl}/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem', flexShrink: 0, textDecoration: 'none' }}
              className="dashboard-controls hover-scale"
              title={`Verify on ${chainConfig.name} Explorer`}
            >
              {renderQrCode()}
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'monospace', fontWeight: 'bold', letterSpacing: '0.05em' }}>VERIFY PROOF</span>
            </a>
          </div>
 
          {/* Metadata Grid */}
          <div className="receipt-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date & Time</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{formatDate(tx.timeStamp)}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Network</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, textTransform: 'capitalize' }}>{chainConfig.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Block Number</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>#{tx.blockNumber}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Method / Function</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {tx.methodName || 'Transfer'}
              </div>
            </div>
          </div>
 
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '0.5rem 0' }} className="receipt-divider"></div>
 
          {/* Tx Hash */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction Hash</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.02)', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--text-primary)' }}>{tx.hash}</span>
              <button
                onClick={() => copyToClipboard(tx.hash, 'hash')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                className="btn-icon"
              >
                {copiedHash ? <Check size={14} color="var(--status-success)" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
 
          {/* Sender & Receiver Card with Radial Gradients */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }} className="receipt-grid">
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>SENDER (FROM)</span>
                <button
                  onClick={() => copyToClipboard(tx.from, 'from')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  className="btn-icon"
                >
                  {copiedFrom ? <Check size={12} color="var(--status-success)" /> : <Copy size={12} />}
                </button>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
                <div className="address-avatar" style={{ background: generateAvatarGradient(tx.from) }} />
                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all' }}>
                  {formatAddress(tx.from)}
                </span>
              </div>
            </div>
 
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>RECEIVER (TO)</span>
                {tx.to && (
                  <button
                    onClick={() => copyToClipboard(tx.to, 'to')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    className="btn-icon"
                  >
                    {copiedTo ? <Check size={12} color="var(--status-success)" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.4rem' }}>
                <div className="address-avatar" style={{ background: generateAvatarGradient(tx.to || '0x0000000000000000000000000000000000000000') }} />
                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all' }}>
                  {tx.to ? formatAddress(tx.to) : 'Contract Creation'}
                </span>
              </div>
            </div>
          </div>
 
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '0.5rem 0' }} className="receipt-divider"></div>
 
          {/* Financial Itemization */}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Financial Breakdown</div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Amount Sent / Interacted</span>
                <span style={{ fontWeight: 600 }}>
                  {txValueEth} {tx.tokenSymbol || nativeCurrency}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                    (${txValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{gasUsedLabel}</span>
                <span>{gasUsedVal}</span>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{gasPriceLabel}</span>
                <span>{gasPriceVal}</span>
              </div>
 
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{feeLabel}</span>
                <span style={{ fontWeight: 600 }}>
                  {gasFeeEth} {nativeCurrency}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                    (${gasFeeUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </span>
              </div>
 
              <div style={{ borderTop: '1px dashed var(--glass-border)', margin: '0.4rem 0' }} className="receipt-divider"></div>
 
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700 }}>
                <span>Total Capital Involved</span>
                <span style={{ color: 'var(--accent-cyan)' }} className="receipt-title">
                  {totalEth} {nativeCurrency}
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginLeft: '0.5rem', fontWeight: 500 }}>
                    (${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                  </span>
                </span>
              </div>
            </div>
          </div>
 
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '0.5rem 0' }} className="receipt-divider"></div>

          {/* Fun Web3 Message */}
          <div style={{ 
            textAlign: 'center', 
            fontSize: '0.85rem', 
            fontWeight: '600', 
            color: isSuccess ? 'var(--status-success)' : 'var(--status-error)', 
            margin: '1rem 0',
            padding: '0.5rem',
            borderRadius: '6px',
            background: isSuccess ? 'rgba(16, 185, 129, 0.04)' : 'rgba(239, 68, 68, 0.04)',
            border: isSuccess ? '1px dashed rgba(16, 185, 129, 0.15)' : '1px dashed rgba(239, 68, 68, 0.15)',
            fontFamily: 'monospace, sans-serif'
          }}>
            {getReceiptFunMessage(tx.chain, isSuccess)}
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '0.5rem 0' }} className="receipt-divider"></div>

          {/* Unique verification barcode (derived from the tx hash) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', margin: '1.25rem 0 0.5rem' }}>
            <div style={{ display: 'flex', height: '36px', width: '220px', background: 'transparent', gap: '2px', alignItems: 'stretch' }}>
              {barcode.map((b, i) => (
                <div
                  key={i}
                  style={{
                    flex: b.w,
                    background: 'var(--text-primary)',
                    opacity: b.filled ? 0.85 : 0
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', letterSpacing: '0.2em', color: 'var(--text-muted)' }}>
              *{tx.hash.substring(2, 18).toUpperCase()}*
            </span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '0.5rem 0' }} className="receipt-divider"></div>

          {/* Footer Note */}
          <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            This receipt was generated programmatically from public ledger records for block #{tx.blockNumber}. Verified cryptographic ledger proof is immutable.
          </div>
        </div>

        {/* Modal Footer (Hidden on print) */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.1)' }}>
          {/* JPEG export style toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: 'auto' }} title="Style of the downloaded JPEG receipt">
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>JPEG</span>
            <div style={{ display: 'inline-flex', border: '1px solid var(--glass-border)', borderRadius: '8px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setExportTheme('light')}
                aria-pressed={exportTheme === 'light'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: exportTheme === 'light' ? 'var(--accent-gradient)' : 'transparent', color: exportTheme === 'light' ? 'var(--accent-btn-text)' : 'var(--text-secondary)' }}
              >
                <Sun size={13} /> Light
              </button>
              <button
                type="button"
                onClick={() => setExportTheme('dark')}
                aria-pressed={exportTheme === 'dark'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: exportTheme === 'dark' ? 'var(--accent-gradient)' : 'transparent', color: exportTheme === 'dark' ? 'var(--accent-btn-text)' : 'var(--text-secondary)' }}
              >
                <Moon size={13} /> Dark
              </button>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={handleDownloadJpeg}
            disabled={isExporting}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={16} /> {isExporting ? 'Exporting...' : 'Download JPEG'}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Download size={16} /> {isExportingPdf ? 'Exporting...' : 'Download PDF'}
          </button>
        </div>
      </div>
    </div>

    {/* ── Off-screen statement card — the source rendered into the downloaded JPEG ── */}
    <div className="receipt-jpeg-source" aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
      <div
        ref={receiptExportRef}
        style={{
          width: '420px',
          boxSizing: 'border-box',
          background: pal.cardBg,
          color: pal.text,
          fontFamily: "'Plus Jakarta Sans', -apple-system, sans-serif",
          border: `1px solid ${pal.cardBorder}`,
          borderRadius: '20px',
          padding: '28px 26px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Faint diagonal brand watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '82px', letterSpacing: '-0.04em', color: pal.wm, opacity: pal.wmOpacity, transform: 'rotate(-20deg)', whiteSpace: 'nowrap' }}>TXRECEIPTS</div>
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Brand + status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)', color: '#ffffff', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Space Grotesk', sans-serif" }}>TX</div>
            <span style={{ fontWeight: 800, fontSize: '18px', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em' }}>TxReceipts</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '5px 11px', borderRadius: '9999px', background: isSuccess ? pal.okBg : pal.failBg, color: isSuccess ? pal.okText : pal.failText }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: isSuccess ? pal.dotOk : pal.dotFail, display: 'inline-block' }} />
            {isSuccess ? 'Confirmed' : 'Failed'}
          </span>
        </div>

        {/* Hero amount */}
        <div style={{ fontSize: '12px', color: pal.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{isIncoming ? 'Received' : isOutgoing ? 'Sent' : 'Amount'}</div>
        <div style={{ fontSize: '34px', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', color: amountColor }}>
          {amountSign}{txValueEth} {tx.tokenSymbol || nativeCurrency}
        </div>
        <div style={{ fontSize: '15px', color: pal.muted, marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
          ${txValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>

        <div style={{ height: '1px', background: pal.faint, margin: '22px 0' }} />

        {/* Detail rows */}
        {([
          ['To', tx.to ? formatAddress(tx.to) : 'Contract Creation', false],
          ['From', formatAddress(tx.from), false],
          ['Network', chainConfig.name, false],
          ['Method', tx.methodName || 'Transfer', true],
          ['Gas fee', `$${gasFeeUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, false],
          ['Date', formatDate(tx.timeStamp), false],
        ] as [string, string, boolean][]).map(([label, value, mono]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: '13.5px' }}>
            <span style={{ color: pal.muted }}>{label}</span>
            <span style={{ fontWeight: 600, fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit', fontVariantNumeric: 'tabular-nums', maxWidth: '62%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
          </div>
        ))}

        {/* Total */}
        <div style={{ height: '1px', background: pal.faint, margin: '16px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '22px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Total</span>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: '19px', fontFamily: "'Space Grotesk', sans-serif", color: pal.accent, fontVariantNumeric: 'tabular-nums' }}>
              ${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '12px', color: pal.muted, fontVariantNumeric: 'tabular-nums' }}>{totalEth} {nativeCurrency}</div>
          </div>
        </div>

        {/* QR + hash footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '13px', paddingTop: '18px', borderTop: `1px solid ${pal.faint}` }}>
          {renderQrCode(pal.qrBorder, 62)}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '10px', color: pal.muted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '4px' }}>Transaction Hash</div>
            <div style={{ fontSize: '10.5px', fontFamily: "'JetBrains Mono', monospace", color: pal.text, wordBreak: 'break-all', lineHeight: 1.45 }}>{tx.hash}</div>
            <div style={{ fontSize: '10.5px', color: pal.footer, marginTop: '7px' }}>Verified on-chain · Block #{tx.blockNumber}</div>
          </div>
        </div>

        {/* Unique verification barcode */}
        <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
          <div style={{ display: 'flex', height: '32px', width: '100%', gap: '2px', alignItems: 'stretch' }}>
            {barcode.map((b, i) => (
              <div key={i} style={{ flex: b.w, background: b.filled ? pal.text : 'transparent' }} />
            ))}
          </div>
          <span style={{ fontSize: '9.5px', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.22em', color: pal.muted }}>
            *{tx.hash.substring(2, 18).toUpperCase()}*
          </span>
        </div>
        </div>
      </div>
    </div>
    </>
  );
}

'use client';

import React, { useRef } from 'react';
import { X, Copy, Check, CheckCircle, Download, Sun, Moon, ArrowDownRight, ArrowUpRight, ExternalLink } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Transaction } from '../utils/types';
import { formatDate, formatWei, CHAINS, formatAddress, ChainId } from '../utils/ethereum';
import * as htmlToImage from 'html-to-image';
import { FioMark } from './Logo';

interface ReceiptModalProps {
  tx: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
  nativePrice: number; // Native asset price in USD (ETH or POL/MATIC)
  activeAddress?: string | null; // viewed address — used to show send/receive direction
  theme?: 'dark' | 'light'; // app theme — drives the on-screen receipt palette
}

const getReceiptFunMessage = (chainId: ChainId, isSuccess: boolean): string => {
  if (isSuccess) {
    switch (chainId) {
      case 'ethereum':
        return 'Ultra Sound Money — gas burned, block secured.';
      case 'base':
        return 'Based and on-chain — secured on the Superchain.';
      case 'polygon':
        return 'Polygon speedrun — gas cheaper than a stick of gum.';
      case 'sepolia':
        return 'Testnet tokens cycled. No real ETH was harmed.';
      case 'solana':
        return 'Blink and you missed it — speed of light execution.';
      case 'bitcoin':
        return 'Stacking sats. Built on digital gold.';
      default:
        return 'Transaction verified — safe & secure on-chain.';
    }
  } else {
    switch (chainId) {
      case 'ethereum':
        return 'Out of gas — execution reverted.';
      case 'base':
        return 'Reverted on Base — the call failed.';
      case 'polygon':
        return 'Checkpoint missed — the transaction reverted.';
      case 'sepolia':
        return 'Sepolia faucet exhausted — try again tomorrow.';
      case 'solana':
        return 'Transaction dropped — network congestion.';
      case 'bitcoin':
        return 'Rejected — mempool congestion.';
      default:
        return 'Execution reverted — the call failed.';
    }
  }
};

// Concrete-colour palette (no CSS variables) so the SAME receipt renders
// identically on-screen and through html-to-image rasterization for export.
type Pal = ReturnType<typeof makePalette>;
function makePalette(mode: 'dark' | 'light') {
  return mode === 'dark'
    ? {
        shell: '#0c0f16', shellBody: '#090b11',
        card: '#11151e', edge: 'rgba(255,255,255,0.08)',
        text: '#f3f6fb', muted: '#94a1b7', faint: 'rgba(255,255,255,0.08)', inset: 'rgba(255,255,255,0.035)',
        accent: '#5b9bff', accentSoft: 'rgba(91,155,255,0.14)',
        okText: '#34d399', okBg: 'rgba(16,185,129,0.16)', failText: '#f87171', failBg: 'rgba(239,68,68,0.16)',
        incoming: '#34d399', qrFg: '#0a0e1a', qrBg: '#ffffff',
      }
    : {
        shell: '#ffffff', shellBody: '#eef2f8',
        card: '#ffffff', edge: 'rgba(11,18,32,0.10)',
        text: '#0b1220', muted: '#5b6b85', faint: 'rgba(11,18,32,0.09)', inset: 'rgba(11,18,32,0.025)',
        accent: '#1d4ed8', accentSoft: 'rgba(29,78,216,0.10)',
        okText: '#059669', okBg: 'rgba(16,185,129,0.12)', failText: '#dc2626', failBg: 'rgba(239,68,68,0.12)',
        incoming: '#059669', qrFg: '#0a0e1a', qrBg: '#ffffff',
      };
}

export function ReceiptModal({ tx, isOpen, onClose, nativePrice, activeAddress, theme = 'dark' }: ReceiptModalProps) {
  const [copiedFrom, setCopiedFrom] = React.useState(false);
  const [copiedTo, setCopiedTo] = React.useState(false);
  const [copiedHash, setCopiedHash] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [isExportingPdf, setIsExportingPdf] = React.useState(false);
  const [exportTheme, setExportTheme] = React.useState<'light' | 'dark'>(theme === 'dark' ? 'dark' : 'light');

  const receiptExportRef = useRef<HTMLDivElement>(null);

  // Default the downloaded receipt's theme to match the app theme (what you see
  // is what you download); the footer toggle can still override it per download.
  React.useEffect(() => {
    if (isOpen) setExportTheme(theme === 'dark' ? 'dark' : 'light');
  }, [isOpen, theme]);

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

  // Total cost (value + gas fee)
  const totalEth = (parseFloat(txValueEth) + parseFloat(gasFeeEth)).toFixed(6);
  const totalUsd = txValueUsd + gasFeeUsd;

  const isSuccess = tx.txreceipt_status === '1' && tx.isError === '0';

  // Direction relative to the viewed address (for the +/- amount sign)
  const viewedAddr = (activeAddress || '').toLowerCase();
  const isIncoming = !!viewedAddr && tx.to?.toLowerCase() === viewedAddr;
  const isOutgoing = !!viewedAddr && tx.from.toLowerCase() === viewedAddr;
  const amountSign = isIncoming ? '+' : isOutgoing ? '−' : '';

  // Real, scannable verification target — the canonical block-explorer tx page.
  const verifyUrl = `${chainConfig.explorerUrl}/tx/${tx.hash}`;

  const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Chain-specific gas labels
  let gasUsedLabel = 'Gas used';
  let gasUsedVal = `${parseInt(tx.gasUsed).toLocaleString()} units`;
  let feeLabel = 'Network fee';
  if (tx.chain === 'solana') {
    gasUsedLabel = 'Compute units';
    gasUsedVal = `${parseInt(tx.gasUsed).toLocaleString()} CU`;
    feeLabel = 'Network fee';
  } else if (tx.chain === 'bitcoin') {
    gasUsedLabel = 'Tx size';
    gasUsedVal = `${parseInt(tx.gasUsed).toLocaleString()} vB`;
    feeLabel = 'Miner fee';
  }

  // `exportPal` (the Light/Dark toggle) themes BOTH the on-screen receipt preview
  // and the downloaded copy so they always match (WYSIWYG). `chromePal` (the app
  // theme) themes only the surrounding modal frame.
  const exportPal = makePalette(exportTheme);
  const chromePal = makePalette(theme === 'light' ? 'light' : 'dark');

  const copyToClipboard = (text: string, type: 'from' | 'to' | 'hash') => {
    navigator.clipboard.writeText(text);
    if (type === 'from') {
      setCopiedFrom(true);
      setTimeout(() => setCopiedFrom(false), 2000);
    } else if (type === 'to') {
      setCopiedTo(true);
      setTimeout(() => setCopiedTo(false), 2000);
    } else {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const handleDownloadJpeg = async () => {
    const node = receiptExportRef.current;
    if (!node) return;
    setIsExporting(true);
    try {
      if (document.fonts?.ready) await document.fonts.ready;
      const dataUrl = await htmlToImage.toJpeg(node, { quality: 0.98, pixelRatio: 2, backgroundColor: exportPal.card });
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
      const dataUrl = await htmlToImage.toPng(node, { pixelRatio: 2, backgroundColor: exportPal.card });
      const width = node.offsetWidth;
      const height = node.offsetHeight;
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: width > height ? 'l' : 'p', unit: 'pt', format: [width, height] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, width, height);
      pdf.save(`tx-receipt-${tx.hash.substring(0, 8)}.pdf`);
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      alert('Failed to generate PDF receipt.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // ── The premium fintech receipt — one component, rendered on-screen and into
  //    the JPEG/PDF export, so the download is pixel-identical to what's shown. ──
  const renderReceipt = (p: Pal, opts: { width: number | string; interactive: boolean }) => {
    const { interactive } = opts;

    const copyBtn = (type: 'from' | 'to' | 'hash', state: boolean) => {
      if (!interactive) return null;
      const text = type === 'from' ? tx.from : type === 'to' ? (tx.to || '') : tx.hash;
      return (
        <button
          onClick={(e) => { e.preventDefault(); copyToClipboard(text, type); }}
          style={{ background: 'transparent', border: 0, padding: 0, marginLeft: 2, cursor: 'pointer', color: p.muted, display: 'inline-flex' }}
          aria-label={`Copy ${type}`}
        >
          {state ? <Check size={12} color={p.okText} /> : <Copy size={12} />}
        </button>
      );
    };

    const Row = (label: string, value: React.ReactNode, o: { mono?: boolean; copy?: 'from' | 'to'; state?: boolean } = {}) => (
      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', fontSize: 13 }}>
        <span style={{ color: p.muted }}>{label}</span>
        <span style={{ fontWeight: 600, fontFamily: o.mono ? "'JetBrains Mono', monospace" : 'inherit', fontVariantNumeric: 'tabular-nums', maxWidth: '64%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
          {value}{o.copy ? copyBtn(o.copy, !!o.state) : null}
        </span>
      </div>
    );

    return (
      <div style={{ width: opts.width, boxSizing: 'border-box', background: p.card, color: p.text, fontFamily: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, sans-serif", border: `1px solid ${p.edge}`, borderRadius: 20, overflow: 'hidden', boxShadow: interactive ? '0 18px 50px -12px rgba(0,0,0,0.45)' : 'none' }}>
        {/* accent hairline */}
        <div style={{ height: 3, background: `linear-gradient(90deg, ${p.accent}, ${p.accent}00)` }} />

        <div style={{ padding: '22px 24px 18px' }}>
          {/* brand + status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FioMark size={32} gradId={interactive ? 'fioMarkScreen' : 'fioMarkExport'} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.01em', lineHeight: 1.1 }}>Fio</div>
                <div style={{ fontSize: 10.5, color: p.muted, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Transaction Receipt</div>
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '5px 11px', borderRadius: 9999, background: isSuccess ? p.okBg : p.failBg, color: isSuccess ? p.okText : p.failText }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: isSuccess ? p.okText : p.failText, display: 'inline-block' }} />
              {isSuccess ? 'Confirmed' : 'Failed'}
            </span>
          </div>

          {/* hero amount */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: p.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            {isIncoming ? <ArrowDownRight size={13} color={p.incoming} /> : isOutgoing ? <ArrowUpRight size={13} /> : null}
            {isIncoming ? 'Received' : isOutgoing ? 'Sent' : 'Amount'}
          </div>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.04, fontVariantNumeric: 'tabular-nums', color: isIncoming ? p.incoming : p.text }}>
            {amountSign}{txValueEth} {tx.tokenSymbol || nativeCurrency}
          </div>
          <div style={{ fontSize: 14.5, color: p.muted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{usd(txValueUsd)}</div>

          {/* itemized rows */}
          <div style={{ height: 1, background: p.faint, margin: '20px 0 4px' }} />
          {Row('To', tx.to ? formatAddress(tx.to) : 'Contract creation', { mono: true, copy: tx.to ? 'to' : undefined, state: copiedTo })}
          {Row('From', formatAddress(tx.from), { mono: true, copy: 'from', state: copiedFrom })}
          {Row('Network', chainConfig.name)}
          {Row('Method', tx.methodName || 'Transfer', { mono: true })}
          {Row(gasUsedLabel, gasUsedVal)}
          {Row(feeLabel, usd(gasFeeUsd))}
          {Row('Date', formatDate(tx.timeStamp))}

          {/* total */}
          <div style={{ height: 1, background: p.faint, margin: '6px 0 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Total</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, fontSize: 21, letterSpacing: '-0.01em', color: p.accent, fontVariantNumeric: 'tabular-nums' }}>{usd(totalUsd)}</div>
              <div style={{ fontSize: 11.5, color: p.muted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{totalEth} {nativeCurrency} · incl. gas {usd(gasFeeUsd)}</div>
            </div>
          </div>
        </div>

        {/* verification block — the scannable QR */}
        <div style={{ background: p.inset, borderTop: `1px solid ${p.faint}`, padding: '18px 24px' }}>
          <div style={{ display: 'flex', gap: 15, alignItems: 'center' }}>
            {interactive ? (
              <a href={verifyUrl} target="_blank" rel="noopener noreferrer" title={`Verify on ${chainConfig.name} Explorer`} style={{ lineHeight: 0, flexShrink: 0 }}>
                <span style={{ display: 'inline-block', background: p.qrBg, padding: 9, borderRadius: 12, boxShadow: '0 2px 10px rgba(0,0,0,0.16)' }}>
                  <QRCodeSVG value={verifyUrl} size={78} level="M" marginSize={2} bgColor={p.qrBg} fgColor={p.qrFg} />
                </span>
              </a>
            ) : (
              <span style={{ display: 'inline-block', background: p.qrBg, padding: 9, borderRadius: 12, flexShrink: 0 }}>
                <QRCodeSVG value={verifyUrl} size={78} level="M" marginSize={2} bgColor={p.qrBg} fgColor={p.qrFg} />
              </span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700 }}>
                <CheckCircle size={14} color={p.accent} /> Scan to verify on-chain
              </div>
              <div style={{ fontSize: 11, color: p.muted, marginTop: 3 }}>{chainConfig.name} · Block #{tx.blockNumber}</div>
              <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono', monospace", color: p.text, wordBreak: 'break-all', lineHeight: 1.5, marginTop: 6 }}>{tx.hash}</div>
              {interactive && (
                <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                  <button onClick={() => copyToClipboard(tx.hash, 'hash')} style={{ background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: p.accent, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                    {copiedHash ? <Check size={12} /> : <Copy size={12} />} {copiedHash ? 'Copied' : 'Copy hash'}
                  </button>
                  <a href={verifyUrl} target="_blank" rel="noopener noreferrer" style={{ color: p.accent, fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <ExternalLink size={12} /> Open explorer
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* footer note */}
        <div style={{ borderTop: `1px solid ${p.faint}`, padding: '12px 24px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 10.5, color: p.muted, letterSpacing: '0.02em' }}>
            Receipt #{tx.hash.substring(2, 10).toUpperCase()} · Generated from public ledger records
          </div>
          <div style={{ fontSize: 11, color: p.muted, marginTop: 4, fontStyle: 'italic' }}>{getReceiptFunMessage(tx.chain, isSuccess)}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div id="receipt-modal-overlay" className="modal-overlay" onClick={onClose}>
        <div
          id="receipt-modal-content"
          className="modal-content receipt-fintech-modal"
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', flexDirection: 'column', background: chromePal.shell }}
        >
          {/* slim header */}
          <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: chromePal.muted, fontFamily: "'Hanken Grotesk', sans-serif" }}>
              Receipt
            </span>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '0.25rem', color: chromePal.muted, display: 'inline-flex' }}
              className="btn-close"
              aria-label="Close receipt"
            >
              <X size={20} />
            </button>
          </div>

          {/* the receipt (on-screen) */}
          <div className="modal-body" style={{ background: chromePal.shellBody }}>
            {renderReceipt(exportPal, { width: '100%', interactive: true })}
          </div>

          {/* controls (hidden on print) */}
          <div className="modal-footer" style={{ background: chromePal.shellBody }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginRight: 'auto' }} title="Theme of the downloaded receipt">
              <span style={{ fontSize: '0.68rem', fontWeight: 700, color: chromePal.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Download</span>
              <div style={{ display: 'inline-flex', border: `1px solid ${chromePal.edge}`, borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setExportTheme('light')}
                  aria-pressed={exportTheme === 'light'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: exportTheme === 'light' ? 'var(--accent-gradient)' : 'transparent', color: exportTheme === 'light' ? 'var(--accent-btn-text)' : chromePal.muted }}
                >
                  <Sun size={13} /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setExportTheme('dark')}
                  aria-pressed={exportTheme === 'dark'}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.6rem', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', border: 'none', background: exportTheme === 'dark' ? 'var(--accent-gradient)' : 'transparent', color: exportTheme === 'dark' ? 'var(--accent-btn-text)' : chromePal.muted }}
                >
                  <Moon size={13} /> Dark
                </button>
              </div>
            </div>
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
            <button className="btn btn-secondary" onClick={handleDownloadJpeg} disabled={isExporting} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={16} /> {isExporting ? 'Exporting…' : 'JPEG'}
            </button>
            <button className="btn btn-primary" onClick={handleDownloadPdf} disabled={isExportingPdf} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Download size={16} /> {isExportingPdf ? 'Exporting…' : 'PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Off-screen render — the source rasterized into the JPEG/PDF (identical component) ── */}
      <div className="receipt-jpeg-source" aria-hidden="true" style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <div ref={receiptExportRef}>
          {renderReceipt(exportPal, { width: 420, interactive: false })}
        </div>
      </div>
    </>
  );
}

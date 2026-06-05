'use client';

import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { Connector } from 'wagmi';
import { ChainFamily, getWalletOptions } from '../utils/walletConnectors';

interface WalletPickerProps {
  open: boolean;
  family: ChainFamily;
  evmConnectors: readonly Connector[];
  onEvmConnect: (connector: Connector) => void;
  onAddress: (address: string) => void;
  onClose: () => void;
}

const FAMILY_LABEL: Record<ChainFamily, string> = { evm: 'an EVM', solana: 'a Solana', bitcoin: 'a Bitcoin' };

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '0.7rem 0.9rem',
  borderRadius: '10px',
  border: '1px solid var(--glass-border)',
  background: 'rgba(127,127,127,0.04)',
};

export function WalletPicker({ open, family, evmConnectors, onEvmConnect, onAddress, onClose }: WalletPickerProps) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');

  if (!open) return null;

  const hasEthereum = typeof window !== 'undefined' && 'ethereum' in window;

  const handleNonEvm = async (id: string, connect: () => Promise<string>) => {
    setError('');
    setBusy(id);
    try {
      const address = await connect();
      onAddress(address);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 384, display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Connect {FAMILY_LABEL[family]} wallet</h3>
          <button onClick={onClose} className="btn-close" aria-label="Close" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {family === 'evm' ? (
            hasEthereum && evmConnectors.length > 0 ? (
              evmConnectors.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => { onEvmConnect(c); onClose(); }}
                  style={{ ...rowStyle, cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)', justifyContent: 'flex-start', gap: '0.6rem' }}
                >
                  {c.icon && <img src={c.icon} alt="" width={20} height={20} style={{ borderRadius: 4 }} />}
                  {c.name}
                </button>
              ))
            ) : (
              <div style={rowStyle}>
                <span style={{ fontWeight: 600 }}>No EVM wallet detected</span>
                <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}>
                  <ExternalLink size={13} /> Install MetaMask
                </a>
              </div>
            )
          ) : (
            getWalletOptions(family).map((w) => {
              const installed = w.isInstalled();
              return (
                <div key={w.id} style={rowStyle}>
                  <span style={{ fontWeight: 600 }}>
                    {w.name}
                    {installed && <span style={{ marginLeft: 8, fontSize: '0.7rem', color: 'var(--status-success)' }}>Detected</span>}
                  </span>
                  {installed ? (
                    <button onClick={() => handleNonEvm(w.id, w.connect)} disabled={!!busy} className="btn btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}>
                      {busy === w.id ? 'Connecting…' : 'Connect'}
                    </button>
                  ) : (
                    <a href={w.installUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}>
                      <ExternalLink size={13} /> Install
                    </a>
                  )}
                </div>
              );
            })
          )}

          {error && <span style={{ fontSize: '0.82rem', color: 'var(--status-error)' }}>{error}</span>}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Or close this and paste any address to scan it.
          </p>
        </div>
      </div>
    </div>
  );
}

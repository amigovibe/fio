'use client';

import React, { useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Wallet, LogOut, Search, Loader2 } from 'lucide-react';
import { formatAddress } from '../utils/ethereum';

import { ChainId } from '../utils/ethereum';

interface WalletConnectProps {
  onSearchAddress: (address: string) => void;
  isLoading: boolean;
  activeAddress: string | null;
  selectedChain: ChainId;
}

export function WalletConnect({
  onSearchAddress,
  isLoading,
  activeAddress,
  selectedChain,
}: WalletConnectProps) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
 
  // Handle wallet connection trigger
  const handleConnect = () => {
    // Connect using the first injected wallet connector (typically MetaMask).
    const injected = connectors.find((c) => c.id === 'injected') || connectors[0];
    const hasProvider = typeof window !== 'undefined' && 'ethereum' in window;
    if (injected && hasProvider) {
      setSearchError('');
      connect({ connector: injected });
    } else {
      setSearchError('No Web3 wallet detected. Install MetaMask (or another EVM wallet), or paste any address above to scan it.');
    }
  };
 
  // Handle manual address lookup search
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError('');
    
    const cleanAddress = searchInput.trim();
    if (!cleanAddress) return;
 
    if (selectedChain === 'solana') {
      const isSolAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress);
      if (!isSolAddress) {
        setSearchError('Invalid Solana address format (must be a Base58 string of 32-44 characters).');
        return;
      }
    } else if (selectedChain === 'bitcoin') {
      const isBtcAddress = /^(1|3|bc1)[a-zA-HJ-NP-Za-km-z0-9]{25,62}$/i.test(cleanAddress);
      if (!isBtcAddress) {
        setSearchError('Invalid Bitcoin address format (must start with 1, 3, or bc1).');
        return;
      }
    } else {
      const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(cleanAddress);
      if (!isEthAddress) {
        setSearchError('Invalid Ethereum/EVM address format (must start with 0x and be 42 characters).');
        return;
      }
    }
 
    onSearchAddress(cleanAddress);
  };

  // Sync state if wallet connects/disconnects
  React.useEffect(() => {
    if (isConnected && address && activeAddress !== address) {
      onSearchAddress(address);
    }
  }, [isConnected, address, activeAddress, onSearchAddress]);
 
  const getPlaceholder = () => {
    switch (selectedChain) {
      case 'solana':
        return 'Scan receipts for Solana address (Base58...)';
      case 'bitcoin':
        return 'Scan receipts for Bitcoin address (1, 3, or bc1...)';
      case 'base':
        return 'Scan receipts for Base address (0x...)';
      case 'polygon':
        return 'Scan receipts for Polygon address (0x...)';
      case 'sepolia':
        return 'Scan receipts for Sepolia testnet address (0x...)';
      default:
        return 'Scan receipts for Ethereum address (0x...)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Wallet Connection Status */}
      <div className="glass-panel wallet-status-row" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <div>
          {isConnected && address ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--status-success)', boxShadow: '0 0 10px var(--status-success)' }}></div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Wallet Connected</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                  {formatAddress(address)}
                </div>
              </div>
            </div>
          ) : activeAddress ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)', boxShadow: '0 0 10px var(--accent-cyan)' }}></div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Custom Search Address</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif' }}>
                  {formatAddress(activeAddress)}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--text-muted)' }}></div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-secondary)' }}>
                  Wallet Disconnected
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isConnected ? (
            <button className="btn btn-secondary" onClick={() => disconnect()}>
              <LogOut size={16} /> Disconnect
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleConnect}>
              <Wallet size={16} /> Connect Wallet
            </button>
          )}
        </div>
      </div>
 
      {/* Address Search Bar */}
      <div className="glass-panel" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '0.75rem',
        maxWidth: '720px',
        width: '100%',
        margin: '0 auto',
        boxShadow: searchFocused ? '0 0 25px var(--accent-cyan-glow), var(--glass-shadow)' : 'var(--glass-shadow)',
        borderColor: searchFocused ? 'var(--accent-cyan)' : 'var(--glass-border)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        <form onSubmit={handleSearchSubmit} className="wallet-search-form" style={{ display: 'flex', gap: '0.75rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              className="input-field"
              placeholder={getPlaceholder()}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{ paddingLeft: '2.5rem' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={isLoading} style={{ minWidth: '120px' }}>
            {isLoading ? <Loader2 size={16} className="spinner" /> : 'Scan Address'}
          </button>
        </form>
        {searchError && (
          <span style={{ fontSize: '0.8rem', color: 'var(--status-error)', fontWeight: 500 }}>
            {searchError}
          </span>
        )}
      </div>
    </div>
  );
}

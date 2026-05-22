'use client';

import React, { useState, useEffect } from 'react';
import { WalletConnect } from '../components/WalletConnect';
import { Dashboard } from '../components/Dashboard';
import { TransactionList } from '../components/TransactionList';
import { ReceiptModal } from '../components/ReceiptModal';
import { useConnect } from 'wagmi';
import { Transaction } from '../utils/types';
import { fetchTransactions, fetchLivePrices, ChainId, CHAINS } from '../utils/ethereum';
import { FileText, Settings, ShieldAlert, Sparkles, RefreshCw, Key, Sun, Moon, Wallet } from 'lucide-react';
import { LiveTicker } from '../components/LiveTicker';

export default function Home() {
  const [activeAddress, setActiveAddress] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Scans settings
  const [selectedChain, setSelectedChain] = useState<ChainId>('ethereum');
  const [apiKeys, setApiKeys] = useState<Record<ChainId, string>>({
    ethereum: '',
    polygon: '',
    sepolia: '',
    solana: '',
    bitcoin: '',
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Prices
  const [nativePrices, setNativePrices] = useState({ ethereum: 3100.0, polygon: 0.72, solana: 150.0, bitcoin: 65000.0 });
  
  // Modal selection
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Wallet connection (used by the welcome-screen CTA)
  const { connect, connectors } = useConnect();

  const handleConnectWallet = () => {
    const injected = connectors.find((c) => c.id === 'injected') || connectors[0];
    if (injected) {
      connect({ connector: injected });
    } else {
      alert('No Web3 wallet extension detected. Paste any address in the search bar to scan it.');
    }
  };

  // Load API keys from localStorage on mount, fetch live prices & initialize theme
  useEffect(() => {
    const keys = ['ethereum', 'polygon', 'sepolia', 'solana', 'bitcoin'] as ChainId[];
    const loadedKeys = { ...apiKeys };
    keys.forEach((chain) => {
      const stored = localStorage.getItem(`w3r_api_key_${chain}`);
      if (stored) loadedKeys[chain] = stored;
    });
    setApiKeys(loadedKeys);

    const loadPrices = async () => {
      const prices = await fetchLivePrices();
      setNativePrices(prices);
    };
    loadPrices();

    const storedTheme = localStorage.getItem('txreceipts_theme') as 'dark' | 'light';
    if (storedTheme) {
      setTheme(storedTheme);
      document.documentElement.setAttribute('data-theme', storedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    
    // Disable CSS transitions during theme toggle
    document.documentElement.classList.add('theme-toggling');
    
    setTheme(nextTheme);
    localStorage.setItem('txreceipts_theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    
    // Force DOM reflow to make the transition immediate
    const _ = document.documentElement.offsetHeight;
    
    // Re-enable CSS transitions
    requestAnimationFrame(() => {
      document.documentElement.classList.remove('theme-toggling');
    });
  };

  // Fetch transactions when the active address or chain changes
  useEffect(() => {
    if (!activeAddress) {
      setTransactions([]);
      return;
    }

    const loadRealTransactions = async () => {
      setIsLoading(true);
      setErrorMsg('');
      try {
        const key = apiKeys[selectedChain];
        const txs = await fetchTransactions(activeAddress, selectedChain, key);
        setTransactions(txs);
      } catch (err: any) {
        setTransactions([]);
        const msg = err.message || 'Could not fetch transactions. Please verify API keys or try again.';
        setErrorMsg(msg);
        
        // Auto-expand settings drawer if it's an API key error
        if (
          msg.includes('API Key') || 
          msg.includes('API key') || 
          msg.includes('apikey') || 
          msg.includes('Helius API Key')
        ) {
          setShowSettings(true);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadRealTransactions();
  }, [activeAddress, selectedChain, apiKeys]);

  // Handle address selected from sub-components
  const handleAddressSelect = (address: string) => {
    setActiveAddress(address);
  };

  // Handle chain changed from header selector
  const handleChainChange = (chain: ChainId) => {
    setSelectedChain(chain);
    setActiveAddress(null);
    setTransactions([]);
  };

  // Save API keys to storage
  const handleSaveApiKey = (chain: ChainId, val: string) => {
    const updated = { ...apiKeys, [chain]: val };
    setApiKeys(updated);
    if (val) {
      localStorage.setItem(`w3r_api_key_${chain}`, val);
    } else {
      localStorage.removeItem(`w3r_api_key_${chain}`);
    }
  };

  // Select transaction to view receipt
  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTx(tx);
    setIsReceiptOpen(true);
  };

  const currentNativePrice = 
    selectedChain === 'polygon' ? nativePrices.polygon :
    selectedChain === 'solana' ? nativePrices.solana :
    selectedChain === 'bitcoin' ? nativePrices.bitcoin :
    nativePrices.ethereum;

  return (
    <>
      {/* Smooth hardware-accelerated background glows */}
      <div className="bg-glow-container">
        <div className="bg-glow bg-glow-1"></div>
        <div className="bg-glow bg-glow-2"></div>
      </div>

      {/* Real-time BTC/ETH/SOL Price and multi-chain gas Ticker */}
      <LiveTicker />

      <div className="app-container">
        {/* App Header */}
        <header className="header">
        <div className="logo-container">
          <div className="logo-icon">TX</div>
          <div>
            <h1 className="logo-text">TxReceipts</h1>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Ledger Accounting Hub <span className="logo-badge">v1.0</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }} className="dashboard-controls">
          {/* Chain Selector */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <select
              value={selectedChain}
              onChange={(e) => handleChainChange(e.target.value as ChainId)}
              className="input-field"
              style={{ paddingRight: '2rem', height: '42px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              {Object.entries(CHAINS).map(([id, config]) => (
                <option key={id} value={id}>
                  {config.name} ({config.nativeCurrency})
                </option>
              ))}
            </select>
          </div>

          {/* Theme Toggle */}
          <button 
            className="btn btn-secondary" 
            onClick={toggleTheme}
            style={{ 
              height: '42px', 
              padding: '0 0.85rem',
              borderColor: 'var(--glass-border)',
              background: 'rgba(255,255,255,0.01)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} color="var(--accent-cyan)" /> : <Moon size={18} color="var(--accent-purple)" />}
          </button>

          {/* Settings Toggle */}
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowSettings(!showSettings)}
            style={{ 
              height: '42px', 
              padding: '0 0.85rem',
              borderColor: showSettings ? 'var(--accent-cyan)' : 'var(--glass-border)',
              background: showSettings ? 'var(--accent-cyan-glow)' : 'rgba(255,255,255,0.02)'
            }}
          >
            <Settings size={18} color={showSettings ? 'var(--accent-cyan)' : 'currentColor'} />
          </button>
        </div>
      </header>

      {/* Settings Drawer Panel */}
      {showSettings && (
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', border: '1px solid var(--accent-cyan)', background: 'var(--accent-cyan-glow)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', color: 'var(--accent-cyan)' }}>
            <Key size={16} /> Block Explorer API Settings
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            By default, we fetch records using public explorer services. These endpoints are heavily rate-limited.
            To scan transactions smoothly, please insert your personal free-tier API keys below. They are saved strictly in local browser storage.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }} className="dashboard-grid">
            {(['ethereum', 'polygon', 'sepolia', 'solana'] as ChainId[]).map((chain) => {
              const hasError = chain === selectedChain && errorMsg && (
                errorMsg.includes('API Key') || 
                errorMsg.includes('API key') || 
                errorMsg.includes('apikey') || 
                errorMsg.includes('Helius API Key')
              );
              return (
                <div key={chain} className="form-group">
                  <label className="form-label" style={{ fontSize: '0.75rem', color: hasError ? 'var(--status-error)' : 'currentColor', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{CHAINS[chain].name} API Key</span>
                    {hasError && <span style={{ color: 'var(--status-error)', fontSize: '0.7rem', fontWeight: 600 }}>Key Required / Invalid</span>}
                  </label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder={`Insert ${CHAINS[chain].name} API Key`}
                    value={apiKeys[chain]}
                    onChange={(e) => handleSaveApiKey(chain, e.target.value)}
                    style={{ 
                      fontSize: '0.85rem',
                      borderColor: hasError ? 'var(--status-error)' : 'var(--glass-border)',
                      boxShadow: hasError ? '0 0 0 1px var(--status-error)' : 'none',
                      background: hasError ? 'rgba(239, 68, 68, 0.02)' : 'rgba(255, 255, 255, 0.01)'
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Wallet / Scan panel */}
      <WalletConnect
        onSearchAddress={handleAddressSelect}
        isLoading={isLoading}
        activeAddress={activeAddress}
        selectedChain={selectedChain}
      />

      {/* Error state */}
      {errorMsg && (
        <div className="glass-panel" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', border: '1px solid var(--status-error)', background: 'var(--status-error-bg)' }}>
          <ShieldAlert size={20} color="var(--status-error)" style={{ marginTop: '0.15rem' }} />
          <div>
            <h5 style={{ color: 'var(--status-error)', fontSize: '0.95rem' }}>Scan Execution Error</h5>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{errorMsg}</p>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => handleAddressSelect(activeAddress || '')}>
                <RefreshCw size={12} /> Retry Scan
              </button>
              <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => setShowSettings(true)}>
                Add API Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '1rem' }}>
          <RefreshCw size={36} className="spinner" />
          <div style={{ textAlign: 'center' }}>
            <h4 style={{ fontSize: '1rem', fontFamily: 'Space Grotesk' }}>Scanning Ledger Node...</h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Retrieving transactions list and calculating gas indices.</span>
          </div>
        </div>
      ) : activeAddress && transactions.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Dashboard Metrics */}
          <Dashboard 
            transactions={transactions} 
            activeAddress={activeAddress} 
            nativePrice={currentNativePrice} 
          />

          {/* Transactions List */}
          <TransactionList
            transactions={transactions}
            activeAddress={activeAddress}
            onSelectTransaction={handleSelectTransaction}
            nativePrice={currentNativePrice}
          />
        </div>
      ) : (
        /* Welcome Hero Screen */
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '4rem 2rem', gap: '1.5rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px var(--accent-cyan-glow)' }}>
            <FileText size={32} color="var(--bg-primary)" />
          </div>
          
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent-cyan)', background: 'var(--accent-cyan-glow)', border: '1px solid var(--glass-border)', padding: '0.3rem 0.7rem', borderRadius: '9999px', marginBottom: '1.1rem' }}>
              <Sparkles size={13} /> On-chain accounting, simplified
            </div>
            <h2 style={{ fontSize: '2.4rem', lineHeight: 1.1, marginBottom: '0.75rem' }}>
              Welcome to{' '}
              <span style={{ background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                TxReceipts
              </span>
            </h2>
            <p style={{ maxWidth: '600px', color: 'var(--text-secondary)', fontSize: '1.02rem', lineHeight: 1.65, margin: '0 auto' }}>
              Connect your Ethereum wallet or search any ledger address to generate itemized, tax-compliant PDF invoices for smart contract executions, token swaps, and gas usage.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <button className="btn btn-primary" onClick={handleConnectWallet}>
              <Wallet size={16} /> Connect Wallet
            </button>
          </div>

          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '2rem', width: '100%', maxWidth: '700px' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <h5 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>1. Connect or Paste</h5>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Plug in your hot wallet or paste any ENS / public address to audit.</span>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <h5 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>2. Analyze Gas</h5>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Visualize fees spent in USD over history to optimize transaction timing.</span>
            </div>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <h5 style={{ color: 'var(--accent-cyan)', fontSize: '0.95rem' }}>3. Export Receipts</h5>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Click receipt icon to render a perfectly formatted print/PDF invoice.</span>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Receipt Modal Popup */}
      <ReceiptModal
        tx={selectedTx}
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setSelectedTx(null);
        }}
        nativePrice={currentNativePrice}
        activeAddress={activeAddress}
      />
    </div>
    </>
  );
}

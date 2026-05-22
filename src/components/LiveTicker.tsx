'use client';

import React, { useState, useEffect } from 'react';
import { Flame, TrendingUp } from 'lucide-react';

interface PriceState {
  price: number;
  dir: 'up' | 'down' | 'same';
  flash: 'up' | 'down' | '';
}

interface GasState {
  gwei: number;
  flash: 'up' | 'down' | '';
  loading: boolean;
}

export function LiveTicker() {
  const [prices, setPrices] = useState<Record<'btc' | 'eth' | 'sol', PriceState>>({
    btc: { price: 0, dir: 'same', flash: '' },
    eth: { price: 0, dir: 'same', flash: '' },
    sol: { price: 0, dir: 'same', flash: '' },
  });

  const [gas, setGas] = useState<GasState>({ gwei: 0, flash: '', loading: true });

  // Poll prices every 1 second
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const res = await fetch(
          'https://api.binance.com/api/v3/ticker/price?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22SOLUSDT%22%5D'
        );
        const data = await res.json();
        
        if (Array.isArray(data)) {
          const rawBtc = data.find((t: any) => t.symbol === 'BTCUSDT')?.price;
          const rawEth = data.find((t: any) => t.symbol === 'ETHUSDT')?.price;
          const rawSol = data.find((t: any) => t.symbol === 'SOLUSDT')?.price;

          setPrices((prev) => {
            const updateAsset = (
              key: 'btc' | 'eth' | 'sol',
              raw: string | undefined
            ): PriceState => {
              const prevVal = prev[key].price;
              const newVal = raw ? parseFloat(raw) : prevVal;
              if (prevVal === 0) return { price: newVal, dir: 'same', flash: '' };
              if (newVal > prevVal) return { price: newVal, dir: 'up', flash: 'up' };
              if (newVal < prevVal) return { price: newVal, dir: 'down', flash: 'down' };
              return { ...prev[key], price: newVal }; // keep existing flash direction
            };

            return {
              btc: updateAsset('btc', rawBtc),
              eth: updateAsset('eth', rawEth),
              sol: updateAsset('sol', rawSol),
            };
          });

          // Clear flash classes after animation completes
          setTimeout(() => {
            setPrices((curr) => ({
              btc: { ...curr.btc, flash: '' },
              eth: { ...curr.eth, flash: '' },
              sol: { ...curr.sol, flash: '' },
            }));
          }, 800);
        }
      } catch (err) {
        console.warn('Failed to fetch ticker price:', err);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 1000);
    return () => clearInterval(interval);
  }, []);

  // Helper to fetch the current Ethereum gas price (gwei) from an RPC node
  const fetchEthGasGwei = async (rpcUrl: string): Promise<number> => {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
    });
    const data = await res.json();
    if (data.result) {
      return Math.max(0.01, Math.round((Number(BigInt(data.result)) / 1e9) * 100) / 100);
    }
    throw new Error('No gas result');
  };

  // Poll the live Ethereum gas price every second
  useEffect(() => {
    const updateGas = async () => {
      let gwei: number | null = null;
      try {
        gwei = await fetchEthGasGwei('https://ethereum-rpc.publicnode.com');
      } catch {
        try {
          gwei = await fetchEthGasGwei('https://eth.drpc.org');
        } catch {
          gwei = null; // both nodes unreachable — hold the last known value
        }
      }

      setGas((prev) => {
        const next = gwei ?? (prev.gwei || 15);
        let flash: 'up' | 'down' | '' = '';
        if (prev.gwei !== 0 && next !== prev.gwei) {
          flash = next > prev.gwei ? 'up' : 'down';
        }
        return { gwei: next, flash, loading: false };
      });

      // Clear the flash highlight after the animation completes
      setTimeout(() => setGas((curr) => ({ ...curr, flash: '' })), 800);
    };

    updateGas();
    const interval = setInterval(updateGas, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (val: number) => {
    if (val === 0) return 'Loading...';
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="ticker-bar floating-pill">
      <div className="ticker-wrapper">
        {/* Realtime Market Prices */}
        <div className="ticker-section">
          <div className="ticker-section-title">
            <span className="glow-dot success pulse-dot" title="Network Synchronized" />
            <TrendingUp size={12} color="var(--accent-cyan)" style={{ marginLeft: '4px' }} />
            <span>REALTIME TICKER</span>
          </div>
          
          <div className="ticker-group">
            {/* BTC */}
            <div className="ticker-item">
              <span className="ticker-asset-badge btc">BTC</span>
              <span className={`ticker-price ${prices.btc.flash === 'up' ? 'flash-green' : prices.btc.flash === 'down' ? 'flash-red' : ''}`}>
                {formatPrice(prices.btc.price)}
              </span>
            </div>

            {/* ETH */}
            <div className="ticker-item">
              <span className="ticker-asset-badge eth">ETH</span>
              <span className={`ticker-price ${prices.eth.flash === 'up' ? 'flash-green' : prices.eth.flash === 'down' ? 'flash-red' : ''}`}>
                {formatPrice(prices.eth.price)}
              </span>
            </div>

            {/* SOL */}
            <div className="ticker-item">
              <span className="ticker-asset-badge sol">SOL</span>
              <span className={`ticker-price ${prices.sol.flash === 'up' ? 'flash-green' : prices.sol.flash === 'down' ? 'flash-red' : ''}`}>
                {formatPrice(prices.sol.price)}
              </span>
            </div>
          </div>
        </div>

        <div className="ticker-divider" />

        {/* Live Ethereum gas price — refreshes every second */}
        <div className="ticker-section">
          <div className="ticker-section-title">
            <Flame size={12} color="var(--accent-purple)" />
            <span>ETH GAS</span>
          </div>

          <div className="ticker-group">
            <div className="ticker-item">
              {gas.loading ? (
                <span className="ticker-loading-text">Syncing...</span>
              ) : (
                <span className={`ticker-gas-price ${gas.flash === 'up' ? 'flash-red' : gas.flash === 'down' ? 'flash-green' : ''}`}>
                  {gas.gwei.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="gas-unit"> Gwei</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

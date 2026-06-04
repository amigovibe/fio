'use client';

import React, { useState, useEffect } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Fuel, Percent, DollarSign } from 'lucide-react';
import { Transaction } from '../utils/types';
import { formatWei, CHAINS } from '../utils/ethereum';

interface DashboardProps {
  transactions: Transaction[];
  activeAddress: string;
  nativePrice: number;
}

export function Dashboard({ transactions, activeAddress, nativePrice }: DashboardProps) {
  const [mounted, setMounted] = useState(false);

  // Fix SSR hydration issues with Recharts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute metrics
  const metrics = React.useMemo(() => {
    if (transactions.length === 0) {
      return {
        totalGasEth: '0',
        totalGasUsd: 0,
        avgGasUsd: 0,
        successRate: 0,
        volumeUsd: 0,
      };
    }

    let totalGasWei = BigInt(0);
    let successCount = 0;
    let totalVolumeWei = BigInt(0);
    let outgoingCount = 0;

    transactions.forEach((tx) => {
      // 1. Gas cost calculation: gasUsed * gasPrice
      const gasCost = BigInt(tx.gasUsed) * BigInt(tx.gasPrice);
      totalGasWei += gasCost;

      // 2. Success rate
      const isSuccess = tx.txreceipt_status === '1' && tx.isError === '0';
      if (isSuccess) successCount++;

      // 3. Volume calculation (for outgoing value transfers)
      const isOutgoing = tx.from.toLowerCase() === activeAddress.toLowerCase();
      if (isOutgoing) {
        totalVolumeWei += BigInt(tx.value);
        outgoingCount++;
      }
    });

    const totalGasEth = formatWei(totalGasWei.toString(), 18);
    const totalGasUsd = parseFloat(totalGasEth) * nativePrice;

    const avgGasEth = transactions.length > 0 ? parseFloat(totalGasEth) / transactions.length : 0;
    const avgGasUsd = avgGasEth * nativePrice;

    const successRate = (successCount / transactions.length) * 100;

    const volumeEth = formatWei(totalVolumeWei.toString(), 18);
    const volumeUsd = parseFloat(volumeEth) * nativePrice;

    return {
      totalGasEth,
      totalGasUsd,
      avgGasUsd,
      successRate,
      volumeUsd,
    };
  }, [transactions, activeAddress, nativePrice]);

  // Sparkline data for the metric-card overlays (reverse to chronological order)
  const chartData = React.useMemo(() => {
    let runningSuccesses = 0;
    return [...transactions]
      .reverse()
      .map((tx, idx) => {
        const gasCostWei = BigInt(tx.gasUsed) * BigInt(tx.gasPrice);
        const gasCostEth = parseFloat(formatWei(gasCostWei.toString(), 18));
        const gasCostUsd = gasCostEth * nativePrice;

        const isSuccess = tx.txreceipt_status === '1' && tx.isError === '0';
        if (isSuccess) runningSuccesses++;
        const runningSuccessRate = ((runningSuccesses) / (idx + 1)) * 100;

        return {
          index: idx + 1,
          gasUsd: parseFloat(gasCostUsd.toFixed(2)),
          successRate: parseFloat(runningSuccessRate.toFixed(1)),
        };
      });
  }, [transactions, nativePrice]);

  return (
    <div className="dashboard-grid">
      {/* Total Gas Spent */}
      <div className="glass-panel interactive metric-card premium-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2 }}>
          <span className="metric-title">Total Gas Fees</span>
          <Fuel size={20} color="var(--accent-cyan)" />
        </div>
        <div className="metric-value" style={{ zIndex: 2, filter: 'drop-shadow(0 0 8px var(--accent-cyan-strong))' }}>
          ${metrics.totalGasUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="metric-subtitle" style={{ zIndex: 2 }}>
          {parseFloat(metrics.totalGasEth).toFixed(5)} {transactions[0]?.chain === 'polygon' ? 'POL' : 'ETH'}
        </div>
        {/* Sparkline chart overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45px', opacity: 0.3, pointerEvents: 'none', zIndex: 1 }}>
          {mounted && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGasSparkline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="gasUsd"
                  stroke="var(--accent-cyan)"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#totalGasSparkline)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Avg Fee per Transaction */}
      <div className="glass-panel interactive metric-card premium-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2 }}>
          <span className="metric-title">Avg Gas / Tx</span>
          <DollarSign size={20} color="var(--accent-purple)" />
        </div>
        <div className="metric-value" style={{
          background: 'var(--accent-gradient-alt)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          zIndex: 2,
          filter: 'drop-shadow(0 0 8px var(--accent-purple-strong))'
        }}>
          ${metrics.avgGasUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="metric-subtitle" style={{ zIndex: 2 }}>
          Across {transactions.length} scanned transactions
        </div>
        {/* Sparkline chart overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45px', opacity: 0.3, pointerEvents: 'none', zIndex: 1 }}>
          {mounted && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="avgGasSparkline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-purple)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--accent-purple)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="gasUsd"
                  stroke="var(--accent-purple)"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#avgGasSparkline)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Success Rate */}
      <div className="glass-panel interactive metric-card premium-card" style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 2 }}>
          <span className="metric-title">Tx Success Rate</span>
          <Percent size={20} color="var(--status-success)" />
        </div>
        <div className="metric-value" style={{
          background: 'var(--status-success)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          zIndex: 2,
          filter: 'drop-shadow(0 0 8px var(--status-success-strong))'
        }}>
          {metrics.successRate.toFixed(1)}%
        </div>
        <div className="metric-subtitle" style={{ zIndex: 2 }}>
          {transactions.filter(t => t.txreceipt_status === '1' && t.isError === '0').length} of {transactions.length} transactions succeeded
        </div>
        {/* Sparkline chart overlay */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '45px', opacity: 0.3, pointerEvents: 'none', zIndex: 1 }}>
          {mounted && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="successSparkline" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--status-success)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--status-success)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="successRate"
                  stroke="var(--status-success)"
                  strokeWidth={1.5}
                  fillOpacity={1}
                  fill="url(#successSparkline)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

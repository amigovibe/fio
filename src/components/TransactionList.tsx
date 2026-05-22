'use client';

import React, { useState, useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, Search, FileText, AlertCircle } from 'lucide-react';
import { Transaction } from '../utils/types';
import { formatDate, formatWei, formatAddress, CHAINS, generateAvatarGradient } from '../utils/ethereum';

interface TransactionListProps {
  transactions: Transaction[];
  activeAddress: string;
  onSelectTransaction: (tx: Transaction) => void;
  nativePrice: number;
}

type FilterType = 'all' | 'outgoing' | 'incoming' | 'contract' | 'failed';

export function TransactionList({
  transactions,
  activeAddress,
  onSelectTransaction,
  nativePrice,
}: TransactionListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Reset pagination on search or filter change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter]);

  // Compute median gas price for gas categorisation
  const medianGasPrice = useMemo(() => {
    if (transactions.length === 0) return BigInt(0);
    const sorted = [...transactions]
      .map((tx) => BigInt(tx.gasPrice))
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 !== 0) {
      return sorted[mid];
    }
    return (sorted[mid - 1] + sorted[mid]) / BigInt(2);
  }, [transactions]);

  const getGasCategory = (gasPriceStr: string) => {
    if (medianGasPrice === BigInt(0)) return 'avg';
    const price = BigInt(gasPriceStr);
    const lowThreshold = (medianGasPrice * BigInt(85)) / BigInt(100);
    const highThreshold = (medianGasPrice * BigInt(115)) / BigInt(100);
    if (price < lowThreshold) return 'low';
    if (price > highThreshold) return 'high';
    return 'avg';
  };

  // Parse transaction type relative to active address
  const getTxType = (tx: Transaction) => {
    const isFromUser = tx.from.toLowerCase() === activeAddress.toLowerCase();
    const isToUser = tx.to && tx.to.toLowerCase() === activeAddress.toLowerCase();
    
    if (isFromUser) return 'outgoing';
    if (isToUser) return 'incoming';
    return 'other';
  };

  // Filter and search transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const type = getTxType(tx);
      const isSuccess = tx.txreceipt_status === '1' && tx.isError === '0';
      
      // 1. Apply Type Filters
      if (activeFilter === 'outgoing' && type !== 'outgoing') return false;
      if (activeFilter === 'incoming' && type !== 'incoming') return false;
      if (activeFilter === 'failed' && isSuccess) return false;
      if (activeFilter === 'contract' && tx.to && tx.methodName === 'Transfer') return false;

      // 2. Apply Search Queries
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase().trim();
      return (
        tx.hash.toLowerCase().includes(query) ||
        tx.from.toLowerCase().includes(query) ||
        (tx.to && tx.to.toLowerCase().includes(query)) ||
        (tx.methodName && tx.methodName.toLowerCase().includes(query)) ||
        tx.blockNumber.includes(query)
      );
    });
  }, [transactions, searchQuery, activeFilter, activeAddress]);

  // Paginated data
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;

  return (
    <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Transaction Records
          <span style={{ fontSize: '0.8rem', background: 'var(--glass-border)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
            {filteredTransactions.length} found
          </span>
        </h3>
        
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '280px' }} className="dashboard-controls">
          <input
            type="text"
            className="input-field"
            placeholder="Search hash, address, or method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
          />
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }} className="dashboard-controls tx-filter-tabs">
        {(['all', 'outgoing', 'incoming', 'contract', 'failed'] as FilterType[]).map((filter) => (
          <button
            key={filter}
            className={`btn ${activeFilter === filter ? 'btn-primary' : 'btn-text'}`}
            style={{
              padding: '0.4rem 0.8rem', 
              fontSize: '0.85rem',
              borderRadius: '6px',
              textTransform: 'capitalize',
              ...(activeFilter !== filter && { background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' })
            }}
            onClick={() => setActiveFilter(filter)}
          >
            {filter === 'all' && 'All Tx'}
            {filter === 'outgoing' && 'Outgoing (Sent)'}
            {filter === 'incoming' && 'Incoming (Received)'}
            {filter === 'contract' && 'Smart Contract Calls'}
            {filter === 'failed' && 'Failed'}
          </button>
        ))}
      </div>

      {/* Empty state (shared) */}
      {filteredTransactions.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={32} color="var(--text-muted)" />
          <span>No transactions found matching your criteria.</span>
        </div>
      )}

      {filteredTransactions.length > 0 && (
        <>
          {/* ── Desktop: full table ── */}
          <div className="table-container tx-table-wrapper">
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Tx Hash</th>
                  <th>Method / Type</th>
                  <th>Time</th>
                  <th>Value</th>
                  <th>Gas Fee (USD)</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((tx) => {
                  const txType = getTxType(tx);
                  const isSuccess = tx.txreceipt_status === '1' && tx.isError === '0';
                  const valueEth = formatWei(tx.value, tx.tokenDecimal ? parseInt(tx.tokenDecimal, 10) : 18);
                  const valueUsd = parseFloat(valueEth) * nativePrice;
                  const gasCostWei = (BigInt(tx.gasUsed) * BigInt(tx.gasPrice)).toString();
                  const gasCostEth = formatWei(gasCostWei, 18);
                  const gasCostUsd = parseFloat(gasCostEth) * nativePrice;
                  const chainConfig = CHAINS[tx.chain];
                  const getMethodStatusColor = (methodName: string | undefined) => {
                    if (!methodName || methodName === 'Transfer') return 'success';
                    if (methodName.toLowerCase().includes('swap')) return 'cyan';
                    if (methodName.toLowerCase().includes('approve')) return 'purple';
                    return 'pending';
                  };
                  return (
                    <tr key={tx.hash} onClick={() => onSelectTransaction(tx)} className="ledger-row" style={{ cursor: 'pointer' }}>
                      <td style={{ fontFamily: 'monospace', color: 'var(--accent-cyan)', fontWeight: 500 }}>
                        {formatAddress(tx.hash)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {txType === 'incoming' ? (
                            <div style={{ padding: '0.25rem', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)', display: 'inline-flex' }}>
                              <ArrowDownRight size={14} />
                            </div>
                          ) : (
                            <div style={{ padding: '0.25rem', borderRadius: '4px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--status-pending)', display: 'inline-flex' }}>
                              <ArrowUpRight size={14} />
                            </div>
                          )}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                              <span className={`glow-dot ${getMethodStatusColor(tx.methodName)}`} style={{ width: '6px', height: '6px' }} />
                              <span style={{ fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(255, 255, 255, 0.04)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--glass-border)', fontFamily: 'Space Grotesk, sans-serif' }}>
                                {tx.methodName || 'Transfer'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                              <div className="address-avatar" style={{ width: '12px', height: '12px', background: generateAvatarGradient(txType === 'incoming' ? tx.from : (tx.to || '0x0000000000000000000000000000000000000000')) }} />
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {txType === 'incoming' ? `From ${formatAddress(tx.from)}` : `To ${formatAddress(tx.to || 'Contract')}`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatDate(tx.timeStamp)}</td>
                      <td>
                        <div style={{ fontWeight: 600, color: txType === 'incoming' ? 'var(--status-success)' : 'inherit' }}>
                          {txType === 'incoming' ? '+' : '-'}{parseFloat(valueEth).toFixed(4)} {tx.tokenSymbol || chainConfig.nativeCurrency}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ${valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 500 }}>
                            ${gasCostUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <span className={`gas-badge ${getGasCategory(tx.gasPrice)}`} style={{ gap: '0.3rem', display: 'inline-flex', alignItems: 'center' }}>
                            <span className={`glow-dot ${getGasCategory(tx.gasPrice) === 'low' ? 'success' : getGasCategory(tx.gasPrice) === 'high' ? 'error' : 'cyan'}`} style={{ width: '5px', height: '5px' }} />
                            {getGasCategory(tx.gasPrice)}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {parseFloat(gasCostEth).toFixed(5)} {chainConfig.nativeCurrency}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          {!isSuccess && (
                            <span className="status-badge error" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>Failed</span>
                          )}
                          <button className="btn btn-secondary btn-icon" style={{ padding: '0.35rem', borderRadius: '6px' }} onClick={(e) => { e.stopPropagation(); onSelectTransaction(tx); }}>
                            <FileText size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: card list ── */}
          <div className="tx-cards-mobile">
            {paginatedTransactions.map((tx) => {
              const txType = getTxType(tx);
              const isSuccess = tx.txreceipt_status === '1' && tx.isError === '0';
              const valueEth = formatWei(tx.value, tx.tokenDecimal ? parseInt(tx.tokenDecimal, 10) : 18);
              const valueUsd = parseFloat(valueEth) * nativePrice;
              const gasCostWei = (BigInt(tx.gasUsed) * BigInt(tx.gasPrice)).toString();
              const gasCostEth = formatWei(gasCostWei, 18);
              const gasCostUsd = parseFloat(gasCostEth) * nativePrice;
              const chainConfig = CHAINS[tx.chain];
              const gasCategory = getGasCategory(tx.gasPrice);

              return (
                <div key={tx.hash} className="tx-card-mobile" onClick={() => onSelectTransaction(tx)}>
                  {/* Row 1: hash + status badge + receipt button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                      {formatAddress(tx.hash)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {!isSuccess && (
                        <span className="status-badge error" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>Failed</span>
                      )}
                      <button
                        className="btn btn-secondary btn-icon"
                        style={{ padding: '0.3rem', borderRadius: '6px' }}
                        onClick={(e) => { e.stopPropagation(); onSelectTransaction(tx); }}
                      >
                        <FileText size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: direction icon + method + counterparty */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                    {txType === 'incoming' ? (
                      <div style={{ padding: '0.2rem', borderRadius: '4px', background: 'rgba(16,185,129,0.1)', color: 'var(--status-success)', display: 'inline-flex', flexShrink: 0 }}>
                        <ArrowDownRight size={13} />
                      </div>
                    ) : (
                      <div style={{ padding: '0.2rem', borderRadius: '4px', background: 'rgba(245,158,11,0.1)', color: 'var(--status-pending)', display: 'inline-flex', flexShrink: 0 }}>
                        <ArrowUpRight size={13} />
                      </div>
                    )}
                    <span style={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', background: 'rgba(255,255,255,0.04)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--glass-border)', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {tx.methodName || 'Transfer'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {txType === 'incoming' ? `from ${formatAddress(tx.from)}` : `to ${formatAddress(tx.to || 'Contract')}`}
                    </span>
                  </div>

                  {/* Row 3: value + gas side by side */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Value</div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: txType === 'incoming' ? 'var(--status-success)' : 'var(--text-primary)' }}>
                        {txType === 'incoming' ? '+' : '-'}{parseFloat(valueEth).toFixed(4)} {tx.tokenSymbol || chainConfig.nativeCurrency}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ${valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Gas</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          ${gasCostUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={`gas-badge ${gasCategory}`} style={{ fontSize: '0.65rem' }}>
                          {gasCategory}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {formatDate(tx.timeStamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination Controls */}
      {filteredTransactions.length > itemsPerPage && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '1rem' }} className="dashboard-controls">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

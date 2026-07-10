import { useState } from 'react';
import styles from './styles.module.css';

const PROVIDERS = ['pichau', 'kabum', 'mercadolivre'];
const VIEW_MODES = ['raw', 'normalized', 'both'];

export default function EngineeringVerification() {
  const [query, setQuery] = useState('ssd 1tb sata');
  const [provider, setProvider] = useState('pichau');
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [viewMode, setViewMode] = useState('both');

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, provider, pageNum }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || { message: 'Search failed', code: 'UNKNOWN' });
      }
    } catch (err) {
      setError({ message: err.message || 'Connection error', code: 'NETWORK' });
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (delta) => {
    const next = Math.max(1, pageNum + delta);
    setPageNum(next);
    if (result?.result) {
      // Trigger re-search with new page
      const savedResult = { ...result };
      setResult(savedResult);
    }
  };

  const formatPrice = (price) => {
    if (price == null) return 'N/A';
    return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatTime = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatCurrency = (price, currency = 'BRL') => {
    if (price == null) return 'N/A';
    return price.toLocaleString('pt-BR', { style: 'currency', currency });
  };

  const getStatusBadge = (availability) => {
    if (!availability) return null;
    const base = styles.badge;
    const map = {
      in_stock: styles.badgeSuccess,
      out_of_stock: styles.badgeWarning,
      unknown: styles.badgeNeutral,
    };
    const label = availability.replace('_', ' ').toUpperCase();
    return `<span class="${base} ${map[availability] || map.unknown}">${label}</span>`;
  };

  const getDisplayProducts = () => {
    if (viewMode === 'raw') return result?.result?.products || [];
    if (viewMode === 'normalized') return result?.result?.normalizedProducts || [];
    return result?.result?.products || []; // both mode uses raw + shows normalized columns
  };

  const getNormalizedProductsForMode = () => {
    if (viewMode === 'raw') return [];
    return result?.result?.normalizedProducts || [];
  };

  const getViewModeLabel = () => viewMode.charAt(0).toUpperCase() + viewMode.slice(1);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <img
              src="/engineering-logo.svg"
              alt="Engineering Verification"
              className={styles.logo}
            />
            <h1 className={styles.title}>Engineering Verification</h1>
            <p className={styles.subtitle}>Product Provider UI</p>
          </div>
          <nav className={styles.nav}>
            <a href="https://github.com/ttsoares/scraping" target="_blank" rel="noopener noreferrer" className={styles.navLink}>
              Repository
            </a>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Search Controls */}
        <section className={styles.controls}>
          <div className={styles.formRow}>
            {/* Query Input */}
            <div className={styles.inputGroup}>
              <label htmlFor="query" className={styles.inputLabel}>Search Query</label>
              <input
                id="query"
                type="text"
                className={styles.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="e.g., ssd 1tb sata"
              />
            </div>

            {/* Provider Selector */}
            <div className={styles.inputGroup}>
              <label htmlFor="provider" className={styles.inputLabel}>Provider</label>
              <div className={styles.providerButtons}>
                {PROVIDERS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={`${styles.providerButton} ${provider === p ? styles.active : ''}`}
                    onClick={() => setProvider(p)}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Page Number */}
            <div className={styles.inputGroup}>
              <label htmlFor="pageNum" className={styles.inputLabel}>Page</label>
              <div className={styles.pageControls}>
                <button
                  type="button"
                  className={styles.pageButton}
                  onClick={() => handlePageChange(-1)}
                  disabled={pageNum <= 1}
                >
                  ‹
                </button>
                <input
                  id="pageNum"
                  type="number"
                  className={styles.pageInput}
                  value={pageNum}
                  min={1}
                  onChange={(e) => setPageNum(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button
                  type="button"
                  className={styles.pageButton}
                  onClick={() => handlePageChange(1)}
                >
                  ›
                </button>
              </div>
            </div>

            {/* View Mode Toggle */}
            {result?.result?.normalizedProducts?.length > 0 && (
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>View</label>
                <div className={styles.providerButtons}>
                  {VIEW_MODES.map((vm) => (
                    <button
                      key={vm}
                      type="button"
                      className={`${styles.providerButton} ${viewMode === vm ? styles.active : ''}`}
                      onClick={() => setViewMode(vm)}
                    >
                      {vm.charAt(0).toUpperCase() + vm.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search Button */}
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>&nbsp;</label>
              <button
                type="button"
                className={`${styles.searchButton} ${loading ? styles.loading : ''}`}
                onClick={handleSearch}
                disabled={loading}
              >
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </section>

        {/* Results */}
        {result && (
          <section className={styles.results}>
            {/* Result Header */}
            <div className={styles.resultHeader}>
              <div className={styles.resultStats}>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Store:</span>{' '}
                  <span className={styles.statValue}>{result.provider}</span>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Products:</span>{' '}
                  <span className={styles.statValue}>{result.result.productCount}</span>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Time:</span>{' '}
                  <span className={styles.statValue}>{formatTime(result.result.executionTime)}</span>
                </span>
                {result.result.pagination && (
                  <span className={styles.stat}>
                    <span className={styles.statLabel}>Current Page:</span>{' '}
                    <span className={styles.statValue}>{result.result.pagination.currentPage}</span>
                  </span>
                )}
                <span className={styles.stat}>
                  <span className={styles.statLabel}>URL:</span>{' '}
                  <span className={styles.statValueUrl}>
                    {result.result.url}
                  </span>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Search:</span>{' '}
                  <span className={styles.statValue}>
                    {result.result.searchId ? result.result.searchId.substring(0, 8) + '…' : '—'}
                  </span>
                </span>
                <span className={styles.stat}>
                  <span className={styles.statLabel}>Persisted:</span>{' '}
                  <span className={`${styles.statValue} ${styles.persistedBadge}`}>
                    {result.result.persisted != null ? result.result.persisted : result.result.productCount} products
                  </span>
                </span>
                <span className={styles.stat}>
                  <span className={`${styles.statValue} ${result.result.persistence?.failed ? styles.badgeWarning : styles.badgeSuccess}`}>
                    {result.result.persistence?.failed ? '⚠ Recovery pending' : '✓ Stored in DB'}
                  </span>
                </span>
              </div>
            </div>

            {/* Error Badge */}
            {error && (
              <div className={styles.errorBadge}>
                <span className={styles.errorIcon}>!</span>
                <span>{error.message}</span>
                <span className={styles.errorCode}>{error.code}</span>
              </div>
            )}

            {/* Products Table */}
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.tableHeaderCell}>#</th>
                    <th className={`${styles.tableHeaderCell} ${viewMode !== 'raw' ? styles.tableHeaderCell : ''}`} style={viewMode !== 'raw' ? {} : {}}>{viewMode === 'normalized' ? 'Normalized Title' : viewMode === 'both' ? 'Title (Raw / Norm)':'Title'}</th>
                    <th className={styles.tableHeaderCell}>{viewMode === 'normalized' ? 'Current Price' : 'Price'}</th>
                    {viewMode === 'normalized' && <th className={styles.tableHeaderCell}>Original Price</th>}
                    {viewMode === 'both' && <th className={styles.tableHeaderCell}>Norm. Price</th>}
                    <th className={styles.tableHeaderCell}>Price Text</th>
                    {viewMode !== 'raw' && <th className={styles.tableHeaderCell}>Brand / Model</th>}
                    {viewMode !== 'raw' && <th className={styles.tableHeaderCell}>Storage / Memory</th>}
                    {viewMode !== 'raw' && <th className={styles.tableHeaderCell}>Availability</th>}
                    <th className={styles.tableHeaderCell}>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {getDisplayProducts().map((product, idx) => {
                    const isBoth = viewMode === 'both';
                    const rawTitle = product.title || '';
                    const normTitle = product.normalizedTitle || product.title || '';
                    const displayTitle = isBoth
                      ? (rawTitle !== normTitle ? <span><small style={{color:'#94a3b8'}}>{rawTitle}</small><br /><span style={{color:'#e2e8f0',fontWeight:600}}>{normTitle}</span></span> : product.title)
                      : product.title;

                    return (
                      <tr key={idx} className={styles.tableRow}>
                        <td className={styles.tableCell}>{idx + 1}</td>
                        <td className={`${styles.tableCell} ${styles.titleCell}`}>
                          <span className={styles.productTitle}>{displayTitle}</span>
                        </td>
                        <td className={`${styles.tableCell} ${styles.priceCell}`}>
                          {formatCurrency(product.currentPrice ?? product.price, product.currency)}
                        </td>
                        {isBoth && (
                          <td className={`${styles.tableCell} ${styles.priceCell}`} style={{fontSize:'0.8rem'}}>
                            <span style={{color:'#f59e0b'}}>{formatCurrency(product.originalPrice, product.currency)}</span>
                          </td>
                        )}
                        {viewMode === 'normalized' && (
                          <td className={`${styles.tableCell} ${styles.priceCell}`}>
                            <span style={{color:'#f59e0b'}}>
                              {product.originalPrice != null ? formatCurrency(product.originalPrice, product.currency) : '—'}
                            </span>
                          </td>
                        )}
                        <td className={`${styles.tableCell} ${styles.priceTextCell}`}>
                          {product.priceText || 'N/A'}
                        </td>
                        {viewMode !== 'raw' && (
                          <td className={styles.tableCell}>
                            <div style={{fontSize:'0.8rem'}}>
                              <span style={{color:'#38bdf8',fontWeight:500}}>{product.brand || '—'}</span>
                              {product.model && <span style={{color:'#94a3b8',marginLeft:'4px'}}>· {product.model}</span>}
                            </div>
                          </td>
                        )}
                        {viewMode !== 'raw' && (
                          <td className={styles.tableCell}>
                            <div style={{fontSize:'0.8rem'}}>
                              <span style={{color:'#4ade80'}}>{product.storageCapacity || '—'}</span>
                              {product.memoryCapacity && <span style={{color:'#94a3b8',marginLeft:'4px'}}>· {product.memoryCapacity}</span>}
                            </div>
                          </td>
                        )}
                        {viewMode !== 'raw' && (
                          <td className={styles.tableCell}>
                            {product.availability ? (
                              <span className={`${styles.badge} ${product.availability === 'in_stock' ? styles.badgeSuccess : product.availability === 'out_of_stock' ? styles.badgeWarning : styles.badgeNeutral}`}
                                style={{fontSize:'0.7rem',padding:'2px 8px'}}>
                                {product.availability.replace('_', ' ').toUpperCase()}
                              </span>
                            ) : (
                              <span style={{color:'#64748b',fontSize:'0.8rem'}}>—</span>
                            )}
                          </td>
                        )}
                        <td className={`${styles.tableCell} ${styles.urlCell}`}>
                          <a
                            href={product.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.productUrl}
                          >
                            View →
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Loading State */}
        {loading && !result && (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Launching browser and scraping...</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>
          Powered by{' '}
          <a href="https://nextjs.org" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>
            Next.js
          </a>{' '}
          · Providers: Pichau & KaBuM & Mercado Livre · Scraped via DOM + Playwright
        </p>
      </footer>
    </div>
  );
}

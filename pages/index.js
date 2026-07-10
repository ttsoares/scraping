import { useState } from 'react';
import styles from './styles.module.css';

const PROVIDERS = ['pichau', 'kabum', 'mercadolivre'];

export default function EngineeringVerification() {
  const [query, setQuery] = useState('ssd 1tb sata');
  const [provider, setProvider] = useState('pichau');
  const [pageNum, setPageNum] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

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
                    <th className={styles.tableHeaderCell}>Title</th>
                    <th className={styles.tableHeaderCell}>Price</th>
                    <th className={styles.tableHeaderCell}>Price Text</th>
                    <th className={styles.tableHeaderCell}>URL</th>
                  </tr>
                </thead>
                <tbody>
                  {result.result.products.map((product, idx) => (
                    <tr key={idx} className={styles.tableRow}>
                      <td className={styles.tableCell}>{idx + 1}</td>
                      <td className={styles.tableCell + ' ' + styles.titleCell}>
                        <span className={styles.productTitle}>{product.title}</span>
                      </td>
                      <td className={styles.tableCell + ' ' + styles.priceCell}>
                        {formatPrice(product.price)}
                      </td>
                      <td className={styles.tableCell + ' ' + styles.priceTextCell}>
                        {product.priceText || 'N/A'}
                      </td>
                      <td className={styles.tableCell + ' ' + styles.urlCell}>
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
                  ))}
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

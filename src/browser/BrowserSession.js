/**
 * BrowserSession — holds the browser state after launch.
 *
 * Contains the page handle, browsing context, cookies and engine
 * metadata needed throughout the life of a search operation.
 */

class BrowserSession {
  /**
   * @param {Object} opts
   * @param {string} opts.engineName - The engine that created this session.
   * @param {any} opts.page - Underlying page handle.
   * @param {any} opts.context - Browsing context (browser context).
   * @param {any} opts.browser - Underlying browser instance.
   */
  constructor(opts) {
    this.engineName = opts.engineName;
    this.page = opts.page;
    this.context = opts.context;
    this.browser = opts.browser;
    this.userAgent = opts.userAgent || null;
  }

  /**
   * Get the current page URL.
   * @returns {string}
   */
  url() {
    return this.page?.url?.() ?? this.page?.url ?? '';
  }

  /**
   * Close this session without closing the engine.
   */
  async close() {
    try {
      const isClosed = typeof this.page?.isClosed === 'function'
        ? this.page.isClosed()
        : Boolean(this.page?.closed);
      if (this.page && !isClosed) {
        await this.page.close();
      }
    } catch { /* ignore */ }
    this.page = null;
    this.context = null;
    this.browser = null;
  }
}

module.exports = { BrowserSession };

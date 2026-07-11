/**
 * PlaywrightEngine — concrete implementation of BrowserEngine.
 *
 * Wraps playwright-extra with stealth plugin. Behavior is
 * identical to the current provider implementations.
 */

const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();
const { BrowserEngine } = require('./BrowserEngine');
const { BrowserSession } = require('./BrowserSession');

chromium.use(stealthPlugin);

// Shared singleton browser (module-level)
let _browser = null;
let _context = null;

const isPageClosed = (page) => {
  if (!page) return true;
  if (typeof page.isClosed === 'function') return page.isClosed();
  return Boolean(page.closed);
};

/**
 * @implements {BrowserEngine}
 */
class PlaywrightEngine extends BrowserEngine {
  constructor() {
    super();
    this.engineName = 'playwright';
  }

  /**
   * Ensure browser and context exist.
   * @returns {Promise<void>}
   */
  async _ensureBrowser() {
    if (!_browser) {
      _browser = await chromium.launch({ headless: true });
    }
    if (!_context) {
      _context = await _browser.newContext();
    }
  }

  /**
   * Launch the browser and return a session.
   * @param {Object} [options]
   * @param {boolean} [options.headless]
   * @returns {Promise<BrowserSession>}
   */
  async launch(options = {}) {
    await this._ensureBrowser();
    const page = await _context.newPage();

    const session = new BrowserSession({
      engineName: this.engineName,
      page,
      context: _context,
      browser: _browser,
      userAgent: options.userAgent || null,
    });

    return session;
  }

  /**
   * Close the session / engine gracefully.
   * @returns {Promise<void>}
   */
  async close() {
    try {
      const pages = _context?.pages?.() || [];
      for (const page of pages) {
        if (!isPageClosed(page)) {
          await page.close();
        }
      }
    } catch { /* ignore */ }

    try {
      if (_context) await _context.close();
    } catch { /* ignore */ }

    if (_browser) {
      await _browser.close();
      _browser = null;
    }
    _context = null;
  }

  /**
   * Check whether the engine is healthy.
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    if (!_browser || !_context) return false;
    try {
      _context.pages?.();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Execute a callback with the page handle and return the result.
   * @template T
   * @param {function(any): Promise<T>} fn - Receive page as argument.
   * @returns {Promise<T>}
   */
  async execute(fn) {
    await this._ensureBrowser();
    const page = await _context.newPage();
    try {
      return await fn(page);
    } finally {
      if (!isPageClosed(page)) {
        await page.close();
      }
    }
  }

  /**
   * Get the existing browser instance (for providers that need direct access).
   * @returns {any}
   */
  getBrowser() {
    return _browser;
  }

  /**
   * Get or create the existing page (for providers that need direct access).
   * @returns {Promise<any>}
   */
  async getPage() {
    await this._ensureBrowser();
    const pages = _context?.pages?.() || [];
    const page = pages.find(candidate => !isPageClosed(candidate));
    return page || await _context.newPage();
  }
}

module.exports = { PlaywrightEngine };

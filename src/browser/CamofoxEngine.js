/**
 * CamofoxEngine — Firefox-based stealth engine with Camoufox fingerprints.
 *
 * Uses playwright's built-in Firefox with Camoufox-specific fingerprint
 * options (UA, viewport, timezone, touch, canvas, languages, permissions).
 *
 * Follows the same singleton singleton pattern as PlaywrightEngine:
 * module-level _browser and _context, _ensureBrowser,
 * shared BrowserSession class, BrowserEngine interface.
 */

const { firefox } = require('playwright-extra');
const { BrowserEngine } = require('./BrowserEngine');
const { BrowserSession } = require('./BrowserSession');

// Camoufox fingerprint defaults
const CAMOFOX_UA =
  'Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0';
const CAMOFOX_VIEWPORT = { width: 1920, height: 1080 };
const CAMOFOX_LOCALES = 'en-US,en';
const CAMOFOX_TIMEZONE = 'America/Sao_Paulo';

// Shared singleton browser (module-level, independent from PlaywrightEngine)
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
class CamofoxEngine extends BrowserEngine {
  constructor() {
    super();
    this.engineName = 'camofox';
  }

  /**
   * Ensure browser and context exist.
   * @returns {Promise<void>}
   */
  async _ensureBrowser() {
    if (!_browser) {
      _browser = await firefox.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-infobars',
          '--disable-window-activation',
          '--disable-focus-on-load',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-gpu',
          '--mute-audio',
          '--window-size=1920,1080',
        ],
      });
    }
    if (!_context) {
      _context = await _browser.newContext({
        userAgent: CAMOFOX_UA,
        viewport: CAMOFOX_VIEWPORT,
        locale: CAMOFOX_LOCALES,
        timezoneId: CAMOFOX_TIMEZONE,
        hasTouch: true,
        isMobile: false,
        javaScriptEnabled: true,
        permissions: ['geolocation', 'notifications'],
        extraHTTPHeaders: {
          'Accept-Language': CAMOFOX_LOCALES,
          'Accept-Encoding': 'gzip, deflate, br',
        },
      });
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
      userAgent: options.userAgent || CAMOFOX_UA,
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
   * Get the existing browser instance.
   * @returns {any}
   */
  getBrowser() {
    return _browser;
  }

  /**
   * Get or create an existing page.
   * @returns {Promise<any>}
   */
  async getPage() {
    await this._ensureBrowser();
    const pages = _context?.pages?.() || [];
    const page = pages.find(candidate => !isPageClosed(candidate));
    return page || await _context.newPage();
  }
}

module.exports = { CamofoxEngine };

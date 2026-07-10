/**
 * BrowserEngine — abstract interface for browser abstraction layer.
 *
 * Any engine implementing this interface abstracts away browser
 * initialization, session management and cleanup, allowing the
 * SearchService to operate without knowing the concrete browser.
 *
 * Implemented by:
 * - PlaywrightEngine (default, wraps playwright-extra + stealth)
 * - Future: CamofoxEngine, PuppeteerEngine, etc.
 */

/**
 * @typedef {Object} BrowserSession
 * @property {string} engineName - Name of the engine (e.g., 'playwright').
 * @property {any} page - Underlying page handle (browser-specific).
 * @property {any} context - Browsing context (browser context).
 * @property {any} browser - Underlying browser instance.
 */

/**
 * @typedef {Object} BrowserOptions
 * @property {boolean} [headless] - Whether to run in headless mode.
 * @property {string} [userAgent] - Custom user agent string.
 * @property {number} [timeout] - Default timeout in milliseconds.
 */

/**
 * @abstract
 */
class BrowserEngine {
  constructor() {
    /** @type {string} */
    this.engineName = 'BrowserEngine';
  }

  /**
   * Launch the browser and return a session.
   * @param {BrowserOptions} [options]
   * @returns {Promise<BrowserSession>}
   */
  async launch(options) {
    throw new Error('launch() not implemented');
  }

  /**
   * Close the session / engine gracefully.
   * @returns {Promise<void>}
   */
  async close() {
    throw new Error('close() not implemented');
  }

  /**
   * Check whether the engine is healthy.
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    throw new Error('isHealthy() not implemented');
  }

  /**
   * Execute a callback with the page handle and return the result.
   * @template T
   * @param {function(any): Promise<T>} fn - Receive page as argument.
   * @returns {Promise<T>}
   */
  async execute(fn) {
    throw new Error('execute() not implemented');
  }
}

module.exports = { BrowserEngine };

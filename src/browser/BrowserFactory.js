/**
 * BrowserFactory — always returns a PlaywrightEngine.
 *
 * Provides a single entry point for creating new browser engines.
 * Current implementation returns PlaywrightEngine instances,
 * but allows future switching to alternative engines.
 */

const { PlaywrightEngine } = require('./PlaywrightEngine');

class BrowserFactory {
  /**
   * Always creates a fresh PlaywrightEngine.
   * @returns {PlaywrightEngine}
   */
  static create() {
    return new PlaywrightEngine();
  }

  /**
   * Create a PlaywrightEngine and launch it immediately.
   * @param {Object} [options]
   * @returns {Promise<PlaywrightEngine>}
   */
  static async createAndLaunch(options) {
    const engine = BrowserFactory.create();
    await engine.launch(options);
    return engine;
  }
}

module.exports = { BrowserFactory };

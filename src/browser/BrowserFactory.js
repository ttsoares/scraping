/**
 * BrowserFactory — always returns a PlaywrightEngine by default,
 * but can also create CamofoxEngine.
 *
 * Provides a single entry point for creating new browser engines.
 */

const { PlaywrightEngine } = require('./PlaywrightEngine');
const { CamofoxEngine } = require('./CamofoxEngine');

const ENGINE_REGISTRY = {
  playwright: PlaywrightEngine,
  camofox: CamofoxEngine,
};

class BrowserFactory {
  /**
   * Create a browser engine (default: 'playwright').
   *
   * @param {string | { engine?: string }} [options]
   *   Positional string (backward-compatible) or options object.
   *   e.g. `create()` or `create('camofox')` or `create({ engine: 'camofox' })`
   * @returns {PlaywrightEngine}
   */
  static create(options = 'playwright') {
    const engine = _parseEngine(options);
    const EngineClass = ENGINE_REGISTRY[engine] || PlaywrightEngine;
    return new EngineClass();
  }

  /**
   * Create and launch a browser engine.
   *
   * @param {string | { engine?: string, [key: string]: any }} [options]
   *   Engine selector or options object.
   * @param {Object} [launchOptions] Options forwarded to engine.launch().
   * @returns {Promise<PlaywrightEngine>}
   */
  static async createAndLaunch(options = 'playwright', launchOptions = {}) {
    const engine = BrowserFactory.create(options);
    await engine.launch(launchOptions);
    return engine;
  }
}

/**
 * @param {string | { [key: string]: any }} input
 * @returns {string} engine key (e.g. 'playwright', 'camofox')
 */
function _parseEngine(input) {
  if (typeof input === 'string') {
    return input;
  }
  if (input && typeof input.engine === 'string') {
    return input.engine;
  }
  return 'playwright';
}

module.exports = { BrowserFactory };

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
   * @param {'playwright' | 'camofox' | string} [name]
   * @returns {PlaywrightEngine}
   */
  static create(name = 'playwright') {
    const EngineClass = ENGINE_REGISTRY[name] || PlaywrightEngine;
    return new EngineClass();
  }

  /**
   * Create a PlaywrightEngine and launch it immediately.
   * @param {Object} [options]
   * @returns {Promise<PlaywrightEngine>}
   */
  static async createAndLaunch(name, options) {
    const engine = BrowserFactory.create(name);
    await engine.launch(options);
    return engine;
  }
}

module.exports = { BrowserFactory };

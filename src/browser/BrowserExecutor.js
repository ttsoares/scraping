/**
 * BrowserExecutor — orchestrates the full lifecycle:
 *   launch → execute → (retry if needed) → close.
 *
 * Combines RetryPolicy and FailureClassifier to provide robust
 * execution for any async function that needs a browser page.
 */

const { BrowserFactory } = require('./BrowserFactory');
const { RetryPolicy } = require('./RetryPolicy');
const { FailureClassifier } = require('./FailureClassifier');

class BrowserExecutor {
  /**
   * @param {Object} [options]
   */
  constructor(options = {}) {
    this.factory = options.factory || BrowserFactory;
    this.retryPolicy = options.retryPolicy || new RetryPolicy(options.retryOptions);
    this.classifier = options.classifier || new FailureClassifier();
  }

  /**
   * Execute an operation with automatic retry and cleanup.
   *
   * @template T
   * @param {function(any): Promise<T>} operation - Receives the page handle.
   * @param {string} [operationName='operation'] - Name for logging.
   * @returns {Promise<T>}
   */
  async execute(operation, operationName = 'operation') {
    let engine = null;
    let page = null;
    let lastError = null;

    for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
      try {
        // Launch or reuse engine
        if (!engine || (await engine.isHealthy()) === false) {
          engine = await this.factory.create();
          await engine.launch();
        }

        // Get page
        page = await engine.getPage();
        if (!page) throw new Error('No page available');

        // Execute operation
        const result = await operation(page);

        // Success - close page but keep engine
        if (page && !page.isClosed && !page?.closed) {
          await page.close();
        }

        return result;
      } catch (error) {
        lastError = error;
        const shouldRetry = this.retryPolicy.shouldRetry(error, attempt);

        if (!shouldRetry || attempt >= this.retryPolicy.maxRetries) {
          // Close on final attempt or non-retriable
          await this._safeClose(engine);
          throw error;
        }

        // Close and recreate engine for retry
        await this._safeClose(engine);
        engine = null;
        page = null;

        if (shouldRetry) {
          const delay = this.retryPolicy.delay(attempt);
          await this._sleep(delay);
        }
      }
    }

    // Exhausted retries
    throw lastError;
  }

  /**
   * Execute a function that already receives a browser session.
   * @template T
   * @param {function(any): Promise<T>} operation - Receives the session.
   * @returns {Promise<T>}
   */
  async executeWithSession(operation) {
    let engine = null;
    let session = null;

    try {
      engine = await this.factory.create();
      await engine.launch();
      session = await engine.launch(); // get existing session

      const result = await operation(session);

      if (session) await session.close();
      return result;
    } catch (error) {
      if (session) await session.close();
      throw error;
    } finally {
      await this._safeClose(engine);
    }
  }

  /**
   * Safe close for any page / engine state.
   * @param {any} page
   */
  async _closePage(page) {
    if (page && !page.isClosed && !page?.closed) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }

  /**
   * Safe close for any engine instance.
   * @param {any} engine
   */
  async _safeClose(engine) {
    if (engine) {
      try { await engine.close(); } catch { /* ignore */ }
    }
  }

  /**
   * Sleep helper, allows override for testing.
   * @param {number} ms
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { BrowserExecutor };

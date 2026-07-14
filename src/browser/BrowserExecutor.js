/**
 * BrowserExecutor — orchestrates the full lifecycle:
 *   launch → execute → (retry if needed) → close.
 *
 * Combines RetryPolicy and FailureClassifier to provide robust
 * execution for any async function that needs a browser session.
 */

const { BrowserFactory } = require('./BrowserFactory');
const { RetryPolicy } = require('./RetryPolicy');
const { FailureClassifier } = require('./FailureClassifier');

class BrowserExecutor {
  /**
   * @param {Object} [options]
   * @param {string} [options.engine] - Browser engine selector (e.g., 'playwright', 'camofox').
   * @param {any} [options.factory]
   * @param {any} [options.retryPolicy]
   * @param {any} [options.classifier]
   * @param {any} [options.retryOptions]
   */
  constructor(options = {}) {
    this.engine = options.engine || null;
    this.factory = options.factory || BrowserFactory;
    this.retryPolicy = options.retryPolicy || new RetryPolicy(options.retryOptions);
    this.classifier = options.classifier || new FailureClassifier();
  }

  /**
   * Execute an operation with automatic retry and cleanup.
   *
   * @template T
   * @param {function(any): Promise<T>} operation - Receives the browser session.
   * @param {string} [operationName='operation'] - Name for logging.
   * @returns {Promise<T>}
   */
  async execute(operation, operationName = 'operation') {
    let engine = null;
    let session = null;
    let lastError = null;

    for (let attempt = 0; attempt <= this.retryPolicy.maxRetries; attempt++) {
      try {
        if (!engine || (await engine.isHealthy()) === false) {
          if (engine) {
            await this._safeClose(engine);
          }
          engine = await this.factory.create({ engine: this.engine });
        }

        session = await engine.launch();
        if (!session) throw new Error('No session available');

        // Execute operation with session
        const result = await operation(session);

        // Success - clean up session but keep engine for potential reuse
        if (session && session.close) {
          try {
            await session.close();
          } catch (closeError) {
            // Log but don't fail the operation on cleanup errors
            console.warn(`Session close error: ${closeError.message}`);
          }
        }

        return result;
      } catch (error) {
        lastError = error;
        const failureReason = this.classifier.classify(error);
        const shouldRetry = this.retryPolicy.shouldRetry(failureReason, attempt);

        // Clean up session regardless of retry decision
        if (session && session.close) {
          try {
            await session.close();
          } catch (closeError) {
            console.warn(`Session close error on retry: ${closeError.message}`);
          }
        }
        session = null;  // Reset for next attempt

        if (!shouldRetry || attempt >= this.retryPolicy.maxRetries) {
          // Close engine on final failure to clean up resources
          if (engine) {
            try {
              await this._safeClose(engine);
            } catch (closeError) {
              console.warn(`Engine close error on failure: ${closeError.message}`);
            }
          }
          throw error;
        }

        if (shouldRetry) {
          const delay = this.retryPolicy.delay(attempt);
          await this._sleep(delay);
        }
      }
    }

    // Exhausted retries - should not reach here due to above return in catch
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
      engine = await this.factory.create({ engine: this.engine });
      session = await engine.launch();

      const result = await operation(session);

      return result;
    } catch (error) {
      throw error;
    } finally {
      // Clean up session
      if (session && session.close) {
        try {
          await session.close();
        } catch (closeError) {
          console.warn(`Session close error in executeWithSession: ${closeError.message}`);
        }
      }
      // Close engine at end
      if (engine) {
        await this._safeClose(engine);
      }
    }
  }

  /**
   * Safe close for any engine instance.
   * @param {any} engine
   */
  async _safeClose(engine) {
    if (engine) {
      try {
        await engine.close();
      } catch (error) {
        console.warn(`Error closing engine: ${error.message}`);
      }
    }
  }

  /**
   * Sleep helper, allows override for testing.
   * @param {number} ms
   */
  async _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { BrowserExecutor };

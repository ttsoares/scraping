/**
 * RetryPolicy — generic retry strategy, browser-independent.
 *
 * Decides whether to retry from a pre-classified failure reason and
 * the current retry count. Raw exception interpretation belongs only
 * in FailureClassifier.
 */

const { FailureCategory } = require('./FailureClassifier');

class RetryPolicy {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxRetries=3] - Max retries per query.
   * @param {number} [options.baseDelayMs=500] - Base delay in ms.
   * @param {number} [options.maxDelayMs=5000] - Max delay in ms.
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 5000;
  }

  /**
   * Check if a classified failure reason is retriable.
   * @param {string} failureReason - One of FailureCategory values.
   * @param {number} retryAttempt - Current retry attempt (0-indexed).
   * @returns {boolean}
   */
  shouldRetry(failureReason, retryAttempt) {
    if (retryAttempt >= this.maxRetries) {
      return false;
    }

    return failureReason === FailureCategory.RETRIABLE ||
           failureReason === FailureCategory.TRANSIENT;
  }

  /**
   * Calculate delay for a given retry attempt.
   * Uses exponential backoff: baseDelayMs * 2^attempt + jitter.
   * @param {number} retryAttempt
   * @returns {number} Delay in milliseconds.
   */
  delay(retryAttempt) {
    const exp = Math.min(retryAttempt, 10);
    const backoff = this.baseDelayMs * Math.pow(2, exp);
    // Add 10% jitter
    const jitter = backoff * 0.1;
    const delay = backoff + (Math.random() * jitter * 2 - jitter);
    return Math.min(delay, this.maxDelayMs);
  }
}

module.exports = { RetryPolicy };

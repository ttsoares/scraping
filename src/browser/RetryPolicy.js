/**
 * RetryPolicy — generic retry strategy, browser-independent.
 *
 * Decides whether to retry based on a FailureClassifier and
 * the current retry count. Uses exponential backoff with jitter.
 */

const { FailureClassifier, FailureCategory } = require('./FailureClassifier');

class RetryPolicy {
  /**
   * @param {Object} [options]
   * @param {number} [options.maxRetries=3] - Max retries per query.
   * @param {number} [options.baseDelayMs=500] - Base delay in ms.
   * @param {number} [options.maxDelayMs=5000] - Max delay in ms.
   * @param {FailureClassifier} [options.classifier] - Classifier instance.
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.maxDelayMs = options.maxDelayMs ?? 5000;
    this.classifier = options.classifier ?? new FailureClassifier();
  }

  /**
   * Check if an error is retriable.
   * @param {Error|any} error
   * @param {number} retryAttempt - Current retry attempt (0-indexed).
   * @returns {boolean}
   */
  shouldRetry(error, retryAttempt) {
    if (retryAttempt >= this.maxRetries) {
      return this.classifier.shouldRetry(error);
    }
    return true;
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

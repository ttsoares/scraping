/**
 * FailureClassifier — classifies exceptions into categories.
 *
 * Returns one of:
 *   'retriable'  — transient, safe to retry (timeout, network, cloudflare)
 *   'transient'  — short-lived, retry with small delay
 *   'permanent'  — configuration or data error, do not retry
 *   'unknown'    — unexpected error
 *
 * Priority order: transient > retriable > permanent > unknown.
 */

// Classifications
const FailureCategory = {
  RETRIABLE: 'retriable',
  TRANSIENT: 'transient',
  PERMANENT: 'permanent',
  UNKNOWN: 'unknown',
};

// Transient patterns (checked FIRST — most specific)
const TRANSIENT_PATTERNS = [
  /busy/i,          /try again/i,
  /temporary/i,     /unavailable/i,
  /refused/i,       /ECONNREFUSED/,
];

// Retriable patterns (checked SECOND)
const RETRIABLE_PATTERNS = [
  /timeout/i,       /timed out/i,
  /network/i,       /net::/,
  /cloudflare/i,    /403/,
  /429/,            /rate limit/i,
  /session/i,       /page/i,
];

// Permanent patterns (checked THIRD)
const PERMANENT_PATTERNS = [
  /not found/i,     /404/i,
  /invalid/i,       /bad argument/i,
  /cannot read/i,   /undefined/i,
  /does not exist/i,
];

class FailureClassifier {
  /**
   * Classify a single error / exception.
   * @param {Error|any} error
   * @returns {string} One of FailureCategory values.
   */
  classify(error) {
    const message = error?.message || String(error);
    const name = error?.name || '';

    // Transient first (most specific overrides general)
    for (const pattern of TRANSIENT_PATTERNS) {
      if (pattern.test(message)) {
        return FailureCategory.TRANSIENT;
      }
    }

    // Then retriable
    for (const pattern of RETRIABLE_PATTERNS) {
      if (pattern.test(message)) {
        return FailureCategory.RETRIABLE;
      }
    }

    // Then permanent
    for (const pattern of PERMANENT_PATTERNS) {
      if (pattern.test(message)) {
        return FailureCategory.PERMANENT;
      }
    }

    // Special error names
    if (name.includes('Timeout') || name.includes('TimeoutError')) {
      return FailureCategory.RETRIABLE;
    }
    if (name.includes('ConnectionError') || name.includes('ConnectionRefused')) {
      return FailureCategory.TRANSIENT;
    }
    if (name.includes('ParseError') || name.includes('TypeError')) {
      return FailureCategory.PERMANENT;
    }

    return FailureCategory.UNKNOWN;
  }

  /**
   * Is the error worth retrying?
   * @param {Error|any} error
   * @returns {boolean}
   */
  shouldRetry(error) {
    const category = this.classify(error);
    return category !== FailureCategory.PERMANENT && category !== FailureCategory.UNKNOWN;
  }

  /**
   * Get a human-readable label.
   * @param {Error|any} error
   * @returns {string}
   */
  label(error) {
    return this.classify(error);
  }
}

module.exports = { FailureClassifier, FailureCategory };

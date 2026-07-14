/**
 * ComparisonReason - Records why products match or differ on a specific field.
 *
 * A ComparisonReason is the fundamental explainable unit for buying recommendations.
 * It captures:
 * - which field was compared (field)
 * - what the left value was (leftValue)
 * - what the right value was (rightValue)
 * - what the canonical value should be (canonicalValue)
 * - why they match or differ (reason)
 *
 * ComparisonReason is preferred over generic evidence because:
 * 1. It carries explicit canonical value resolution (not just raw comparison).
 * 2. It is self-describing: reason explains the semantics, not just the outcome.
 * 3. It supports future recommendation generation: a buyer can "follow the reason
 *    to understand the match."
 * 4. It separates extraction-level evidence from comparison-level reasoning.
 */

'use strict';

/**
 * Create a ComparisonReason object.
 *
 * @param {string} field - Field name (e.g., 'brand', 'capacity', 'interface')
 * @param {string|number|boolean} leftValue - Left product field value (raw or canonical)
 * @param {string|number|boolean} rightValue - Right product field value (raw or canonical)
 * @param {string} canonicalValue - Resolved canonical value for this field
 * @param {string} reason - Human-readable explanation
 * @param {string} [status='MATCH' | 'MISMATCH' | 'UNKNOWN']
 * @returns {Object} ComparisonReason
 */
function createReason(field, leftValue, rightValue, canonicalValue, reason, status) {
  status = status || (reason === 'Match' || /match/i.test(reason) ? 'MATCH' : 'UNKNOWN');

  return Object.freeze({
    field: field,
    leftValue: leftValue,
    rightValue: rightValue,
    canonicalValue: canonicalValue !== undefined ? canonicalValue : _formatValue(leftValue || rightValue),
    reason: reason,
    status: status,
  });
}

/**
 * Format a value for display in canonicalValue.
 */
function _formatValue(value) {
  if (value == null) {
    return 'Unknown';
  }
  return String(value);
}

/**
 * Create a match reason.
 */
function reasonMatch(field, leftValue, rightValue, reason) {
  return createReason(field, leftValue, rightValue, leftValue || rightValue, reason || 'Match', 'MATCH');
}

/**
 * Create a mismatch reason.
 */
function reasonMismatch(field, leftValue, rightValue, reason) {
  return createReason(field, leftValue, rightValue, null, reason || 'Mismatch', 'MISMATCH');
}

/**
 * Create an unknown reason.
 */
function reasonUnknown(field, reason) {
  return createReason(field, 'Unknown', 'Unknown', 'Unknown', reason || 'Unknown', 'UNKNOWN');
}

// ====================================================================
// Exports
// ====================================================================

const ComparisonReason = {
  createReason: createReason,
  reasonMatch: reasonMatch,
  reasonMismatch: reasonMismatch,
  reasonUnknown: reasonUnknown,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComparisonReason;
  module.exports.createReason = ComparisonReason.createReason;
  module.exports.reasonMatch = ComparisonReason.reasonMatch;
  module.exports.reasonMismatch = ComparisonReason.reasonMismatch;
  module.exports.reasonUnknown = ComparisonReason.reasonUnknown;
}

/**
 * Deterministic Cross-Retailer Product Matching
 *
 * Compares two canonical storage devices extracted from different
 * retailers (Pichau, KaBuM, Mercado Livre) and determines whether
 * they represent the same physical product.
 *
 * Uses only deterministic rules (no LLM calls):
 * 1. Manufacturer SKU (highest priority)
 * 2. Brand + Family + Model
 * 3. Capacity (GB comparison)
 * 4. Interface / Protocol (compatibility-aware)
 * 5. PCIe Generation (direct or adjacent)
 * 6. Form Factor (exact or compatible)
 *
 * Unknown/null values reduce confidence but do not cause false positives.
 */

'use strict';

const { StorageDeviceExtractor } = require('../StorageDeviceExtractor');
const ComparisonEngine = require('../comparison/ComparisonEngine');

// ====================================================================
// Constants
// ====================================================================

const VERDICTS = Object.freeze({
  IDENTICAL: 'IDENTICAL',
  LIKELY_IDENTICAL: 'LIKELY_IDENTICAL',
  DIFFERENT: 'DIFFERENT',
  UNKNOWN: 'UNKNOWN',
});

// Compatible interface pairs
const COMPATIBLE_INTERFACES = Object.freeze(new Set([
  'NVME,M.2',
  'M.2,NVME',
  'PCIE,M.2',
  'M.2,PCIE',
  'PCIE,NVME',
  'NVME,PCIE',
]));

// Compatible form factor pairs
const COMPATIBLE_FORM_FACTORS = Object.freeze(new Set([
  'M.2,2280',
  '2280,M.2',
  '2.5",SATA',
  'SATA,2.5"',
]));

// ====================================================================
// Confidence helpers
// ====================================================================

/**
 * Clamp a value between min and max.
 */
function clamp(value, min, max) {
  return Math.max(Math.min(value, max), min);
}

/**
 * Round to 2 decimal places.
 */
function round(value, decimals = 2) {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Calculate confidence reduction for an unknown field.
 */
function unknownPenalty(confidence) {
  // Reduce confidence by weighted amount
  return round(confidence * 0.85);
}

/**
 * Merge confidence from two products.
 */
function mergeConfidence(conf1, conf2) {
  if (conf1 == null && conf2 == null) return 0.5;
  if (conf1 == null) return round(conf2 * 0.95);
  if (conf2 == null) return round(conf1 * 0.95);
  return round((conf1 + conf2) / 2);
}

// ====================================================================
// Evidence builder
// ====================================================================

/**
 * Create an evidence entry.
 */
function evidenceField(field, match, label, detail) {
  const status = match ? 'MATCH' : (detail ? 'NO_MATCH' : 'UNKNOWN');
  return {
    field,
    status,
    label,
    detail: detail || (match ? 'Match' : 'Field not detected'),
  };
}

/**
 * Build full evidence report.
 */
function buildEvidence(results) {
  const evidence = results.map((r) => ({
    rule: r.ruleName,
    left: r.leftValue,
    right: r.rightValue,
    matched: r.matched,
    detail: r.detail,
  }));

  const matchCount = results.filter((r) => r.matched).length;
  const total = results.length;
  const matchRatio = total > 0 ? matchCount / total : 0;

  // Determine confidence weight
  const unknownCount = results.filter((r) => !r.matched && r.detail === false).length;
  const baseConfidence = matchRatio * 1.0;
  const penalty = (unknownCount / total) * 0.15;
  const confidence = round(clamp(baseConfidence - penalty, 0, 1));

  // Determine verdict
  let verdict;
  if (total === 0) {
    verdict = VERDICTS.UNKNOWN;
  } else if (confidence >= 0.9) {
    verdict = VERDICTS.IDENTICAL;
  } else if (confidence >= 0.7) {
    verdict = VERDICTS.LIKELY_IDENTICAL;
  } else if (confidence >= 0.4) {
    verdict = VERDICTS.DIFFERENT;
  } else {
    verdict = VERDICTS.UNKNOWN;
  }

  return { verdict, confidence, evidence };
}

// ====================================================================
// Core matching functions
// ====================================================================

/**
 * Compare manufacturer SKU.
 * @param {string|} leftSku - Left product SKU
 * @param {string|} rightSku - Right product SKU
 * @returns {{ruleName: string, matched: string|}}
 */
function compareSku(leftSku, rightSku) {
  if (leftSku == null && rightSku == null) {
    return {ruleName: 'manufacturerSku', matched: true, detail: false, label: 'Both unknown', leftValue: null, rightValue: null};
  }
  if (leftSku == null || rightSku == null) {
    return {ruleName: 'manufacturerSku', matched: false, detail: false, label: 'One unknown', leftValue: leftSku, rightValue: rightSku};
  }
  const lowerLeft = leftSku.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const lowerRight = rightSku.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return {ruleName: 'manufacturerSku', matched: lowerLeft === lowerRight, detail: true, label: 'SKU match', leftValue: leftSku, rightValue: rightSku};
}

/**
 * Compare brand.
 * @param {string} leftBrand - Left product brand
 * @param {string} rightBrand - Right product brand
 * @returns {{ruleName: string, matched: boolean, detail: boolean, string, rightValue: string}}
 */
function compareBrand(leftBrand, rightBrand) {
  if (leftBrand == null && rightBrand == null) {
    return {ruleName: 'brand', matched: true, detail: false, label: 'Both unknown', leftValue: null, rightValue: null};
  }
  if (leftBrand == null || rightBrand == null) {
    return {ruleName: 'brand', matched: false, detail: false, label: 'One unknown', leftValue: leftBrand, rightValue: rightBrand};
  }
  const lowerLeft = leftBrand.toUpperCase().trim();
  const lowerRight = rightBrand.toUpperCase().trim();
  // Known aliases
  if ((lowerLeft === 'WD' && lowerRight === 'WESTERN DIGITAL') ||
      (lowerLeft === 'WESTERN DIGITAL' && lowerRight === 'WD') ||
      (lowerLeft === 'WD' && lowerRight === 'WD BLUE')) {
    return {ruleName: 'brand', matched: true, detail: true, label: 'Brand alias', leftValue: lowerLeft, rightValue: lowerRight};
  }
  return {ruleName: 'brand', matched: lowerLeft === lowerRight, detail: true, label: 'Brand match', leftValue: lowerLeft, rightValue: lowerRight};
}

/**
 * Compare model.
 * @param {string} leftModel - Left product model
 * @param {string} rightModel - Right product model
 * @returns {{ruleName: string, matched: boolean, detail: boolean, string, rightValue: string}}
 */
function compareModel(leftModel, rightModel) {
  if (leftModel == null && rightModel == null) {
    return {ruleName: 'model', matched: true, detail: false, label: 'Both unknown', leftValue: null, rightValue: null};
  }
  if (leftModel == null || rightModel == null) {
    return {ruleName: 'model', matched: false, detail: false, label: 'One unknown', leftValue: leftModel, rightValue: rightModel};
  }
  const leftClean = leftModel.toUpperCase().replace(/\s+/g, ' ').trim();
  const rightClean = rightModel.toUpperCase().replace(/\s+/g, ' ').trim();
  // Fuzzy: "870" matches "870 EVO", "A400" matches "A400", etc.
  const bothHaveNumbers = /\d/.test(leftModel) && /\d/.test(rightModel);
  if (bothHaveNumbers) {
    const leftNumbers = leftModel.match(/\d+/g);
    const rightNumbers = rightModel.match(/\d+/g);
    if (leftNumbers && rightNumbers) {
      for (const ln of leftNumbers) {
        for (const rn of rightNumbers) {
          if (ln === rn) {
            return {ruleName: 'model', matched: true, detail: true, label: 'Model number match', leftValue: leftModel, rightValue: rightModel};
          }
        }
      }
    }
  }
  return {ruleName: 'model', matched: leftClean === rightClean, detail: true, label: leftClean, leftValue: leftClean, rightValue: rightClean};
}

/**
 * Compare family.
 * @param {string} leftFamily - Left product family
 * @param {string} rightFamily - Right product family
 * @returns {{ruleName: string, matched: boolean, detail: boolean, string, rightValue: string}}
 */
function compareFamily(leftFamily, rightFamily) {
  if (leftFamily == null && rightFamily == null) {
    return {ruleName: 'family', matched: true, detail: false, label: 'Both unknown', leftValue: null, rightValue: null};
  }
  if (leftFamily == null || rightFamily == null) {
    // Family unknown still counts as partial match
    return {ruleName: 'family', matched: true, detail: false, label: 'One unknown, partial match', leftValue: leftFamily, rightValue: rightFamily};
  }
  const lowerLeft = leftFamily.toUpperCase().trim();
  const lowerRight = rightFamily.toUpperCase().trim();
  return {ruleName: 'family', matched: lowerLeft === lowerRight, detail: true, label: 'Family match', leftValue: lowerLeft, rightValue: lowerRight};
}

/**
 * Compare capacity.
 * @param {number} leftCapacityGB - Left capacity in GB
 * @param {number} rightCapacityGB - Right capacity in GB
 * @returns {{ruleName: string, matched: boolean, detail: boolean, string, rightValue: string}}
 */
function compareCapacity(leftCapacityGB, rightCapacityGB) {
  if (leftCapacityGB == null && rightCapacityGB == null) {
    return {ruleName: 'capacity', matched: true, detail: false, label: 'Both unknown', leftValue: null, rightValue: null};
  }
  if (leftCapacityGB == null || rightCapacityGB == null) {
    return {ruleName: 'capacity', matched: false, detail: false, label: 'One unknown', leftValue: leftCapacityGB, rightValue: rightCapacityGB};
  }
  // Allow 5% tolerance for rounding differences
  const diffRatio = Math.abs(leftCapacityGB - rightCapacityGB) / Math.max(leftCapacityGB, rightCapacityGB);
  const matched = diffRatio <= 0.05;
  const leftStr = `${leftCapacityGB}GB`;
  const rightStr = `${rightCapacityGB}GB`;
  return {ruleName: 'capacity', matched, detail: true, label: matched ? 'Capacity match' : 'Capacity mismatch', leftValue: leftStr, rightValue: rightStr};
}

/**
 * Compare interface.
 * @param {string} leftInterface - Left interface
 * @param {string} rightInterface - Right interface
 * @returns {{ruleName: string, matched: boolean, detail: boolean, string, rightValue: string}}
 */
function compareInterface(leftInterface, rightInterface) {
  if (leftInterface == null && rightInterface == null) {
    return {ruleName: 'interface', matched: true, detail: false, leftValue: null, rightValue: null};
  }
  if (leftInterface == null || rightInterface == null) {
    return {ruleName: 'interface', matched: false, detail: false, label: 'One unknown', leftValue: leftInterface, rightValue: rightInterface};
  }
  const lowerLeft = leftInterface.toUpperCase().trim();
  const lowerRight = rightInterface.toUpperCase().trim();
  const compatKey = `${lowerLeft},${lowerRight}`;
  if (COMPATIBLE_INTERFACES.has(compatKey)) {
    return {ruleName: 'interface', matched: true, detail: true, label: 'Compatible interface', leftValue: leftInterface, rightValue: rightInterface};
  }
  return {ruleName: 'interface', matched: lowerLeft === lowerRight, detail: true, label: lowerLeft === lowerRight ? 'Interface match' : 'Interface mismatch', leftValue: lowerLeft, rightValue: lowerRight};
}

/**
 * Compare protocol.
 * @param {string} leftProtocol - Left protocol
 * @param {string} rightProtocol - Right protocol
 * @returns {{ruleName: string, matched: boolean, detail: boolean, string, rightValue: string}}
 */
function compareProtocol(leftProtocol, rightProtocol) {
  if (leftProtocol == null && rightProtocol == null) {
    return {ruleName: 'interface', matched: true, detail: false, label: 'Both protocol unknown', leftValue: null, rightValue: null};
  }
  if (leftProtocol == null || rightProtocol == null) {
    return {ruleName: 'interface', matched: false, detail: false, label: 'One unknown', leftValue: leftProtocol, rightValue: rightProtocol};
  }
  const lowerLeft = leftProtocol.toUpperCase().trim();
  const lowerRight = rightProtocol.toUpperCase().trim();
  return {ruleName: 'interface', matched: lowerLeft === lowerRight, detail: true, label: lowerLeft === lowerRight ? 'Protocol match' : 'Protocol mismatch', leftValue: lowerLeft, rightValue: lowerRight};
}

/**
 * Compare PCIe generation.
 * @param {number} leftGen - Left PCIe generation
 * @param {number} rightGen - Right PCIe generation
 * @returns {{ruleName: string, matched: string|number, detail: boolean, string, rightValue: number}}
 */
function comparePcieGeneration(leftGen, rightGen) {
  if (leftGen == null && rightGen == null) {
    return {ruleName: 'pcieGeneration', matched: true, detail: false, label: 'Both unknown', leftValue: null, rightValue: null};
  }
  if (leftGen == null || rightGen == null) {
    return {ruleName: 'pcieGeneration', matched: false, detail: false, label: 'One unknown', leftValue: leftGen, rightValue: rightGen};
  }
  // Adjacent generations count as partial match
  const diff = Math.abs(leftGen - rightGen);
  const matched = diff <= 1;
  const label = matched ? 'Adjacent (or equal) PCIe gen' : 'Different PCIe generation';
  return {ruleName: 'pcieGeneration', matched, detail: true, label, leftValue: leftGen, rightValue: rightGen};
}

/**
 * Compare form factor.
 * @param {string} leftForm - Left form factor
 * @param {string} rightForm - Right form factor
 * @returns {{ruleName: string, matched: boolean, detail: boolean, string, rightValue: string}}
 */
function compareFormFactor(leftForm, rightForm) {
  if (leftForm == null && rightForm == null) {
    return {ruleName: 'formFactor', matched: true, detail: false, label: 'Both unknown', leftValue: null, rightValue: null};
  }
  if (leftForm == null || rightForm == null) {
    return {ruleName: 'formFactor', matched: false, detail: false, label: 'One unknown', leftForm, rightValue: rightForm};
  }
  const lowerLeft = leftForm.toUpperCase().trim();
  const lowerRight = rightForm.toUpperCase().trim();
  const compatKey = `${lowerLeft},${lowerRight}`;
  if (COMPATIBLE_FORM_FACTORS.has(compatKey)) {
    return {ruleName: 'formFactor', matched: true, detail: true, label: 'Compatible form factor', leftValue: leftForm, rightValue: rightForm};
  }
  return {ruleName: 'formFactor', matched: lowerLeft === lowerRight, detail: true, label: lowerLeft === lowerRight ? 'Form factor match' : 'Form factor mismatch', leftValue: lowerLeft, rightValue: lowerRight};
}

// ====================================================================
// Main matching entry point
// ====================================================================

/**
 * Match two canonical storage device products extracted from different retailers.
 *
 * @param {Object} left - Left product (result from StorageDeviceExtractor.extract())
 * @param {Object} right - Right product (result from StorageDeviceExtractor.extract())
 * @returns {{verdict: string, confidence: number, evidence: Array, results: Array}}
 *
 * Verdicts:
 * - 'IDENTICAL' - Very high confidence (>=0.9)
 * - 'LIKELY_IDENTICAL' - Good confidence (0.7-0.9)
 * - 'DIFFERENT' - Moderate confidence they differ (0.4-0.7)
 * - 'UNKNOWN' - Low confidence (<0.4)
 */
function matchProducts(left, right) {
  const comparison = ComparisonEngine.compare(left, right);
  const evidence = comparison.reasons.map(function(reason) {
    return {
      rule: reason.field,
      left: reason.leftValue,
      right: reason.rightValue,
      matched: reason.status !== 'MISMATCH',
      detail: reason.reason,
      status: reason.status,
      canonicalValue: reason.canonicalValue,
    };
  });

  return {
    verdict: comparison.verdict,
    confidence: comparison.confidence,
    evidence,
    reasons: comparison.reasons,
    identicalFields: comparison.identicalFields,
    differingFields: comparison.differingFields,
    unknownFields: comparison.unknownFields,
  };
}

/**
 * Match a single product against a product from another retailer.
 * Convenience wrapper that accepts titles.
 *
 * @param {Object} left - Left product (from extract())
 * @param {Object} right - Right product (from extract())
 * @returns {Object} Match result with verdict, confidence, evidence
 */
function matchTitles(leftTitle, rightTitle, options) {
  options = options || {};
  const left = options.leftExtract || StorageDeviceExtractor.extract(leftTitle, options);
  const right = options.rightExtract || StorageDeviceExtractor.extract(rightTitle, options);
  return matchProducts(left, right);
}

// ====================================================================
// Exports
// ====================================================================

const ProductMatch = {
  VERDICTS,
  COMPATIBLE_INTERFACES,
  COMPATIBLE_FORM_FACTORS,
  compareSku,
  compareBrand,
  compareModel,
  compareFamily,
  compareCapacity,
  compareInterface,
  compareProtocol,
  comparePcieGeneration,
  compareFormFactor,
  matchProducts,
  matchTitles,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductMatch;
  module.exports.VERDICTS = ProductMatch.VERDICTS;
  module.exports.COMPATIBLE_INTERFACES = ProductMatch.COMPATIBLE_INTERFACES;
  module.exports.COMPATIBLE_FORM_FACTORS = ProductMatch.COMPATIBLE_FORM_FACTORS;
  module.exports.compareSku = ProductMatch.compareSku;
  module.exports.compareBrand = ProductMatch.compareBrand;
  module.exports.compareModel = ProductMatch.compareModel;
  module.exports.compareFamily = ProductMatch.compareFamily;
  module.exports.compareCapacity = ProductMatch.compareCapacity;
  module.exports.compareInterface = ProductMatch.compareInterface;
  module.exports.compareProtocol = ProductMatch.compareProtocol;
  module.exports.comparePcieGeneration = ProductMatch.comparePcieGeneration;
  module.exports.compareFormFactor = ProductMatch.compareFormFactor;
  module.exports.matchProducts = ProductMatch.matchProducts;
  module.exports.matchTitles = ProductMatch.matchTitles;
}

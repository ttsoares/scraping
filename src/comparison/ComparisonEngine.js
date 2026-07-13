'use strict';

const ComparisonReason = require('./ComparisonReason');

// ====================================================================
// Constants
// ====================================================================

const VERDICTS = Object.freeze({
  IDENTICAL: 'IDENTICAL',
  LIKELY_IDENTICAL: 'LIKELY_IDENTICAL',
  DIFFERENT: 'DIFFERENT',
  UNKNOWN: 'UNKNOWN',
});

// Known interface aliases that indicate the same protocol family.
const COMPATIBLE_INTERFACES = Object.freeze(new Set([
  'NVME,M.2', 'M.2,NVME',
  'PCIE,M.2', 'M.2,PCIE',
  'PCIE,NVME', 'NVME,PCIE',
]));

// Known form-factor compatibility pairs.
const COMPATIBLE_FORM_FACTORS = Object.freeze(new Set([
  'M.2,2280', '2280,M.2',
  '2.5",SATA', 'SATA,2.5"',
]));

// ====================================================================
// Helper utils
// ====================================================================

function clamp(v, lo, hi) {
  return Math.max(Math.min(v, hi), lo);
}

function round(v, d) {
  d = d || 2;
  return Math.round(v * Math.pow(10, d)) / Math.pow(10, d);
}

function isPresent(v) {
  return v != null && v !== '';
}

// ====================================================================
// Individual field comparers
// Each returns { reason: ComparisonReason, matched: boolean }
// ====================================================================

function compareBrand(left, right) {
  if (!isPresent(left.brand) && !isPresent(right.brand)) {
    return { reason: ComparisonReason.reasonUnknown('brand', 'Both brands unknown'), matched: true };
  }
  if (!isPresent(left.brand) || !isPresent(right.brand)) {
    return { reason: ComparisonReason.reasonMismatch('brand', left.brand, right.brand, 'One brand unknown'), matched: false };
  }
  const a = left.brand.toUpperCase().trim();
  const b = right.brand.toUpperCase().trim();
  const alias = (a === 'WD' && b === 'WESTERN DIGITAL')
             || (a === 'WESTERN DIGITAL' && b === 'WD')
             || (a === 'WD' && b === 'WD BLUE')
             || (a === 'WD BLUE' && b === 'WD');
  const matched = alias || (a === b);
  const reason = matched
    ? ComparisonReason.reasonMatch('brand', left.brand, right.brand, alias ? 'Brand alias match' : 'Brand match')
    : ComparisonReason.reasonMismatch('brand', left.brand, right.brand, 'Brand mismatch');
  return { reason, matched };
}

function compareFamily(left, right) {
  if (!isPresent(left.family) && !isPresent(right.family)) {
    return { reason: ComparisonReason.reasonUnknown('family', 'Both families unknown'), matched: true };
  }
  if (!isPresent(left.family) || !isPresent(right.family)) {
    return { reason: ComparisonReason.reasonMismatch('family', left.family, right.family, 'One family unknown'), matched: false };
  }
  const a = left.family.toUpperCase().trim();
  const b = right.family.toUpperCase().trim();
  const matched = a === b;
  const reason = matched
    ? ComparisonReason.reasonMatch('family', left.family, right.family, 'Family match')
    : ComparisonReason.reasonMismatch('family', left.family, right.family, 'Family mismatch (' + a + ' != ' + b + ')');
  return { reason, matched };
}

function compareModel(left, right) {
  if (!isPresent(left.model) && !isPresent(right.model)) {
    return { reason: ComparisonReason.reasonUnknown('model', 'Both models unknown'), matched: true };
  }
  if (!isPresent(left.model) || !isPresent(right.model)) {
    return { reason: ComparisonReason.reasonMismatch('model', left.model, right.model, 'One model unknown'), matched: false };
  }
  const a = left.model.toUpperCase().replace(/\s+/g, ' ').trim();
  const b = right.model.toUpperCase().replace(/\s+/g, ' ').trim();
  // Fuzzy: match if numeric portions overlap (e.g., "870 EVO" matches "870")
  let matched = (a === b);
  if (!matched && /\d/.test(left.model) && /\d/.test(right.model)) {
    const numsA = left.model.match(/\d+/g) || [];
    const numsB = right.model.match(/\d+/g) || [];
    for (let i = 0; i < numsA.length && !matched; i++) {
      for (let j = 0; j < numsB.length && !matched; j++) {
        if (numsA[i] === numsB[j]) matched = true;
      }
    }
  }
  const reason = matched
    ? ComparisonReason.reasonMatch('model', left.model, right.model, 'Model match')
    : ComparisonReason.reasonMismatch('model', left.model, right.model, 'Model mismatch');
  return { reason, matched };
}

function compareManufacturerSku(left, right) {
  if (!isPresent(left.manufacturerSku) && !isPresent(right.manufacturerSku)) {
    return { reason: ComparisonReason.reasonUnknown('manufacturerSku', 'Both SKUs unknown'), matched: true };
  }
  if (!isPresent(left.manufacturerSku) || !isPresent(right.manufacturerSku)) {
    return { reason: ComparisonReason.reasonMismatch('manufacturerSku', left.manufacturerSku, right.manufacturerSku, 'One SKU unknown'), matched: false };
  }
  const a = left.manufacturerSku.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const b = right.manufacturerSku.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const matched = a === b;
  const reason = matched
    ? ComparisonReason.reasonMatch('manufacturerSku', left.manufacturerSku, right.manufacturerSku, 'SKU match')
    : ComparisonReason.reasonMismatch('manufacturerSku', left.manufacturerSku, right.manufacturerSku, 'SKU mismatch');
  return { reason, matched };
}

function compareCapacity(left, right) {
  const leftGB = left.capacityGB;
  const rightGB = right.capacityGB;
  const leftPresent = isPresent(leftGB);
  const rightPresent = isPresent(rightGB);

  if (!leftPresent && !rightPresent) {
    return { reason: ComparisonReason.reasonUnknown('capacity', 'Both capacities unknown'), matched: true };
  }
  if (!leftPresent || !rightPresent) {
    const lv = leftPresent ? leftGB + 'GB' : 'Unknown';
    const rv = rightPresent ? rightGB + 'GB' : 'Unknown';
    return { reason: ComparisonReason.reasonMismatch('capacity', lv, rv, 'One capacity unknown'), matched: false };
  }

  const ratio = Math.abs(leftGB - rightGB) / Math.max(leftGB, rightGB);
  const matched = ratio <= 0.05; // 5% tolerance
  const canonical = matched ? round(Math.min(leftGB, rightGB) + Math.max(leftGB, rightGB), 0) / 2 + 'GB' : 'Different';
  const reason = matched
    ? ComparisonReason.reasonMatch('capacity', leftGB + 'GB', rightGB + 'GB',
        ratio === 0 ? 'Capacity match' : 'Capacity match (within 5% tolerance)', 'MATCH')
    : ComparisonReason.reasonMismatch('capacity', leftGB + 'GB', rightGB + 'GB',
        'Capacity mismatch (' + leftGB + 'GB vs ' + rightGB + 'GB, diff=' + round(ratio * 100) + '%)', 'MISMATCH');
  return { reason, matched };
}

function compareInterface(left, right) {
  const leftI = left.interface;
  const rightI = right.interface;
  const leftPresent = isPresent(leftI);
  const rightPresent = isPresent(rightI);

  if (!leftPresent && !rightPresent) {
    return { reason: ComparisonReason.reasonUnknown('interface', 'Both interfaces unknown'), matched: true };
  }
  if (!leftPresent || !rightPresent) {
    const lv = leftPresent ? leftI : 'Unknown';
    const rv = rightPresent ? rightI : 'Unknown';
    return { reason: ComparisonReason.reasonMismatch('interface', lv, rv, 'One interface unknown'), matched: false };
  }

  const a = leftI.toUpperCase().trim();
  const b = rightI.toUpperCase().trim();
  const compatKey = a + ',' + b;
  const compatible = COMPATIBLE_INTERFACES.has(compatKey);
  const matched = a === b || compatible;
  const reason = matched
    ? ComparisonReason.reasonMatch('interface', leftI, rightI, compatible ? 'Interface compatible (' + a + '/ ' + b + ')' : 'Interface match')
    : ComparisonReason.reasonMismatch('interface', leftI, rightI, 'Interface mismatch');
  return { reason, matched };
}

function compareProtocol(left, right) {
  const leftP = left.protocol;
  const rightP = right.protocol;
  const leftPresent = isPresent(leftP);
  const rightPresent = isPresent(rightP);

  if (!leftPresent && !rightPresent) {
    return { reason: ComparisonReason.reasonUnknown('protocol', 'Both protocols unknown'), matched: true };
  }
  if (!leftPresent || !rightPresent) {
    const lv = leftPresent ? leftP : 'Unknown';
    const rv = rightPresent ? rightP : 'Unknown';
    return { reason: ComparisonReason.reasonMismatch('protocol', lv, rv, 'One protocol unknown'), matched: false };
  }

  const a = leftP.toUpperCase().trim();
  const b = rightP.toUpperCase().trim();
  const matched = a === b;
  const reason = matched
    ? ComparisonReason.reasonMatch('protocol', leftP, rightP, 'Protocol match')
    : ComparisonReason.reasonMismatch('protocol', leftP, rightP, 'Protocol mismatch');
  return { reason, matched };
}

function comparePcieGeneration(left, right) {
  const leftPG = left.pcieGeneration;
  const rightPG = right.pcieGeneration;
  const leftPresent = isPresent(leftPG);
  const rightPresent = isPresent(rightPG);

  if (!leftPresent && !rightPresent) {
    return { reason: ComparisonReason.reasonUnknown('pcieGeneration', 'Both PCIe generations unknown'), matched: true };
  }
  if (!leftPresent || !rightPresent) {
    const lv = leftPresent ? 'Gen' + leftPG : 'Unknown';
    const rv = rightPresent ? 'Gen' + rightPG : 'Unknown';
    return { reason: ComparisonReason.reasonMismatch('pcieGeneration', lv, rv, 'One PCIe generation unknown'), matched: false };
  }

  const diff = Math.abs(leftPG - rightPG);
  const matched = diff <= 1; // adjacent generations count
  const canonical = matched ? 'Gen' + (leftPG <= rightPG ? leftPG : rightPG) : 'Different';
  const reason = matched
    ? ComparisonReason.reasonMatch('pcieGeneration', 'Gen' + leftPG, 'Gen' + rightPG,
        leftPG === rightPG ? 'PCIe generation match' : 'Adjacent PCIe generation', 'MATCH')
    : ComparisonReason.reasonMismatch('pcieGeneration', 'Gen' + leftPG, 'Gen' + rightPG,
        'Different PCIe generation');
  return { reason, matched };
}

function compareFormFactor(left, right) {
  const leftFF = left.formFactor;
  const rightFF = right.formFactor;
  const leftPresent = isPresent(leftFF);
  const rightPresent = isPresent(rightFF);

  if (!leftPresent && !rightPresent) {
    return { reason: ComparisonReason.reasonUnknown('formFactor', 'Both form factors unknown'), matched: true };
  }
  if (!leftPresent || !rightPresent) {
    const lv = leftPresent ? leftFF : 'Unknown';
    const rv = rightPresent ? rightFF : 'Unknown';
    return { reason: ComparisonReason.reasonMismatch('formFactor', lv, rv, 'One form factor unknown'), matched: false };
  }

  const a = leftFF.toUpperCase().trim();
  const b = rightFF.toUpperCase().trim();
  const compatKey = a + ',' + b;
  const compatible = COMPATIBLE_FORM_FACTORS.has(compatKey);
  const matched = a === b || compatible;
  const reason = matched
    ? ComparisonReason.reasonMatch('formFactor', leftFF, rightFF, compatible ? 'Form factor compatible' : 'Form factor match')
    : ComparisonReason.reasonMismatch('formFactor', leftFF, rightFF, 'Form factor mismatch');
  return { reason, matched };
}

function compareWarranty(left, right) {
  const leftW = left.warranty;
  const rightW = right.warranty;
  const leftPresent = isPresent(leftW);
  const rightPresent = isPresent(rightW);

  if (!leftPresent && !rightPresent) {
    return { reason: ComparisonReason.reasonUnknown('warranty', 'Both warranties unknown'), matched: true };
  }
  if (!leftPresent || !rightPresent) {
    const lv = leftPresent ? leftW + ' months' : 'Unknown';
    const rv = rightPresent ? rightW + ' months' : 'Unknown';
    return { reason: ComparisonReason.reasonMismatch('warranty', lv, rv, 'One warranty unknown'), matched: false };
  }

  // Warranty values are in months (numbers).  Match if equal or within 1 month.
  const diff = Math.abs(leftW - rightW);
  const matched = diff <= 1;
  const reason = matched
    ? ComparisonReason.reasonMatch('warranty', leftW + ' months', rightW + ' months',
        leftW === rightW ? 'Warranty match' : 'Warranty within tolerance', 'MATCH')
    : ComparisonReason.reasonMismatch('warranty', leftW + ' months', rightW + ' months', 'Warranty mismatch');
  return { reason, matched };
}

// ====================================================================
// Main comparison engine
// ====================================================================

/**
 * Compare two canonical products from different retailers.
 *
 * @param {Object} left - Left canonical product
 * @param {Object} right - Right canonical product
 * @returns {Object} Comparison result
 */
function compare(left, right) {
  if (!left || !right) {
    return {
      verdict: VERDICTS.UNKNOWN,
      confidence: 0.5,
      reasons: [ComparisonReason.reasonUnknown('overall', 'One or both products missing')],
      identicalFields: [],
      differingFields: [],
      unknownFields: [],
    };
  }

  const comparisons = [
    compareManufacturerSku(left, right),
    compareBrand(left, right),
    compareModel(left, right),
    compareFamily(left, right),
    compareCapacity(left, right),
    compareInterface(left, right),
    compareProtocol(left, right),
    comparePcieGeneration(left, right),
    compareFormFactor(left, right),
  ];

  // Warranty is optional — only compare if both have it
  if (isPresent(left.warranty) || isPresent(right.warranty)) {
    comparisons.push(compareWarranty(left, right));
  }

  // Classify fields
  const identicalFields = [];
  const differingFields = [];
  const unknownFields = [];
  for (let i = 0; i < comparisons.length; i++) {
    const r = comparisons[i].reason;
    if (r.status === 'MATCH') {
      identicalFields.push(r);
    } else if (r.status === 'MISMATCH') {
      differingFields.push(r);
    } else {
      unknownFields.push(r);
    }
  }

  // Compute confidence
  const total = comparisons.length;
  const matchCount = comparisons.filter(function(c) { return c.matched; }).length;
  const matchRatio = matchCount / total;

  // Unknown fields add a small penalty
  const unknownPenalty = (unknownFields.length / total) * 0.1;
  const confidence = round(clamp(matchRatio - unknownPenalty, 0, 1));

  // Determine verdict
  let verdict;
  if (confidence >= 0.9) {
    verdict = VERDICTS.IDENTICAL;
  } else if (confidence >= 0.7) {
    verdict = VERDICTS.LIKELY_IDENTICAL;
  } else if (confidence >= 0.4) {
    verdict = VERDICTS.DIFFERENT;
  } else {
    verdict = VERDICTS.UNKNOWN;
  }

  return {
    verdict: verdict,
    confidence: confidence,
    reasons: comparisons.map(function(c) { return c.reason; }),
    identicalFields: identicalFields,
    differingFields: differingFields,
    unknownFields: unknownFields,
  };
}

/**
 * Compare two or more products at once.
 *
 * @param {Array} products - Array of canonical products
 * @returns {Object} Array of pairwise comparisons
 */
function compareMany(products) {
  if (!Array.isArray(products) || products.length === 0) {
    return { results: [], pairs: 0 };
  }

  const results = [];
  for (let i = 0; i < products.length; i++) {
    for (let j = i + 1; j < products.length; j++) {
      results.push({
        left: products[i],
        right: products[j],
        comparison: compare(products[i], products[j]),
      });
    }
  }

  return { results: results, pairs: results.length };
}

/**
 * Build a human-readable report string from a comparison result.
 *
 * @param {Object} comp - Result from compare()
 * @returns {string} Markdown report
 */
function report(comp) {
  const lines = [];
  lines.push('# Product Comparison Report');
  lines.push('');
  lines.push('## Verdict: ' + comp.verdict + ' (confidence: ' + comp.confidence + ')');
  lines.push('');

  lines.push('## Identical Specifications');
  if (comp.identicalFields.length === 0) {
    lines.push('- None');
  } else {
    comp.identicalFields.forEach(function(f) {
      lines.push('- **' + f.field + '**: ' + f.canonicalValue + ' (' + f.reason + ')');
    });
  }
  lines.push('');

  lines.push('## Differing Specifications');
  if (comp.differingFields.length === 0) {
    lines.push('- None');
  } else {
    comp.differingFields.forEach(function(f) {
      lines.push('- **' + f.field + '**: ' + f.leftValue + ' vs ' + f.rightValue + ' (' + f.reason + ')');
    });
  }
  lines.push('');

  lines.push('## Unknown Specifications');
  if (comp.unknownFields.length === 0) {
    lines.push('- None (all fields resolved)');
  } else {
    comp.unknownFields.forEach(function(f) {
      lines.push('- **' + f.field + '**: ' + f.reason);
    });
  }
  lines.push('');

  lines.push('## All ComparisonReason Objects');
  lines.push('');
  comp.reasons.forEach(function(r, idx) {
    lines.push('' + (idx + 1) + '. ' + '**' + r.field + '** — status=' + r.status + ', left=' + r.leftValue + ', right=' + r.rightValue + ', canonical=' + r.canonicalValue);
  });
  lines.push('');

  return lines.join('\n');
}

// ====================================================================
// Exports
// ====================================================================

const ComparisonEngine = {
  VERDICTS: VERDICTS,
  COMPATIBLE_INTERFACES: COMPATIBLE_INTERFACES,
  COMPATIBLE_FORM_FACTORS: COMPATIBLE_FORM_FACTORS,
  compare: compare,
  compareMany: compareMany,
  report: report,
  // Individual comparers (for re-use / testing)
  compareBrand: compareBrand,
  compareFamily: compareFamily,
  compareModel: compareModel,
  compareManufacturerSku: compareManufacturerSku,
  compareCapacity: compareCapacity,
  compareInterface: compareInterface,
  compareProtocol: compareProtocol,
  comparePcieGeneration: comparePcieGeneration,
  compareFormFactor: compareFormFactor,
  compareWarranty: compareWarranty,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ComparisonEngine;
  module.exports.VERDICTS = ComparisonEngine.VERDICTS;
  module.exports.COMPATIBLE_INTERFACES = ComparisonEngine.COMPATIBLE_INTERFACES;
  module.exports.COMPATIBLE_FORM_FACTORS = ComparisonEngine.COMPATIBLE_FORM_FACTORS;
  module.exports.compare = ComparisonEngine.compare;
  module.exports.compareMany = ComparisonEngine.compareMany;
  module.exports.report = ComparisonEngine.report;
  module.exports.compareBrand = ComparisonEngine.compareBrand;
  module.exports.compareFamily = ComparisonEngine.compareFamily;
  module.exports.compareModel = ComparisonEngine.compareModel;
  module.exports.compareManufacturerSku = ComparisonEngine.compareManufacturerSku;
  module.exports.compareCapacity = ComparisonEngine.compareCapacity;
  module.exports.compareInterface = ComparisonEngine.compareInterface;
  module.exports.compareProtocol = ComparisonEngine.compareProtocol;
  module.exports.comparePcieGeneration = ComparisonEngine.comparePcieGeneration;
  module.exports.compareFormFactor = ComparisonEngine.compareFormFactor;
  module.exports.compareWarranty = ComparisonEngine.compareWarranty;
}

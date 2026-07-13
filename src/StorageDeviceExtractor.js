/**
 * Lookup tables for SSD normalization (case-insensitive).
 */
const BRAND_ALIASES = {
  'samsung': 'Samsung',
  'kingston': 'Kingston',
  'crucial': 'Crucial',
  'WD': 'WD',
  'western digital': 'WD',
  'WD Black': 'WD Black',
  'WD Blue': 'WD Blue',
  'Corsair': 'Corsair',
  'Lexar': 'Lexar',
  'XPG': 'XPG',
  'Intel': 'Intel',
  'AMD': 'AMD',
  'NVIDIA': 'NVIDIA',
  'Seagate': 'Seagate',
  'Transcend': 'Transcend',
  'SanDisk': 'SanDisk',
  'KingSpec': 'KingSpec',
};

const CAPACITY_ALIASES = {
  '2280': 'M.2',
  '2260': 'M.2',
  '2242': 'M.2',
};

const INTERFACE_ALIASES = {
  'NVMe': 'NVMe',
  'm.2': 'M.2',
  'm2': 'M.2',
  'm-2': 'M.2',
  '2.5"': '2.5"',
  '2.5in': '2.5"',
  'SATA III': 'SATA',
  'SATA': 'SATA',
  'PCIe': 'PCIe',
};

const SSD_FAMILIES = {
  'EVO': 'EVO',
  'PRO': 'PRO',
  'PRO+': 'PRO+',
  'Plus': 'Plus',
  'VX': 'VX',
  'SV300': 'SV300',
  'SV200': 'SV200',
  'A400': 'A400',
  'A200': 'A200',
  'NV3': 'NV3',
  'NV2': 'NV2',
  'NV5': 'NV5',
  '870': '870',
  '980': '980',
  '990': '990',
  '840': '840',
  'MX500': 'MX500',
  'MX200': 'MX200',
  'MX300': 'MX300',
  'P3': 'P3',
  'P5': 'P5',
  'MP600': 'MP600',
  'MP330': 'MP330',
  'NM620': 'NM620',
  'NM790': 'NM790',
  'LM340': 'LM340',
  'KC3000': 'KC3000',
  'A2000': 'A2000',
  'SN550': 'SN550',
};

const FORM_FACTOR_ALIASES = {
  'm.2': 'M.2',
  'm2': 'M.2',
  'm-2': 'M.2',
  '2.5"': '2.5"',
  '2.5in': '2.5"',
  'm.2 2280': 'M.2',
};

/**
 * Deterministic SSD specification extractor.
 *
 * Supported brands (alias table resolved):
 *   Samsung  | Kingston  | WD       | Crucial
 *   Corsair  | Lexar     | XPG      | Intel/AMD/NVIDIA
 */
class StorageDeviceExtractor {
  constructor(options = {}) {
    this.brandAliases = options.brandAliases || BRAND_ALIASES;
    this.capacityAliases = options.capacityAliases || CAPACITY_ALIASES;
    this.formFactorAliases = options.formFactorAliases || FORM_FACTOR_ALIASES;
    this.interfaceAliases = options.interfaceAliases || INTERFACE_ALIASES;
    this.families = options.families || SSD_FAMILIES;
  }

  extract(title, options = {}) {
    if (!title || typeof title !== 'string') {
      throw new Error('extract() requires a non-null string title');
    }

    const { source, url } = options;
    const extracted = {
      category: 'StorageDevice',
      brand: null,
      model: null,
      family: null,
      manufacturerSku: null,
      capacityGB: null,
      capacityTB: null,
      canonicalCapacity: '',
      interface: null,
      protocol: null,
      pcieGeneration: null,
      formFactor: null,
      confidence: {},
      source,
      url,
    };

    const brandResult = this._detectBrand(title);
    extracted.brand = brandResult.brand;
    extracted.confidence.brand = brandResult.confidence;

    const modelResult = this._getModelAndFamily(title);
    extracted.model = modelResult.model;
    extracted.family = modelResult.family;
    extracted.confidence.model = modelResult.confidence;

    const capacityResult = this._extractCapacity(title);
    extracted.capacityGB = capacityResult.capacityGB;
    extracted.capacityTB = capacityResult.capacityTB;
    extracted.canonicalCapacity = capacityResult.canonical;
    extracted.confidence.capacityGB = capacityResult.confidence;

    const interfaceResult = this._detectInterface(title);
    extracted.interface = interfaceResult.interface;
    extracted.protocol = interfaceResult.protocol;
    extracted.pcieGeneration = interfaceResult.pcieGeneration;
    extracted.confidence.interface = interfaceResult.confidence;
    extracted.confidence.protocol = interfaceResult.protocolConfidence;
    extracted.confidence.pcieGeneration = interfaceResult.pcieConfidence;

    const formFactorResult = this._detectFormFactor(title);
    extracted.formFactor = formFactorResult.formFactor;
    extracted.confidence.formFactor = formFactorResult.confidence;

    const skuResult = this._extractManufacturerSku(title, extracted.family);
    extracted.manufacturerSku = skuResult.manufacturerSku;
    extracted.confidence.manufacturerSku = skuResult.confidence;

    const confValues = Object.values(extracted.confidence).filter(v => v != null);
    extracted.confidence.overall = confValues.length > 0
      ? Math.round((confValues.reduce((a, b) => a + b, 0) / confValues.length) * 100) / 100
      : 0.5;

    return extracted;
  }

  extractMany(titles, options = {}) {
    if (!Array.isArray(titles)) {
      throw new Error('extractMany() requires an array of titles');
    }
    return titles.map(t => this.extract(t, options)).filter(Boolean);
  }

  _detectBrand(title) {
    for (const [key, value] of Object.entries(this.brandAliases)) {
      const escaped = key.replace(/[.*+?${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${escaped}\\b`, 'i');
      if (re.test(title)) {
        return { brand: value.toUpperCase(), confidence: 0.9 };
      }
    }
    if (/\bWD\s+Black\b/i.test(title)) return { brand: 'WD BLACK', confidence: 0.95 };
    if (/\bWD\s+Blue\b/i.test(title)) return { brand: 'WD BLUE', confidence: 0.95 };
    return { brand: null, confidence: 0.6 };
  }

  _getModelAndFamily(title) {
    const patterns = [
      { regex: /(\d{3,4})\s+(EVO|PRO|PLUS|TFT|ITL)/i, familyIdx: 2, modelIdx: 1 },
      { regex: /(\d{3,4})\b/i, familyIdx: 1, modelIdx: 1 },
      { regex: /([A-Z]\d{2,4})\b/i, familyIdx: 1, modelIdx: 1 },
      { regex: /([A-Z]{2}\d{2,4})\b/i, familyIdx: 1, modelIdx: 1 },
      { regex: /\b(NV\d+)\b/i, familyIdx: 1, modelIdx: 1 },
    ];
    for (let { regex, familyIdx, modelIdx } of patterns) {
      const m = regex.exec(title);
      if (m && m[1]) {
        const familyUpper = m[familyIdx].toUpperCase();
        let family = familyUpper;
        if (this.families[familyUpper]) family = this.families[familyUpper];
        return { model: m[modelIdx], family: m[familyIdx], confidence: 0.85 };
      }
    }
    return { model: null, family: null, confidence: 0.5 };
  }

  _extractCapacity(title) {
    const tbMatch = title.match(/\b(\d+\.?\d*)\s*TB\b/i);
    if (tbMatch) {
      const tbVal = Math.round(parseFloat(tbMatch[1]) * 1000);
      return { capacityGB: tbVal, capacityTB: parseFloat(tbMatch[1]), canonical: `${tbVal}GB`, confidence: 0.95 };
    }
    const gbMatch = title.match(/\b(\d+\.?\d*)\s*GB\b/i);
    if (gbMatch) {
      const gbVal = Math.round(parseFloat(gbMatch[1]));
      return { capacityGB: gbVal, capacityTB: null, canonical: `${gbVal}GB`, confidence: 0.95 };
    }
    const gMatch = title.match(/\b(\d{3,4})G\b/i);
    if (gMatch) {
      const val = parseInt(gMatch[1], 10);
      return { capacityGB: val, capacityTB: null, canonical: `${val}GB`, confidence: 0.85 };
    }
    return { capacityGB: null, capacityTB: null, canonical: '', confidence: 0.5 };
  }

  _detectInterface(title) {
    const interfaces = [
      { value: 'NVMe',  pattern: /\bNV[Ee]?\b/ },
      { value: 'M.2',   pattern: /\b(2280)\b|\bM\.2\b/i },
      { value: 'M.2',   pattern: /\bM2\b/i },
      { value: 'PCIe',  pattern: /\bPCI[-\s]?[Ee](?:2|3|4|5)?\b/ },
      { value: 'SATA',  pattern: /\bSATA\s*(III|\b|3.0|6g\b|6\.0\b)?/i },
    ];
    let detectedInterface = null;
    let conf = 0.7;
    for (let { value, pattern } of interfaces) {
      if (pattern.test(title)) {
        const resolved = this.interfaceAliases[value] || value;
        detectedInterface = resolved;
        conf = this.interfaceAliases[value] ? 0.95 : 0.8;
        break;
      }
    }
    let protocol = null;
    let protocolConf = 0.7;
    if (detectedInterface === 'NVMe') { protocol = 'NVMe'; protocolConf = 0.95; }
    else if (detectedInterface === 'SATA') { protocol = 'SATA'; protocolConf = 0.95; }
    else if (detectedInterface === 'M.2' || detectedInterface === 'PCIe') {
      protocol = /\bNV[Ee]?\b/i.test(title) ? 'NVMe' : 'SATA';
      protocolConf = 0.75;
    }
    let pcieGen = null;
    let pcieConf = 0.7;
    const pciEPatterns = [
      { pattern: /\bGen[ _]?5\b/i, gen: 5 }, { pattern: /\bPCIe[ _]?5\b/i, gen: 5 },
      { pattern: /\bGen[ _]?4\b/i, gen: 4 }, { pattern: /\bPCIe[ _]?4\b/i, gen: 4 },
      { pattern: /\bGen[ _]?3\b/i, gen: 3 }, { pattern: /\bPCIe[ _]?3\b/i, gen: 3 },
      { pattern: /\bPCIe[ _]?5\.0\b/i, gen: 5, priority: true },
      { pattern: /\bPCIe[ _]?4\.0\b/i, gen: 4, priority: true },
      { pattern: /\bPCIe[ _]?3\.0\b/i, gen: 3, priority: true },
    ];
    for (let { pattern, gen } of pciEPatterns) {
      if (pattern.test(title)) { pcieGen = gen; pcieConf = 0.9; break; }
    }
    return { interface: detectedInterface, protocol, pcieGeneration: pcieGen, confidence: conf, protocolConfidence: protocolConf, pcieConfidence: pcieConf };
  }

  _detectFormFactor(title) {
    const formFactors = [
      { value: 'M.2',  pattern: /\bM\.[2-4][0-6]\b|\bM\.2\b/i },
      { value: '2.5"', pattern: /\b2\.5["']?\b/i },
    ];
    for (let { value, pattern } of formFactors) {
      if (pattern.test(title)) {
        const resolved = this.formFactorAliases[value] || value;
        return { formFactor: resolved, confidence: 0.9 };
      }
    }
    return { formFactor: null, confidence: 0.5 };
  }

  _extractManufacturerSku(title, family) {
    const kingstonPattern = /\b([A-Z]{2,4}\d{2,4}[A-Z]\d{2}\/\d+[A-Z])\b/;
    let skuMatch = kingstonPattern.exec(title);
    if (skuMatch) return { manufacturerSku: skuMatch[1], confidence: 0.95 };
    const samsungPattern = /\b([A-Z]{2}\d{3,5}[A-Z]{2,4})\b/;
    skuMatch = samsungPattern.exec(title);
    if (skuMatch) return { manufacturerSku: skuMatch[1], confidence: 0.85 };
    if (family && /\b(A\d{3}|M[XP]\d{3})\b/i.test(title)) {
      return { manufacturerSku: family, confidence: 0.7 };
    }
    return { manufacturerSku: null, confidence: 0.5 };
  }
}

const storageDeviceExtractor = new StorageDeviceExtractor();

const extract = (title, options = {}) => storageDeviceExtractor.extract(title, options);

const normalize = (title, source = null) => {
  const result = extract(title, { source });
  return {
    brand: result.brand || 'Unknown',
    model: result.model || 'Unknown',
    family: result.family || null,
    manufacturerSku: result.manufacturerSku || null,
    capacity: result.capacityGB || result.capacityTB,
    capacityUnit: result.capacityTB ? 'TB' : 'GB',
    interface: result.interface || null,
    protocol: result.protocol || null,
    pcieGeneration: result.pcieGeneration || null,
    formFactor: result.formFactor || null,
    confidence: result.confidence.overall || 0.5,
  };
};

module.exports = {
  StorageDeviceExtractor: storageDeviceExtractor,
  extract,
  normalize,
  BRAND_ALIASES,
  CAPACITY_ALIASES,
  INTERFACE_ALIASES,
  FORM_FACTOR_ALIASES,
};
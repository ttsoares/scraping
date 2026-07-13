# Storage Device Extractor

## Overview

The `StorageDeviceExtractor` extracts SSD specification from retailer product titles using deterministic, regex-based techniques.

## Usage

```javascript
const { extract, normalize, StorageDeviceExtractor } = require('../src/StorageDeviceExtractor');

// Single product extraction
const result = extract('SSD Samsung 870 EVO 500GB NVMe M.2');
// {
//   category: 'StorageDevice',
//   brand: 'SAMSUNG',
//   model: '870',
//   family: 'EVO',
//   capacityGB: 500,
//   interface: 'NVMe',
//   protocol: 'NVMe',
//   formFactor: 'M.2',
//   confidence: { overall: 0.85 }
// }

// Multiple products
const results = StorageDeviceExtractor.extractMany([
  'SSD Samsung 870 EVO 500GB',
  'SSD Kingston A400 480GB',
  'SSD WD Blue SN550 1TB',
]);

// Normalized representation
const normalized = normalize('SSD Corsair MP600 1TB PCIe Gen4 NVMe');
// {
//   brand: 'CORSAIR',
//   model: 'MP600',
//   family: 'MP600',
//   capacity: 1000,
//   capacityUnit: 'GB',
//   interface: 'PCIe',
//   protocol: 'NVMe',
//   pcieGeneration: 4,
//   formFactor: 'M.2',
//   confidence: 0.88
// }
```

## API

### `extract(title, options)`

Extracts a single product title into canonical fields.

**Parameters:**
- `title` (string) - Product title
- `options.source` (string) - Source retailer
- `options.url` (string) - Original URL

**Returns:** Object with brand, model, family, capacity, interface, protocol, formFactor, confidence.

### `extractMany(titles, options)`

Extracts multiple product titles in batch.

### `normalize(title, source)`

Convenience wrapper returning a compact normalized object.

## Supported Brands

Samsung, Kingston, WD (WD/WD Black/WD Blue), Crucial, Corsair, Lexar, XPG.

## Supported Form Factors

M.2, 2.5", Internal, External.

## Supported Interfaces

NVMe, M.2, SATA, PCIe.

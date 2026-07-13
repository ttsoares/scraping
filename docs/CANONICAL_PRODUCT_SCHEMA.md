# Canonical Product Schema

## Purpose

The Canonical Product Schema defines a retailer-independent representation for products scraped from Brazilian online retailers (Pichau, KaBuM, Mercado Livre). It enables comparing equivalent products regardless of the source retailer.

## Schema Definition

```
{
  // --- Classification ---
  "category":        string;    // Product category (e.g., "StorageDevice", "Processor", "GraphicsCard")
  "brand":           string;    // Brand name (resolved to canonical via alias table)
  "model":           string;    // Model number (e.g., "870", "A400", "MX500")
  "family":          string | null; // Family/series (e.g., "EVO", "PRO", "NV3")
  "manufacturerSku": string | null; // Original SKU (e.g., "SV300S37/480G")

  // --- Specifications ---
  "capacity":        number | null; // Storage capacity in GB or TB
  "interface":       string | null; // Connection type (e.g., "NVMe", "M.2", "SATA", "PCIe")
  "protocol":        string | null; // Protocol (e.g., "NVMe", "SATA")
  "pcieGeneration":  number | null; // PCIe generation (2, 3, 4, 5)
  "formFactor":      string | null; // Physical form (e.g., "M.2", "2.5\"")

  // --- Pricing ---
  "price":           number | null; // Price in original currency
  "currency":        string;        // Currency code (e.g., "BRL")

  // --- Availability ---
  "availability":    "in_stock" | "out_of_stock" | "unknown";

  // --- Metadata ---
  "confidence":      number;        // Overall confidence (0.0 - 1.0)
  "source":          string;        // Source retailer (e.g., "Pichau", "Kabum")
  "url":             string;        // Original product URL
}
```

## Alias Tables

### Brands

| Alias          | Canonical   |
| -------------- | ----------- |
| samsung        | SAMSUNG     |
| Kingston       | KINGSTON    |
| WD / Western Digital | WD   |
| WD Black       | WD BLACK    |
| WD Blue        | WD BLUE     |
| Crucial        | CRUCIAL     |
| Corsair        | CORSAIR     |
| Lexar          | LEXAR       |
| XPG            | XPG         |

### Interfaces

| Alias | Canonical |
| ----- | --------- |
| NVMe   | NVMe    |
| NV | NVMe    |
| M.2    | M.2     |
| m2    | M.2     |
| m-2    | M.2     |
| SATA   | SATA    |
| SATA III | SATA   |
| PCIe   | PCIe    |

### Form Factors

| Alias | Canonical |
| ----- | --------- |
| M.2    | M.2    |
| 2280   | M.2    |
| 2.5"   | 2.5"   |
| 2.5in  | 2.5"   |

## Confidence Scoring

Confidence is computed per-field and aggregated:

- **Brand**: 0.6 (none detected) to 0.95 (alias resolved)
- **Model/Family**: 0.5 (null) to 0.85 (pattern match)
- **Capacity**: 0.5 (none) to 0.95 (explicit unit)
- **Interface**: 0.7 (detected) to 0.95 (alias resolved)
- **PCIe Generation**: 0.7 (none) to 0.95 (pattern match)
- **Form Factor**: 0.5 (none) to 0.9 (pattern match)

Overall confidence = average of all non-null field confidences.

## Examples

### Samsung 870 EVO 500GB SATA (2.5")

```
{
  "category": "StorageDevice",
  "brand": "SAMSUNG",
  "model": "870",
  "family": "EVO",
  "manufacturerSku": "870 EVO",
  "capacityGB": 500,
  "interface": "SATA",
  "protocol": "SATA",
  "pcieGeneration": null,
  "formFactor": "2.5\"",
  "confidence": {
    "brand": 0.9,
    "model": 0.85,
    "capacityGB": 0.95,
    "interface": 0.95,
    "pcieGeneration": 0.7,
    "formFactor": 0.9,
    "overall": 0.85
  }
}
```

### Corsair MP600 1TB PCIe Gen4 NVMe (M.2)

```
{
  "category": "StorageDevice",
  "brand": "CORSAIR",
  "model": "MP600",
  "family": "MP600",
  "manufacturerSku": "MP600",
  "capacityGB": 1000,
  "capacityTB": 1,
  "interface": "PCIe",
  "protocol": "NVMe",
  "pcieGeneration": 4,
  "formFactor": "M.2",
  "confidence": {
    "brand": 0.9,
    "model": 0.85,
    "capacityGB": 0.95,
    "interface": 0.85,
    "pcieGeneration": 0.9,
    "formFactor": 0.9,
    "overall": 0.88
  }
}
```

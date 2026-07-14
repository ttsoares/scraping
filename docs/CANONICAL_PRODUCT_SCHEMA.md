# Canonical Product Schema

## Overview

The Canonical Product Schema represents hardware products in a retailer-independent form that supports comparison across different data sources. It preserves raw retailer values while providing normalized fields for cross-retailer matching.

## Schema Fields

### Storage Device (primary category)

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `category` | string | Product category identifier | `StorageDevice` |
| `brand` | string \| null | Normalized brand name | `null` (unknown) |
| `family` | string \| null | Product family/line | `null` (unknown) |
| `model` | string \| null | Model identifier | `null` (unknown) |
| `manufacturerSku` | string \| null | OEM SKU/MPN | `null` (unknown) |
| `capacityGB` | number \| null | Capacity in gigabytes | `null` (unknown) |
| `capacityTB` | number \| null | Capacity in terabytes | `null` (unknown) |
| `canonicalCapacity` | string | Canonical capacity label (e.g., `"2000GB"`) | `null` |
| `interface` | string \| null | Physical/logical interface | `null` (unknown) |
| `protocol` | string \| null | Communication protocol | `null` (unknown) |
| `pcieGeneration` | number \| null | PCIe generation number | `null` (unknown) |
| `formFactor` | string \| null | Physical dimensions | `null` (unknown) |
| `warranty` | number \| null | Warranty period in months | `null` (unknown) |
| `availability` | string \| null | Availability status | `null` (unknown) |
| `source` | string \| null | Source retailer | `null` |

## Field Semantics

### Brand
- Normalized to canonical form (e.g., `WESTERN DIGITAL` -> `WD`)
- Case-insensitive comparison
- Known aliases: `WD` <-> `WESTERN DIGITAL` <-> `WD BLUE`

### Model
- Numeric portions preserved and compared
- Fuzzy matching: model with different trailing text can match if numeric portions align
- Whitespace normalized to single space

### Family
- Product family designator (e.g., `PRO`, `EVO`, `X`, `GT`)
- Case-insensitive exact match

### Capacity
- `capacityGB`: Integer or float capacity in gigabytes
- `capacityTB`: Alternative representation in terabytes
- `canonicalCapacity`: Human-readable label derived from `capacityGB`
- Tolerance: 5% difference counts as a match

### Interface
- Physical connector: `M.2`, `SATA`, `PCIe`, `SFF-8643`, etc.
- Compatibility pairs: `M.2` <-> `PCIe`, `NVMe` <-> `PCIe`

### Protocol
- Data protocol: `NVMe`, `SATA`, `PCIe`, etc.
- Exact match (case-insensitive)

### PCIe Generation
- Integer: 3, 4, 5, etc.
- Adjacent generations (diff <= 1) count as compatible

### Form Factor
- Physical dimensions: `M.2`, `2280`, `2.5"`, `3.5"`, `U.2`
- Compatibility pairs: `M.2` <-> `2280`, `2.5"` <-> `SATA`

### Manufacturer SKU
- OEM part number / MPN
- Alphanumeric, case-insensitive
- Non-alphanumeric characters normalized (ignored in comparison)

### Availability
- Computed from retailer data
- Examples: `in_stock`, `out_of_stock`, `preorder`, `discontinued`

## Unknown Value Handling

Unknown values are represented as `null` (not empty string). A null field:
- Does not cause a mismatch when compared to another null
- Counts as partially matching when compared to a known value (penalizes confidence, not verdict)
- Remains `null` in all canonical comparisons (never auto-assigned)

## Canonical Capacity Labels

| capacityGB | canonicalCapacity |
|-----------|-------------------|
| 120 | 120GB |
| 128 | 128GB |
| 240 | 240GB |
| 256 | 256GB |
| 480 | 480GB |
| 500 | 500GB |
| 512 | 512GB |
| 960 | 960GB |
| 1000 | 1000GB (1TB) |
| 1024 | 1024GB (1TB) |
| 2000 | 2000GB (2TB) |
| 2048 | 2048GB (2TB) |

## Normalized Values Table

### Interface Equivalence

| Original Values | Canonical |
|-----------------|-----------|
| M.2, M.2 NVMe | M.2 |
| PCIe, PCIE, PCIE M.2 | PCIe |
| SATA, SATA 6Gb/s | SATA |
| NVMe, NVME, NVMe M.2 | NVMe |

### Brand Equivalence

| Original | Canonical |
|----------|-----------|
| WD | WD |
| WESTERN DIGITAL | WD |
| WD BLUE | WD |
| SAMSUNG, Samsung | SAMSUNG |
| KINGSTON, Kingston | KINGSTON |
| CORSAIR, Corsair | CORSAIR |
| SK Hynix, SK hynix | SK_HYNIx |

### Form Factor Equivalence

| Original Values | Canonical |
|-----------------|-----------|
| 2280, M.2 2280 | 2280 |
| 2.5", 2.5 inch | 2.5" |
| U.2, SFF-8639 | U.2 |
| HHHL | HHHL |

## Extensibility

Category-specific schemas extend the base model:

- **CPU**: Add `socket`, `cores`, `clockSpeedGHz`
- **GPU**: Add `gpuMemoryGB`, `clockSpeedMHz`, `outputInterfaces`
- **MemoryModule**: Add `type` (DDR4/DDR5), `speedMHz`, `timing`

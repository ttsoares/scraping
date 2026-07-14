# Storage Device Schema

## Overview

The Storage Device schema defines a standardized representation for PC storage components (SSDs, HDDs, etc.). This category-specific model supports deterministic product comparison and enables detailed specification tracking across multiple retailers.

## Category Definition

StorageDevice represents any computer storage solution including:
- Solid State Drives (SSDs) 
- Hard Disk Drives (HDDs)
- NVMe drives
- SATA drives  
- External storage devices

## Schema Definition

```typescript
interface StorageDevice {
  // Core identification - required fields
  brand: string;                      // Manufacturer brand (e.g., "Samsung", "Western Digital")
  model: string;                      // Product model name (e.g., "980", "500GB")
  
  // Specification fields - required for deterministic matching 
  capacity_gb: number;                // Storage capacity in gigabytes
  interface: string;                  // Interface type (e.g., "NVMe", "SATA", "M.2")
  
  // Optional specification fields
  family?: string;                    // Product family (e.g., "980", "5000", "Q300") 
  manufacturer_sku?: string;          // Retailer's SKU or part number
  form_factor?: string;               // Physical form factor (e.g., "2.5\"", "M.2", "3.5\"")
  protocol?: string;                  // Storage protocol (e.g., "PCIe", "SATA II", "SATA III")
  pcie_generation?: number;           // PCIe generation if applicable (e.g., 3, 4)
  pcie_lanes?: number;                // PCIe lane count (e.g., 4, 8)
  nand_type?: string;                 // NAND flash type (e.g., "3D TLC", "3D QLC")
  dram_cache?: boolean;               // Whether device has DRAM cache
  sequential_read?: number;           // Sequential read speed in MB/s  
  sequential_write?: number;          // Sequential write speed in MB/s
  warranty_years?: number;            // Warranty period in years
  
  // Derived fields - computed from raw specifications
  is_ssd?: boolean;                   // True if solid state drive (derived)
  is_hdd?: boolean;                   // True if hard disk drive (derived)
  capacity_tb?: number;               // Capacity in terabytes (derived)
  
  // Product information  
  category: "StorageDevice";
  source: string;                     // Provider where this listing was found
  url: string;                        // Product URL
  confidence: number;                 // Confidence score 0.0-1.0
  
  // Provenance tracking for every field
  brand_confidence?: number;
  brand_source?: string;
  model_confidence?: number;
  model_source?: string;
  capacity_gb_confidence?: number;
  capacity_gb_source?: string;
  interface_confidence?: number;  
  interface_source?: string;
}
```

## Field Requirements

### Required Fields  

1. **brand**: Manufacturer name (cannot be null or empty)
2. **model**: Product model identifier (cannot be null or empty) 
3. **capacity_gb**: Storage capacity in gigabytes (positive number)
4. **interface**: Physical interface type (e.g., "NVMe", "SATA") 

### Optional Fields

All other fields are optional but support richer product understanding:

- **family**: Product family designation
- **manufacturer_sku**: Retailer's internal product identifier  
- **form_factor**: Physical form factor
- **protocol**: Storage protocol specification
- **pcie_generation**: PCIe generation version (3, 4, 5)
- **pcie_lanes**: Number of PCIe lanes (4, 8, etc.)
- **nand_type**: NAND flash technology type
- **dram_cache**: Boolean indicating DRAM cache presence
- **sequential_read/write**: Performance benchmark values
- **warranty_years**: Warranty period in years

### Derived Fields

Computed values that are automatically generated from primary specifications:

- **is_ssd**: Determined by storage technology characteristics  
- **is_hdd**: Determined by whether it's a magnetic drive
- **capacity_tb**: Calculated as capacity_gb / 1024

## Normalization Rules

### Brand Recognition
- Standardize brand names to consistent casing and spelling 
- Map "WD" to "Western Digital", "NVIDIA" to "Nvidia", etc.
- Match against comprehensive brand dictionary

### Model Extraction
- Extract model numbers (e.g., "980", "500", "A400")
- Parse product families from title variations  
- Handle alphanumeric model identifiers consistently

### Capacity Parsing
- Convert all capacity specifications to gigabytes 
- Support formats: "500GB", "1TB", "2.5 TB"  
- Normalize decimal separators (comma vs period)

### Interface Classification
- Standardize interface types:
  - "NVMe" → PCIe Gen 3/4/5 interface
  - "SATA" → SATA III interface 
  - "M.2" → Specific form factor for NVMe SSDs
- Recognize interface variations and map to canonical forms

### Performance Metrics
- Sequential read/write speeds should be numeric values in MB/s
- If no performance data, leave fields as null/undefined

## Canonical Product Matching

Storage devices are considered identical when all required specifications match:

1. **Brand** matches precisely  
2. **Model** matches exactly
3. **Capacity** matches within tolerance (typically 0-2% error)
4. **Interface** matches exactly
5. **Confidence** exceeds threshold (>0.9 for identical match)

## Examples

### SSD Example
```json
{
  "brand": "Samsung", 
  "model": "980",
  "capacity_gb": 500,
  "interface": "NVMe",
  "family": "980 Series",
  "form_factor": "M.2",
  "protocol": "PCIe",
  "pcie_generation": 4,
  "nand_type": "3D TLC", 
  "sequential_read": 5000,
  "sequential_write": 4500,
  "category": "StorageDevice",
  "source": "pichau",
  "url": "https://www.pichau.com.br/ssd-samsung-980-500gb",
  "confidence": 0.95,
  "brand_confidence": 0.98,
  "brand_source": "title",
  "model_confidence": 0.92,  
  "model_source": "title"
}
```

### HDD Example
```json
{
  "brand": "Western Digital", 
  "model": "Blue",
  "capacity_gb": 1000,
  "interface": "SATA",
  "form_factor": "3.5\"",
  "protocol": "SATA III",
  "warranty_years": 3,
  "category": "StorageDevice",
  "source": "kabum",
  "url": "https://www.kabum.com.br/hd-wd-blue-1tb",
  "confidence": 0.85,
  "brand_confidence": 0.90,
  "brand_source": "title"
}
```

## Confidence Scoring

Each field and the overall product receives a confidence score based on:

1. **Source reliability** (title=0.6, SKU parser=0.9, database lookup=1.0)
2. **Pattern matching quality**
3. **Consistency with other specifications  
4. **External validation availability**

## Implementation Considerations

1. **Backward Compatibility**: Existing data should be migratable
2. **Extensibility**: New storage technologies should not require breaking changes
3. **Performance**: Efficient parsing and normalization algorithms  
4. **Validation**: Comprehensive test suite for edge cases and validation rules

This schema provides the foundation for deterministic product comparison of storage devices across different retailers, enabling meaningful performance analysis and cross-retailer shopping experiences.
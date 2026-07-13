# Hardware Ontology

## Overview

The Hardware Ontology defines a structured taxonomy of PC hardware components and their relationships. This ontology serves as the foundation for creating category-specific canonical models that enable deterministic product comparison and meaningful semantic understanding across different retailers.

## Categories

The following main categories are defined within this hardware ontology:

1. **StorageDevice** - Includes SSDs, HDDs, and other storage solutions
2. **CPU** - Central Processing Units with their specifications
3. **GPU** - Graphics Processing Units  
4. **MemoryModule** - RAM modules and memory components
5. **Motherboard** - Computer motherboards and chipsets
6. **PowerSupply** - Power supply units (PSUs)
7. **Monitor** - Display devices
8. **Notebook** - Portable computing devices
9. **Case** - Computer cases and enclosures  
10. **Cooling** - Cooling solutions including fans, water blocks, etc.

Each category will have a specific schema with required fields, optional fields, and normalization rules that reflect the domain-specific characteristics of that hardware type.

## Category Relationships

Categories may have relationships based on compatibility and function:

- StorageDevice → CPU / GPU (in terms of interface and performance)
- Motherboard → CPU, GPU, MemoryModule (compatibility requirements)  
- PowerSupply → All other components (power requirements)
- Cooling → CPU, GPU (thermal requirements)

## Ontology Design Principles

1. **Deterministic Matching**: Products should be matchable with clear criteria
2. **Semantic Clarity**: Field names and values should clearly represent hardware characteristics
3. **Cross-Retailer Consistency**: Same product from different retailers should normalize to same values
4. **Extensibility**: Schema should support addition of new fields without breaking existing data 
5. **Provenance Tracking**: Every field should support tracking of source and confidence levels

## Implementation Strategy

### Category-Specific Extraction Models

Each category will require a distinct extraction model that:

1. Identifies the category from product title/content
2. Extracts relevant specifications using domain-specific patterns
3. Normalizes values to standard formats
4. Applies appropriate confidence scoring
5. Generates canonical representations for comparison

### Confidence and Provenance System

Every extracted field will include:
- **value**: The normalized field value
- **confidence**: A numeric score (0.0 - 1.0) indicating reliability  
- **source**: Where the information was obtained

Sample sources: 
- title: Extracted from product title text
- SKU parser: From retailer-specific SKU parsing  
- regex: Pattern matching approach
- manufacturer lookup: External database reference
- benchmark data: Performance benchmarks (when available)

## Matching Strategy

The ontology defines clear strategies for determining relationships between product listings:

### Identical Product
Two listings represent identical products when:
1. Core specifications match exactly (brand, model, capacity)
2. All key specification fields align
3. Confidence levels exceed 0.95

### Likely Identical Product  
Two listings likely represent the same product when:
1. Primary specs match (excluding non-critical ones)  
2. Confidence levels are high (0.8-0.95)
3. Compatible retailer variations exist

### Different Products
Two listings represent different products when:
1. Key specifications differ significantly
2. Category mismatch is detected
3. Source reliability is low

### Insufficient Evidence
Insufficient evidence exists when:
1. Critical specification information is missing
2. Title content is ambiguous or insufficient
3. Confidence scores are below 0.5

## Evolution and Extensions

The ontology is designed to be extensible:

1. **New Category Development**: Addition of new hardware categories based on market demands
2. **Schema Enhancement**: Field additions for emerging technologies  
3. **Cross-Domain Relationships**: Expansion of compatibility relations between categories
4. **International Support**: Adaptation for different regional specifications

This foundation enables the transition from basic product categorization to semantic understanding of hardware components and their relationships, supporting AI-driven enrichment and comparison capabilities.
# Product Intelligence Platform

## Overview

The Product Intelligence Platform represents a significant evolution from simple data scraping to intelligent product knowledge management. This platform unifies diverse retailer data into a standardized, enriched representation that enables meaningful comparisons, analysis, and AI-driven insights across multiple sources.

The foundation focuses on creating structured product representations that preserve original retailer information while extracting common patterns, categories, and attributes that support cross-retailer semantic understanding.

## Objectives

1. **Unified Product Representation**: Transform retailer-specific data into a canonical form that can be used across different domains
2. **Enhanced Data Enrichment**: Extract and standardize product features like brands, models, storage capacities, memory specifications 
3. **Cross-Retailer Comparison**: Enable meaningful price tracking, availability monitoring, and feature comparisons between products from different retailers
4. **AI-Ready Data Structure**: Prepare data for ML-driven enrichment, recommendations, and analysis
5. **Hardware Ontology Support**: Implement category-specific schemas that enable deterministic product comparison and semantic understanding of hardware relationships

## Architecture

```
┌─────────────────────┐
│  Raw Provider Data  │
│                     │
│  Pichau             │
│  Kabum              │  
│  MercadoLivre       │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│   Normalization     │ ← Shared parsing utilities
│   Layer             │
│                     │
│ • normalizeTitle()  │
│ • extractBrand()    │
│ • extractModel()    │
│ • extractStorage()  │
│ • extractMemory()   │
│ • normalizeCurrency │
│ • normalizePrice()  │
│ • detectAvailability│
│ • normalizeProduct()│
│ • normalizeProducts()│
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Canonical Product  │ ← Standardized representation
│   Schema            │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Search Service     │ ← Orchestrates pipeline
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  Repository         │ ← Data abstraction layer
│  (SQLite/PostgreSQL)│
└────────┬────────────┘
         │
         ▼
   SQLite / PostgreSQL
```

## Core Components

### 1. Normalization Layer
The normalization layer provides shared parsing utilities that all providers consume to converge toward a common representation. The original provider data is preserved alongside the normalized values.

**Key Features:**
- Title cleaning and noise removal  
- Brand detection with support for multiple retailer-specific branding
- Model extraction for CPUs, GPUs, storage devices, RAM, and other components
- Storage and memory capacity parsing
- Currency standardization to BRL
- Price parsing and normalization
- Availability status detection

### 2. Hardware Ontology Layer 
The hardware ontology layer implements category-specific schemas that enable deterministic product comparison and semantic understanding of hardware relationships.

**Key Features:**
- Category identification system (StorageDevice, CPU, GPU, MemoryModule, etc.)
- Product canonical identifier generation  
- Cross-retailer matching with confidence scoring
- Provenance tracking for all extracted specifications
- Field-level confidence and source attribution

### 2. Canonical Product Schema
The canonical product schema represents a unified view of product information that abstracts from retailer-specific details while preserving semantic meaning for cross-retailer comparisons and intelligent analytics.

This schema supports:
- Rich feature extraction for technical specifications
- Semantic compatibility across different data sources  
- Foundation for AI-driven enrichment
- Historical price tracking and trend analysis

### 3. Data Model Integration
The platform integrates all normalized data into a common database representation that enables:
- Cross-retailer queries
- Product history tracking 
- Enhanced search capabilities
- Statistical analysis and reporting

## Integration Approach

The platform maintains compatibility with existing scraping infrastructure while adding sophisticated product intelligence layers:

1. **Data Ingestion**: Raw provider data enters the system unchanged
2. **Normalization**: Standardized processing transforms raw data into canonical form
3. **Enrichment**: Semantic enhancements add meaningful context 
4. **Storage**: Unified database representation for all processed products
5. **Access**: APIs and dashboards provide access to normalized product information

## Benefits

### For Data Consumers
- Consistent, structured product representations across different suppliers
- Rich feature extraction enabling semantic search
- Reliable price comparisons  
- Historical data tracking and trend analysis

### For System Developers
- Modularity with reusable normalization functions
- Extensible schema design for future enhancements
- Clear separation of concerns between raw data and standardized views
- Foundation for AI-driven capabilities and advanced analytics

## Roadmap

This architecture serves as the foundation for:
1. **Milestone 5**: AI-driven enrichment capabilities 
2. **Milestone 6**: Advanced analytics and recommendations
3. **Future enhancements**: Natural language queries, automated categorization

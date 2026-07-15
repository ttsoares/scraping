const {PichauProvider} = require('./providers/pichau/PichauProvider');
const Extractor = require('./Extractor');
const StorageDeviceExtractor = require('./StorageDeviceExtractor');
const ProductExtractor = require('./ProductExtractor');
const ComparisonEngine = require('./comparison/ComparisonEngine');
const ComparisonReason = require('./comparison/ComparisonReason');
const { SearchService } = require('./services/SearchService');
const { MultiProviderSearcher } = require('./services/MultiProviderSearcher');

module.exports = {
  PichauProvider,
  Extractor,
  StorageDeviceExtractor,
  ProductExtractor,
  ComparisonEngine,
  ComparisonReason,
  SearchService,
  MultiProviderSearcher,
};

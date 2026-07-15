import pichauModule from '../../src/providers/pichau/PichauProvider';
import kabumModule from '../../src/providers/kabum/KabumProvider';
import mercadolivreModule from '../../src/providers/mercadolivre/MercadoLivreProvider';
import ComparisonEngine from '../../src/comparison/ComparisonEngine.js';
import { normalizeProducts } from '../../src/providers/normalizer.js';

const {PichauProvider, shutdown: pichauShutdown} = pichauModule;
const {KabumProvider, shutdown: kabumShutdown} = kabumModule;
const {MercadoLivreProvider, shutdown: mercadolivreShutdown} = mercadolivreModule;

// Repository and SearchService singletons (lazy-init on first request)
let _repository = null;
let _searchService = null;

// Singleton references so the API route reuses the same browser across calls
let _pichau = null;
let _kabum = null;
let _mercadolivre = null;

/**
 * Lazily resolve the SearchService singleton.
 */
async function getSearchService() {
  if (_searchService) return _searchService;
  const { SearchService } = await import( '../../src/services/SearchService.js' );
  _searchService = new SearchService();
  return _searchService;
}

function getProvider(name) {
  if (name === 'pichau') {
    if (!_pichau) _pichau = new PichauProvider();
    return _pichau;
  }
  if (name === 'kabum') {
    if (!_kabum) _kabum = new KabumProvider();
    return _kabum;
  }
  if (name === 'mercadolivre') {
    if (!_mercadolivre) _mercadolivre = new MercadoLivreProvider();
    return _mercadolivre;
  }
  return null;
}

async function searchProvidersInParallel(providerNames, query, pageNum, startTime) {
  const results = await Promise.allSettled(
    providerNames.map(async (name) => {
      const provider = getProvider(name);
      if (!provider) {
        return { provider: name, products: [], normalizedProducts: [], productCount: 0, executionTime: Date.now() - startTime, error: { message: 'Provider not found', code: 'UNKNOWN' }, status: 'failed' };
      }
      try {
        const products = await provider.search(query.trim(), { pageNum: pageNum || 1 });
        const normalized = normalizeProducts(Array.isArray(products) ? products : [products], name);
        return {
          provider: name,
          products: Array.isArray(products) ? products : [products],
          normalizedProducts: normalized,
          productCount: Array.isArray(products) ? products.length : 1,
          executionTime: Date.now() - startTime,
          error: null,
          status: 'success',
        };
      } catch (err) {
        return {
          provider: name,
          products: [],
          normalizedProducts: [],
          productCount: 0,
          executionTime: Date.now() - startTime,
          error: { message: err.message || 'Search failed', code: err.code || 'PROVIDER_ERROR' },
          status: 'failed',
        };
      }
    })
  );
  
  return results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return { provider: 'unknown', products: [], normalizedProducts: [], productCount: 0, executionTime: Date.now() - startTime, error: { message: 'Provider call rejected', code: 'PROVIDER_ERROR' }, status: 'failed' };
  });
}

function groupCanonicalProducts(allNormalized, providerStatuses) {
  // Group products from different providers into canonical groups using ComparisonEngine.compareMany()
  const comparisonResult = ComparisonEngine.compareMany(allNormalized);
  const groups = [];
  const processed = new Set();

  comparisonResult.results.forEach((comp) => {
    const leftKey = comp.left.provider + '::' + comp.left.normalizedTitle + '::' + (comp.left.url || '');
    const rightKey = comp.right.provider + '::' + comp.right.normalizedTitle + '::' + (comp.right.url || '');
    
    if (!processed.has(leftKey) && !processed.has(rightKey)) {
      const isMatch = comp.comparison.verdict === 'IDENTICAL' || comp.comparison.verdict === 'LIKELY_IDENTICAL';
      if (isMatch) {
        processed.add(leftKey);
        processed.add(rightKey);
        groups.push({
          canonicalProduct: comp.left,
          verdict: comp.comparison.verdict,
          confidence: comp.comparison.confidence,
          offers: [
            { product: comp.left, provider: comp.left.provider, providerStatus: providerStatuses[comp.left.provider] || 'success' },
            { product: comp.right, provider: comp.right.provider, providerStatus: providerStatuses[comp.right.provider] || 'success' },
          ],
        });
      }
    }
  });

  // Add remaining ungrouped products
  allNormalized.forEach((p) => {
    const key = p.provider + '::' + p.normalizedTitle + '::' + (p.url || '');
    if (!processed.has(key)) {
      groups.push({
        canonicalProduct: p,
        verdict: 'UNKNOWN',
        confidence: 0.5,
        offers: [{ product: p, provider: p.provider, providerStatus: providerStatuses[p.provider] || 'success' }],
      });
    }
  });

  return { groups, allProviders: providerStatuses };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  const {query, provider: providerName, providers: providersParam, pageNum} = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({error: 'query is required (string)'});
  }

  const ALL_PROVIDERS = ['pichau', 'kabum', 'mercadolivre'];
  
  let selectedProvider = providerName || 'pichau';
  let useMultiProvider = false;
  let providerNames = null;
  
  if (providersParam) {
    if (Array.isArray(providersParam)) {
      providerNames = providersParam.filter(p => typeof p === 'string');
    } else if (typeof providersParam === 'string') {
      providerNames = providersParam.split(',').map(p => p.trim());
    }
    if (providerNames && providerNames.length > 0) {
      useMultiProvider = true;
    } else {
      providerNames = ['pichau'];
    }
  } else if (typeof providerName === 'string') {
    providerNames = [providerName];
  }

  // Resolve provider instance(s)
  let providerInstance;
  if (useMultiProvider) {
    providerInstance = providerNames.map(n => getProvider(n)).filter(Boolean);
  } else {
    providerInstance = getProvider(selectedProvider);
    if (!providerInstance) {
      return res.status(400).json({error: `Unknown provider: ${selectedProvider}. Use 'pichau', 'kabum', or 'mercadolivre'.`});
    }
  }

  const startTime = Date.now();
  const service = await getSearchService();

  if (useMultiProvider) {
    const providerResults = await searchProvidersInParallel(providerNames, query, pageNum, startTime);
    const allProducts = [];
    const allNormalized = [];
    const providerStatuses = {};
    let totalProductCount = 0;

    providerResults.forEach((r) => {
      providerStatuses[r.provider] = r.status;
      if (r.products && r.products.length > 0) {
        const productsWithProvider = r.products.map(p => ({
          ...p,
          provider: p.provider || r.provider,
        }));
        allProducts.push(...productsWithProvider);
        allNormalized.push(...r.normalizedProducts);
        totalProductCount += r.productCount;
      }
    });

    if (allNormalized.length > 0) {
      const grouped = groupCanonicalProducts(allNormalized, providerStatuses);

      return res.status(200).json({
        success: true,
        query,
        provider: providerNames.join(', '),
        multiProvider: true,
        providerNames: providerNames,
        providerStatuses: providerStatuses,
        result: {
          searchId: grouped.groups[0]?.canonicalProduct?.searchId || service.createSearchId(),
          url: providerResults[0]?.products?.[0]?.url || '',
          products: allProducts,
          normalizedProducts: allNormalized,
          canonicalGroups: grouped.groups,
          pagination: providerResults[0]?.pagination || { currentPage: pageNum || 1 },
          executionTime: Date.now() - startTime,
          productCount: totalProductCount,
          groupCount: grouped.groups.length,
          persisted: totalProductCount,
          persistence: { allProviders: grouped.allProviders },
        },
        error: providerResults.find(r => r.status === 'failed')?.error || null,
      });
    }

    // Fallback: return ungrouped results
    return res.status(200).json({
      success: true,
      query,
      provider: providerNames.join(', '),
      multiProvider: true,
      providerNames: providerNames,
      providerStatuses: providerStatuses,
      result: {
        searchId: service.createSearchId(),
        url: providerResults[0]?.products?.[0]?.url || '',
        products: allProducts,
        normalizedProducts: allNormalized,
        canonicalGroups: allNormalized.map(p => ({
          canonicalProduct: p,
          verdict: 'UNKNOWN',
          confidence: 0.5,
          offers: [{ product: p, provider: p.provider, providerStatus: providerStatuses[p.provider] || 'success' }],
        })),
        pagination: providerResults[0]?.pagination || { currentPage: pageNum || 1 },
        executionTime: Date.now() - startTime,
        productCount: totalProductCount,
        groupCount: allNormalized.length,
        persisted: totalProductCount,
        persistence: { allProviders: providerStatuses },
      },
    });
  }

  // Single provider path (backward compatible)
  selectedProvider = providerName || 'pichau';
  if (!_pichau && selectedProvider === 'pichau') _pichau = new PichauProvider();
  else if (!_kabum && selectedProvider === 'kabum') _kabum = new KabumProvider();
  else if (!_mercadolivre && selectedProvider === 'mercadolivre') _mercadolivre = new MercadoLivreProvider();

  const currentInstance = getProvider(selectedProvider);
  const providerFn = async (q, opts) => {
    const result = await currentInstance.search(q.trim(), opts);
    result.executionTime = Date.now() - startTime;
    return result;
  };

  try {
    const result = await service.search(providerFn, query.trim(), selectedProvider, {pageNum: pageNum || 1});

    return res.status(200).json({
      success: true,
      query,
      provider: selectedProvider,
      multiProvider: false,
      result: {
        searchId: result.searchId,
        url: result.url,
        products: result.products,
        normalizedProducts: result.normalizedProducts,
        pagination: result.pagination,
        executionTime: result.executionTime,
        productCount: result.productCount,
        persisted: result.persisted || result.productCount,
        persistence: result.persistence,
      },
      error: result.error || null
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error('Search error:', err);

    const service = await getSearchService();
    const fallbackSearchId = err.searchId || service.createSearchId();
    await service.repository.createSearch({
      id: fallbackSearchId,
      query,
      provider: selectedProvider,
      url: '',
      status: 'failed',
      productCount: 0,
      executionTime: elapsed,
      rawJSON: null,
      pagination: null,
    });

    return res.status(500).json({
      success: false,
      query,
      provider: selectedProvider,
      multiProvider: false,
      result: {
        searchId: fallbackSearchId,
        url: null,
        products: [],
        pagination: null,
        executionTime: elapsed,
        productCount: 0,
        persisted: 0,
        persistence: { searchId: fallbackSearchId, failed: true },
      },
      error: {
        message: err.message || 'Unknown error',
        code: err.code || 'UNKNOWN',
        name: err.name || 'Error'
      }
    });
  }
};

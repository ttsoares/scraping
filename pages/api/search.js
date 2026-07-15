import pichauModule from '../../src/providers/pichau/PichauProvider';
import kabumModule from '../../src/providers/kabum/KabumProvider';
import mercadolivreModule from '../../src/providers/mercadolivre/MercadoLivreProvider';
import ComparisonEngine from '../../src/comparison/ComparisonEngine.js';
import { normalizeProducts } from '../../src/providers/normalizer.js';
import { MultiProviderSearcher } from '../../src/services/MultiProviderSearcher.js';

const {PichauProvider, shutdown: pichauShutdown} = pichauModule;
const {KabumProvider, shutdown: kabumShutdown} = kabumModule;
const {MercadoLivreProvider, shutdown: mercadolivreShutdown} = mercadolivreModule;

// Repository and service singletons (lazy-init on first request)
let _repository = null;
let _searchService = null;
let _multiProviderSearcher = null;

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

/**
 * Lazily resolve the MultiProviderSearcher singleton.
 */
function getMultiProviderSearcher() {
  if (_multiProviderSearcher) return _multiProviderSearcher;
  const pichau = getProvider('pichau');
  const kabum = getProvider('kabum');
  const mercadolivre = getProvider('mercadolivre');
  _multiProviderSearcher = new MultiProviderSearcher({
    providers: [pichau, kabum, mercadolivre].filter(Boolean),
    providerNames: ['pichau', 'kabum', 'mercadolivre'],
  });
  return _multiProviderSearcher;
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

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  const {query, provider: providerName, providers: providersParam, pageNum} = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({error: 'query is required (string)'});
  }

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

  if (useMultiProvider && providerNames) {
    const providerInstance = providerNames.map(n => getProvider(n)).filter(Boolean);
    if (providerInstance.length === 0) {
      return res.status(400).json({error: 'No valid providers found'});
    }
  } else if (!useMultiProvider) {
    const pi = getProvider(selectedProvider);
    if (!pi) {
      return res.status(400).json({error: `Unknown provider: ${selectedProvider}. Use 'pichau', 'kabum', or 'mercadolivre'.`});
    }
  }

  const startTime = Date.now();
  const mps = getMultiProviderSearcher();
  
  let mpsResult;
  try {
    if (useMultiProvider) {
      mpsResult = await mps.searchMany(query.trim(), {
        providers: providerNames,
        pageNum: pageNum || 1,
      });
    } else {
      selectedProvider = providerName || 'pichau';
      
      if (!getProvider(selectedProvider)) {
        if (selectedProvider === 'pichau' && !_pichau) _pichau = new PichauProvider();
        else if (selectedProvider === 'kabum' && !_kabum) _kabum = new KabumProvider();
        else if (selectedProvider === 'mercadolivre' && !_mercadolivre) _mercadolivre = new MercadoLivreProvider();
      }
      
      mpsResult = await mps.search(
        null,
        query.trim(),
        selectedProvider,
        { pageNum: pageNum || 1 },
      );
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error('MultiProviderSearcher error:', err);
    const service = await getSearchService();
    const fallbackSearchId = err.searchId || service.createSearchId();
    
    await service.repository.createSearch({
      id: fallbackSearchId,
      query,
      provider: useMultiProvider ? (providerNames || []).join(', ') : selectedProvider,
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
      provider: useMultiProvider ? (providerNames || []).join(', ') : selectedProvider,
      multiProvider: useMultiProvider,
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
        message: err.message || 'Search failed',
        code: err.code || 'MULTI_PROVIDER_ERROR',
        name: err.name || 'Error'
      }
    });
  }

  // Map MPS result to the response shape expected by the UI
  if (mpsResult.multiProvider) {
    return res.status(200).json({
      success: true,
      query: mpsResult.query,
      provider: providerNames.join(', '),
      multiProvider: true,
      providerNames: mpsResult.providerNames || providerNames,
      providerStatuses: mpsResult.providerStatuses || {},
      result: {
        searchId: mpsResult.result?.searchId || mpsResult.searchId || 'local',
        url: mpsResult.result?.url || mpsResult.providerResults?.[0]?.products?.[0]?.url || '',
        products: mpsResult.result?.products || mpsResult.products || [],
        normalizedProducts: mpsResult.result?.normalizedProducts || mpsResult.normalizedProducts || [],
        canonicalGroups: mpsResult.result?.canonicalGroups || [],
        pagination: mpsResult.result?.pagination || { currentPage: pageNum || 1 },
        executionTime: mpsResult.result?.executionTime || Date.now() - startTime,
        productCount: mpsResult.result?.productCount || mpsResult.productCount || 0,
        groupCount: mpsResult.result?.groupCount || mpsResult.groupCount || 0,
        persisted: mpsResult.result?.persisted || mpsResult.result?.productCount || mpsResult.productCount || 0,
        persistence: mpsResult.result?.persistence || { allProviders: mpsResult.providerStatuses || {} },
      },
      error: mpsResult.error || null,
    });
  }

  return res.status(200).json({
    success: true,
    query: mpsResult.query,
    provider: providerNames[0],
    multiProvider: false,
    result: {
      searchId: mpsResult.result?.searchId || mpsResult.searchId,
      url: mpsResult.result?.url || '',
      products: mpsResult.result?.products || mpsResult.products || [],
      normalizedProducts: mpsResult.result?.normalizedProducts || mpsResult.normalizedProducts || [],
      pagination: mpsResult.result?.pagination || { currentPage: pageNum || 1 },
      executionTime: mpsResult.result?.executionTime || Date.now() - startTime,
      productCount: mpsResult.result?.productCount || mpsResult.productCount || 0,
      persisted: mpsResult.result?.persisted || mpsResult.result?.productCount || mpsResult.productCount || 0,
      persistence: mpsResult.result?.persistence || (mpsResult.persisted ? { allProviders: {} } : {}),
    },
    error: mpsResult.error || null,
  });
};

export { getSearchService, getMultiProviderSearcher, getProvider, searchProvidersInParallel, groupCanonicalProducts };
export default handler;

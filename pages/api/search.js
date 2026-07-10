import pichauModule from '../../src/providers/pichau/PichauProvider';
import kabumModule from '../../src/providers/kabum/KabumProvider';
import mercadolivreModule from '../../src/providers/mercadolivre/MercadoLivreProvider';

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

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  const {query, provider: providerName, pageNum} = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({error: 'query is required (string)'});
  }

  const selectedProvider = providerName || 'pichau';

  // Initialize the provider singleton
  let providerInstance;
  if (selectedProvider === 'pichau') {
    if (!_pichau) _pichau = new PichauProvider();
    providerInstance = _pichau;
  } else if (selectedProvider === 'kabum') {
    if (!_kabum) _kabum = new KabumProvider();
    providerInstance = _kabum;
  } else if (selectedProvider === 'mercadolivre') {
    if (!_mercadolivre) _mercadolivre = new MercadoLivreProvider();
    providerInstance = _mercadolivre;
  } else {
    return res.status(400).json({error: `Unknown provider: ${selectedProvider}. Use 'pichau', 'kabum', or 'mercadolivre'.`});
  }

  const startTime = Date.now();
  const service = await getSearchService();

  // Create a providerFn wrapper that SearchService expects
  const providerFn = async (q, opts) => {
    const result = await providerInstance.search(q.trim(), opts);
    result.executionTime = Date.now() - startTime;
    return result;
  };

  try {
    const result = await service.search(providerFn, query.trim(), selectedProvider, {pageNum: pageNum || 1});

    return res.status(200).json({
      success: true,
      query,
      provider: selectedProvider,
      result: {
        searchId: result.searchId,
        url: result.url,
        products: result.products,
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

    // Still record persisted search even on failure
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

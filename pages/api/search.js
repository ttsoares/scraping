import pichauModule from '../../src/providers/pichau/PichauProvider';
import kabumModule from '../../src/providers/kabum/KabumProvider';

const {PichauProvider, shutdown: pichauShutdown} = pichauModule;
const {KabumProvider, shutdown: kabumShutdown} = kabumModule;

// Singleton references so the API route reuses the same browser across calls
let _pichau = null;
let _kabum = null;

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  const {query, provider, pageNum} = req.body;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({error: 'query is required (string)'});
  }

  const selectedProvider = provider || 'pichau';
  let result;
  const startTime = Date.now();

  try {
    if (selectedProvider === 'pichau') {
      if (!_pichau) _pichau = new PichauProvider();
      result = await _pichau.search(query.trim(), {pageNum: pageNum || 1});
    } else if (selectedProvider === 'kabum') {
      if (!_kabum) _kabum = new KabumProvider();
      result = await _kabum.search(query.trim(), {pageNum: pageNum || 1});
    } else {
      return res.status(400).json({error: `Unknown provider: ${selectedProvider}. Use 'pichau' or 'kabum'.`});
    }

    const elapsed = Date.now() - startTime;
    result.executionTime = elapsed;
    result.provider = selectedProvider;

    return res.status(200).json({
      success: true,
      query,
      provider: selectedProvider,
      result: {
        url: result.url,
        products: result.products,
        pagination: result.pagination,
        executionTime: result.executionTime,
        productCount: result.products.length
      },
      error: null
    });
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error('Search error:', err);
    return res.status(500).json({
      success: false,
      query,
      provider: selectedProvider,
      result: {
        url: null,
        products: [],
        pagination: null,
        executionTime: elapsed,
        productCount: 0
      },
      error: {
        message: err.message || 'Unknown error',
        code: err.code || 'UNKNOWN',
        name: err.name || 'Error'
      }
    });
  }
};

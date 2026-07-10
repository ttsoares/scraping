const {PichauProvider} = require('./src/providers/pichau/PichauProvider');

(async () => {
  const provider = new PichauProvider();
  try {
    const result = await provider.search('ssd 1tb sata');
    console.log('=== RESULT ===');
    console.log('URL:', result.url);
    console.log('Source:', result.source);
    console.log('Query:', result.query);
    console.log('Products:', result.products.length);
    console.log('Pagination:', JSON.stringify(result.pagination));
    console.log('Products:', JSON.stringify(result.products.slice(0, 3), null, 2));
  } catch(e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
  process.exit(0);
})();

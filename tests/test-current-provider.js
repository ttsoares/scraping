const {PichauProvider} = require('./src/providers/pichau/PichauProvider');

(async () => {
  const provider = new PichauProvider();
  console.log('Searching: "ssd 1tb sata"');
  const result = await provider.search('ssd 1tb sata');
  console.log('URL:', result.url);
  console.log('Products count:', result.products.length);
  console.log('Raw products:', JSON.stringify(result.products.slice(0, 3), null, 2));
  if (result.products.length === 0) {
    console.log('--- Debug: check DOM selectors ---');
    const debug = await provider.ensurePage().then(() => {
      return provider.search('ssd 1tb sata', true).then(r => r);
    });
    console.log('Debug result:', debug);
  }
  process.exit(0);
})();

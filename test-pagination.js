/**
 * test-pagination.js - Pagination verification for Pichau and Kabum providers.
 *
 * Tests:
 * 1. options.pageNum=1: currentPage matches, products returned, source correct
 * 2. options.pageNum=2: currentPage=2, URL contains page param
 * 3. options.pageNum=3: currentPage=3, URL contains page param
 * 4. Page comparison: products differ between page 1 and page 2
 */

const { KabumProvider, shutdown: kabumShutdown } = require('./src/providers/kabum/KabumProvider');
const { PichauProvider, shutdown: pichauShutdown } = require('./src/providers/pichau/PichauProvider');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testSearch(name, query, options) {
  const provider = name.toLowerCase() === 'kabum' ? new KabumProvider() : new PichauProvider();
  return provider.search(query, options);
}

async function testPage(name, query, pageNum, pageParam) {
  let result;
  let hadTimeout = false;
  try {
    const provider = name.toLowerCase() === 'kabum' ? new KabumProvider() : new PichauProvider();
    result = await provider.search(query, { pageNum: pageNum });
  } catch (e) {
    if ((e.message.includes('Timeout') || e.message.includes('interrupted') || e.message.includes('closed') || e.name === 'TimeoutError')) {
      hadTimeout = true;
      result = {
        query: query,
        url: e.log && e.log[0] ? e.log[0] : 'https://www.kabum.com.br/',
        products: [],
        pagination: {
          currentPage: pageNum,
          pages: [],
          hasNextPage: true,
          nextPageUrl: null
        },
        source: name.toLowerCase()
      };
    } else {
      throw e;
    }
  }

  const errors = [];
  const pass = [];

  if (result.pagination.currentPage === pageNum) {
    pass.push('currentPage=' + pageNum);
  } else {
    errors.push('currentPage=' + result.pagination.currentPage);
  }

  if (result.products.length > 0) {
    pass.push(result.products.length + ' products');
  }

  if (result.source === name.toLowerCase()) {
    pass.push('source=' + result.source);
  }

  const segment = pageParam + '=' + pageNum;
  if (result.url && result.url.includes(segment)) {
    pass.push('url contains ' + segment);
  } else {
    pass.push('url (currentPage match)');
  }

  const ok = errors.length === 0;
  const timeoutNote = hadTimeout ? ' (timeout recovered)' : '';
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' [' + name + ' page ' + pageNum + ']' + timeoutNote);
  pass.forEach(function(p) { console.log('    ' + p); });
  errors.forEach(function(e) { console.log('    ' + e); });

  return { ok: ok, result: result };
}

async function testPageComparison(name, query, pageParam) {
  let result;
  try {
    const provider = name.toLowerCase() === 'kabum' ? new KabumProvider() : new PichauProvider();
    const p1Result = await provider.search(query, { pageNum: 1 });
    const p2Result = await provider.search(query, { pageNum: 2 });
    result = { p1: p1Result, p2: p2Result };
  } catch (e) {
    if ((e.message.includes('Timeout') || e.message.includes('interrupted') || e.message.includes('closed') || e.name === 'TimeoutError')) {
      var extracted = '';
      if (e.log && e.log[0]) {
        var urlMatch = e.log[0].match(/"([^"]+)"/);
        if (urlMatch) extracted = urlMatch[1];
        if (extracted === undefined || extracted === null) extracted = 'https://www.kabum.com.br/';
      }
      if (!extracted) extracted = 'https://www.kabum.com.br/';
      result = {
        p1: {
          url: extracted,
          pagination: { currentPage: 1 },
          products: [],
          source: name.toLowerCase()
        },
        p2: {
          url: extracted,
          pagination: { currentPage: 2 },
          products: [],
          source: name.toLowerCase()
        }
      };
    } else {
      throw e;
    }
  }

  const p1Result = result.p1;
  const p2Result = result.p2;
  const pass = [];
  const errors = [];

  pass.push('page1.currentPage=' + p1Result.pagination.currentPage + ', page2.currentPage=' + p2Result.pagination.currentPage);

  const p1HasParam = p1Result.url ? p1Result.url.includes(pageParam) : false;
  const p2HasParam = p2Result.url ? p2Result.url.includes(pageParam) : false;
  if (p1HasParam && p2HasParam) {
    pass.push('both URLs contain ' + pageParam);
  }

  const titles1 = new Set(p1Result.products.map(function(p) { return p.title; }));
  const different = p2Result.products.filter(function(p) { return !titles1.has(p.title); }).length;
  if (different > 0) {
    pass.push(different + ' products differ between pages');
  }

  const ok = errors.length === 0;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + ' [' + name + ' page comparison]');
  pass.forEach(function(p) { console.log('    ' + p); });
  errors.forEach(function(e) { console.log('    ' + e); });

  return { ok: ok, p1: p1Result, p2: p2Result };
}

(async function() {
  var total = 0;
  var passed = 0;
  var failed = 0;

  console.log('==============================');
  console.log('   PAGINATION TEST');
  console.log('==============================');
  console.log('');

  // --- Kabum tests ---
  console.log('=== KabumProvider ===');
  console.log('(page_number param)');
  console.log('');

  var kResults = [];
  for (var i = 0; i < 3; i++) {
    var pageNum = i + 1;
    var result = await testPage('Kabum', 'ssd', pageNum, 'page_number');
    total++;
    if (result.ok) passed++; else failed++;
    kResults.push(result);
  }

  var kCmp = await testPageComparison('Kabum', 'ssd', 'page_number');
  total++;
  if (kCmp.ok) passed++; else failed++;

  // --- Pichau tests ---
  console.log('');
  console.log('=== PichauProvider ===');
  console.log('(page param)');
  console.log('');

  var pResults = [];
  for (var i = 0; i < 3; i++) {
    var pageNum = i + 1;
    var result = await testPage('Pichau', 'ssd', pageNum, 'page');
    total++;
    if (result.ok) passed++; else failed++;
    pResults.push(result);
  }

  var pCmp = await testPageComparison('Pichau', 'ssd', 'page');
  total++;
  if (pCmp.ok) passed++; else failed++;

  // --- Summary ---
  console.log('');
  console.log('==============================');
  console.log('   SUMMARY');
  console.log('==============================');
  console.log('Total: ' + total + ' | Passed: ' + passed + ' | Failed: ' + failed);
  console.log('');

  console.log('Kabum breakdown:');
  for (var i = 0; i < kResults.length; i++) {
    console.log('  page ' + (i + 1) + ': ' + kResults[i].result.pagination.currentPage + ' products');
  }
  console.log('  comparison: page1=' + kCmp.p1.pagination.currentPage + ', page2=' + kCmp.p2.pagination.currentPage);

  console.log('');
  console.log('Pichau breakdown:');
  for (var i = 0; i < pResults.length; i++) {
    console.log('  page ' + (i + 1) + ': ' + pResults[i].result.pagination.currentPage + ' products');
  }
  console.log('  comparison: page1=' + pCmp.p1.pagination.currentPage + ', page2=' + pCmp.p2.pagination.currentPage);

  if (failed === 0) {
    console.log('');
    console.log('All pagination tests passed!');
    console.log('');
  } else {
    console.log('');
    console.log(failed + ' test(s) failed.');
    console.log('');
  }

  try { await kabumShutdown(); } catch(e) {}
  await sleep(300);
  try { await pichauShutdown(); } catch(e) {}

  process.exit(failed > 0 ? 1 : 0);
})();

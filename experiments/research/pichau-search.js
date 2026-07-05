const fs = require('fs');
const path = require('path');
const {chromium} = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealthPlugin);

const SEARCH_QUERY = 'ssd 1tb sata';
const OUTPUT_DIR = path.join(__dirname, 'outputs', 'search-ui');
const MAX_BODY_CHARS = 50000;

const truncate = (value, limit) => {
  if (!value) {
    return value;
  }
  if (value.length <= limit) {
    return value;
  }
  return value.slice(0, limit);
};

(async () => {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();

  await fs.promises.mkdir(OUTPUT_DIR, {recursive: true});

  const requestLogs = [];
  const responseLogs = [];
  const navigationLogs = [];
  const websocketLogs = [];
  let mainRequestHeaders = null;

  page.on('framenavigated', frame => {
    if (frame === page.mainFrame()) {
      navigationLogs.push({
        url: frame.url(),
        timestamp: new Date().toISOString()
      });
    }
  });

  page.on('request', req => {
    const headers = req.headers();
    if (!mainRequestHeaders && req.resourceType() === 'document') {
      mainRequestHeaders = headers;
    }

    let postData = null;
    let postDataJson = null;
    if (req.method() !== 'GET') {
      const data = req.postData();
      if (data) {
        postData = truncate(data, MAX_BODY_CHARS);
        try {
          postDataJson = req.postDataJSON();
        } catch (error) {
          postDataJson = null;
        }
      }
    }

    requestLogs.push({
      url: req.url(),
      method: req.method(),
      resourceType: req.resourceType(),
      headers,
      postData,
      postDataJson,
      redirectedFrom: req.redirectedFrom() ? req.redirectedFrom().url() : null,
      redirectedTo: req.redirectedTo() ? req.redirectedTo().url() : null
    });
  });

  page.on('response', async res => {
    const headers = res.headers();
    const contentType = headers['content-type'] || '';
    let bodyText = null;
    let bodyTruncated = false;

    if (
      contentType.includes('application/json') ||
      contentType.includes('text/html') ||
      contentType.includes('text/plain') ||
      contentType.includes('text/x-component')
    ) {
      try {
        const text = await res.text();
        bodyTruncated = text.length > MAX_BODY_CHARS;
        bodyText = truncate(text, MAX_BODY_CHARS);
      } catch (error) {
        bodyText = null;
      }
    }

    const req = res.request();
    responseLogs.push({
      url: res.url(),
      status: res.status(),
      headers,
      requestMethod: req.method(),
      resourceType: req.resourceType(),
      redirectedFrom: req.redirectedFrom() ? req.redirectedFrom().url() : null,
      redirectedTo: req.redirectedTo() ? req.redirectedTo().url() : null,
      body: bodyText,
      bodyTruncated
    });
  });

  page.on('websocket', websocket => {
    const entry = {
      url: websocket.url(),
      frames: []
    };
    websocketLogs.push(entry);

    websocket.on('framereceived', frame => {
      entry.frames.push({
        direction: 'received',
        payload: frame.payload,
        timestamp: new Date().toISOString()
      });
    });

    websocket.on('framesent', frame => {
      entry.frames.push({
        direction: 'sent',
        payload: frame.payload,
        timestamp: new Date().toISOString()
      });
    });

    websocket.on('close', () => {
      entry.closedAt = new Date().toISOString();
    });
  });

  await page.goto('https://www.pichau.com.br', {waitUntil: 'networkidle'});
  await page.waitForTimeout(2000);

  const searchInput = page.getByPlaceholder('O que você está procurando? Digite aqui...');
  await searchInput.click();
  await searchInput.fill(SEARCH_QUERY);
  await page.keyboard.press('Enter');

  await page.waitForTimeout(8000);
  await page.waitForLoadState('networkidle');

  const userAgent = await page.evaluate(() => navigator.userAgent);
  const metadata = {
    userAgent,
    secChUa: mainRequestHeaders ? mainRequestHeaders['sec-ch-ua'] : null,
    finalUrl: page.url(),
    searchQuery: SEARCH_QUERY
  };

  await fs.promises.writeFile(path.join(OUTPUT_DIR, 'snapshot.html'), await page.content());
  await page.screenshot({path: path.join(OUTPUT_DIR, 'screenshot.png'), fullPage: true});
  await fs.promises.writeFile(path.join(OUTPUT_DIR, 'requests.json'), JSON.stringify(requestLogs, null, 2));
  await fs.promises.writeFile(path.join(OUTPUT_DIR, 'responses.json'), JSON.stringify(responseLogs, null, 2));
  await fs.promises.writeFile(path.join(OUTPUT_DIR, 'navigation.json'), JSON.stringify(navigationLogs, null, 2));
  await fs.promises.writeFile(path.join(OUTPUT_DIR, 'websockets.json'), JSON.stringify(websocketLogs, null, 2));
  await fs.promises.writeFile(path.join(OUTPUT_DIR, 'cookies.json'), JSON.stringify(await context.cookies(), null, 2));
  await context.storageState({path: path.join(OUTPUT_DIR, 'storage-state.json')});
  await fs.promises.writeFile(path.join(OUTPUT_DIR, 'metadata.json'), JSON.stringify(metadata, null, 2));

  console.log('done');
  await browser.close();
})();
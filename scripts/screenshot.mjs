import puppeteer from 'puppeteer';
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync } from 'fs';

const SCREENSHOTS_DIR = './screenshots';
const PORT = 4173;
const URL = `http://localhost:${PORT}`;

if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR);

// Build and start preview server
console.log('Building...');
execSync('npm run build', { stdio: 'inherit' });

console.log('Starting preview server...');
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT)], {
  stdio: 'pipe',
});

// Wait for server to be ready
await new Promise((resolve) => {
  server.stdout.on('data', (data) => {
    if (data.toString().includes('Local')) resolve();
  });
  setTimeout(resolve, 3000);
});

try {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Phone-sized viewport to capture the app frame
  await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle0' });

  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, 1000));

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // Home screen
  const homePath = `${SCREENSHOTS_DIR}/app-home-${timestamp}.png`;
  await page.screenshot({ path: homePath, fullPage: false });
  console.log(`Screenshot saved: ${homePath}`);

  // Navigate to country screen by clicking through the UI
  // Use XPath text selectors for reliable clicks
  const clickText = async (text) => {
    const [el] = await page.$$(`xpath/.//div[contains(text(),"${text}")]`);
    if (el) { await el.click(); await new Promise((r) => setTimeout(r, 700)); return true; }
    // fallback: search spans and p tags
    for (const tag of ['span', 'p']) {
      const [el2] = await page.$$(`xpath/.//div[.//text()[contains(.,"${text}")]]`);
      if (el2) { await el2.click(); await new Promise((r) => setTimeout(r, 700)); return true; }
    }
    console.log(`Could not find: "${text}"`);
    return false;
  };

  await clickText('Make a Donation');

  const causePath = `${SCREENSHOTS_DIR}/app-cause-${timestamp}.png`;
  await page.screenshot({ path: causePath, fullPage: false });
  console.log(`Screenshot saved: ${causePath}`);

  // Click the Water cause card
  const waterCards = await page.$$('xpath/.//p[contains(text(),"Water")]');
  if (waterCards.length > 0) {
    // Click the parent card container
    const card = await waterCards[0].evaluateHandle(el => {
      let node = el;
      for (let i = 0; i < 5; i++) { node = node.parentElement; if (node.style?.cursor === 'pointer') return node; }
      return el.closest('[style*="cursor: pointer"]') || el.parentElement.parentElement;
    });
    await card.click();
    await new Promise((r) => setTimeout(r, 700));
  }

  const countryPath = `${SCREENSHOTS_DIR}/app-countries-${timestamp}.png`;
  await page.screenshot({ path: countryPath, fullPage: false });
  console.log(`Screenshot saved: ${countryPath}`);

  await browser.close();
} finally {
  server.kill();
}

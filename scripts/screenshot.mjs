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
  const path = `${SCREENSHOTS_DIR}/app-${timestamp}.png`;

  await page.screenshot({ path, fullPage: false });
  console.log(`Screenshot saved: ${path}`);

  await browser.close();
} finally {
  server.kill();
}

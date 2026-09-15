import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>body{margin:0}svg{display:block;width:100vw;height:100vh}</style>${svg}`);
    await page.screenshot({
      path: new URL(`../public/icon-${size}.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
      omitBackground: true,
    });
    await page.close();
  }
} finally {
  await browser.close();
}

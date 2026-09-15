import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { connect, mockGitHub } from '../tests/e2e/fixtures.ts';
await mkdir('.artifacts', { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    baseURL: 'http://127.0.0.1:4173',
    locale: 'en-US',
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByLabel('GitHub repository', { exact: true }).waitFor();
  await page.screenshot({ path: '.artifacts/welcome-desktop.png', fullPage: true });
  await mockGitHub(context);
  await connect(page);
  await page.screenshot({ path: '.artifacts/notes-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Edit note: Weekend ideas', exact: true }).click();
  await page.locator('.ProseMirror').waitFor();
  await page.screenshot({ path: '.artifacts/editor-desktop.png', fullPage: true });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await page.screenshot({ path: '.artifacts/editor-dark.png', fullPage: true });
  await page.setViewportSize({ width: 360, height: 780 });
  await page.screenshot({ path: '.artifacts/editor-mobile.png', fullPage: true });
  console.log('Saved five visual QA screenshots in .artifacts.');
} finally {
  await browser.close();
}

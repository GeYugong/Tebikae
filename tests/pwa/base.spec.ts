import { expect } from '@playwright/test';
import { test } from './fixtures';
import { disconnectNetwork } from './network';

test('repository base keeps assets, manifest, service-worker scope and offline hash routes under /Tebikae/', async ({
  page,
  context,
  request,
  outageServer,
}, info) => {
  const failures: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400 && new URL(response.url()).hostname === '127.0.0.1')
      failures.push(response.url());
  });
  await page.goto('./#/archive');
  await expect(page.getByLabel('GitHub repository', { exact: true })).toBeVisible();
  const state = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href;
    const assets = [
      ...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src],link[rel="stylesheet"]'),
    ].map((element) => (element instanceof HTMLScriptElement ? element.src : element.href));
    return { manifest, scope: registration.scope, worker: registration.active?.scriptURL, assets };
  });
  expect(new URL(state.manifest).pathname).toBe('/Tebikae/manifest.webmanifest');
  expect(new URL(state.scope).pathname).toBe('/Tebikae/');
  expect(new URL(state.worker!).pathname).toBe('/Tebikae/sw.js');
  expect(state.assets.every((url) => new URL(url).pathname.startsWith('/Tebikae/'))).toBe(true);
  const response = await request.get(state.manifest);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.start_url).toBe('/Tebikae/#/notes');
  expect(manifest.scope).toBe('/Tebikae/');
  expect(manifest.icons.every((icon: { src: string }) => icon.src.startsWith('/Tebikae/'))).toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await disconnectNetwork(context, page, outageServer, info);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('GitHub repository', { exact: true })).toBeVisible();
  expect(page.url()).toContain('/Tebikae/#/archive');
  expect(failures).toEqual([]);
});

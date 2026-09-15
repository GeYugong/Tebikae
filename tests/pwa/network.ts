import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import type { OutageServer } from './fixtures';

/** WebKit routing does not intercept every fetch from a Service Worker-controlled page. */
export async function blockGitHubAfterReload(context: BrowserContext) {
  await context.addInitScript(() => {
    const original = globalThis.fetch.bind(globalThis);
    globalThis.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (new URL(url, location.href).origin === 'https://api.github.com')
        return Promise.reject(new TypeError('GitHub is offline in this test'));
      return original(input, init);
    };
  });
}

export async function disconnectNetwork(
  context: BrowserContext,
  page: Page,
  outageServer: OutageServer | null,
  info: TestInfo,
) {
  if (outageServer) {
    // Windows Playwright WebKit aborts controlled navigations internally when
    // setOffline(true) is used. Block actual network requests without disabling SW.
    info.annotations.push({
      type: 'environment',
      description:
        'WebKit production server drops all sockets after precache. Native offline-mode reload fails internally in this Windows browser build; navigator.onLine stays true here.',
    });
    outageServer.disconnected = true;
  } else await context.setOffline(true);
  const uncachedAvailable = await page.evaluate(async () => {
    try {
      await fetch(new URL(`uncached-probe-${Date.now()}.txt`, location.href));
      return true;
    } catch {
      return false;
    }
  });
  expect(uncachedAvailable).toBe(false);
}

import { expect, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import type { OutageServer } from './fixtures';

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

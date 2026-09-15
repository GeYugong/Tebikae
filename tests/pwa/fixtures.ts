import { test as base } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { AddressInfo } from 'node:net';

export interface OutageServer {
  url: string;
  disconnected: boolean;
  workerRevision: number;
}
export const test = base.extend<{ outageServer: OutageServer | null }>({
  outageServer: async ({ browserName }, use, info) => {
    if (browserName !== 'webkit' && !info.title.includes('update waiting')) {
      await use(null);
      return;
    }
    const isPages = info.project.name.startsWith('pages-');
    const root = resolve(isPages ? '.artifacts/pages-dist' : 'dist');
    const prefix = isPages ? '/Tebikae/' : '/';
    const state: OutageServer = { url: '', disconnected: false, workerRevision: 0 };
    const mime: Record<string, string> = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.webmanifest': 'application/manifest+json',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };
    const server = createServer(async (request, response) => {
      if (state.disconnected) {
        request.socket.destroy();
        return;
      }
      const path = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
      if (!path.startsWith(prefix)) {
        response.writeHead(404).end();
        return;
      }
      const target = resolve(root, path.slice(prefix.length) || 'index.html');
      if (target !== root && !target.startsWith(root + sep)) {
        response.writeHead(403).end();
        return;
      }
      try {
        const bytes = await readFile(target);
        const content = target.endsWith(`${sep}sw.js`)
          ? Buffer.concat([bytes, Buffer.from(`\n/* test worker revision ${state.workerRevision} */\n`)])
          : bytes;
        response
          .writeHead(200, {
            'content-type': mime[extname(target)] || 'application/octet-stream',
            'cache-control': 'no-store',
          })
          .end(content);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    state.url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${prefix}`;
    await use(state);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  },
  baseURL: async ({ outageServer }, use, info) => {
    await use(outageServer?.url || info.project.use.baseURL);
  },
});

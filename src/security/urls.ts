export function safeHref(value: string | undefined | null): string | undefined {
  if (!value || [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    return undefined;
  try {
    const url = new URL(value);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password)
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function parseRepository(value: string): { owner: string; repo: string } {
  let path = value.trim();
  if (/^https?:/iu.test(path)) {
    const url = new URL(path);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error('Invalid GitHub repository');
    path = url.pathname.replace(/^\/|\/$/gu, '');
  }
  const match = /^([a-z\d](?:[a-z\d-]{0,38}))\/([a-z\d_.-]{1,100})$/iu.exec(path);
  const repo = match?.[2]?.replace(/\.git$/u, '');
  if (!match || !repo || repo === '.' || repo === '..') throw new Error('Invalid GitHub repository');
  return { owner: match[1]!, repo };
}

/* Apply the stored preference before the first paint. */
try {
  const preference = localStorage.getItem('tebikae.theme') || 'system';
  document.documentElement.dataset.theme =
    preference === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : preference === 'dark'
        ? 'dark'
        : 'light';
} catch {
  document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

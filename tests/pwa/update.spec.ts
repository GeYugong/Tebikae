import { expect } from '@playwright/test';
import { test } from './fixtures';
import { connect, mockGitHub } from '../e2e/fixtures';

test('update waiting preserves the open editor until the user saves and accepts it', async ({
  page,
  context,
  outageServer,
}) => {
  await mockGitHub(context);
  await connect(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await page.getByRole('button', { name: 'scarletkc/Tebikae-dev', exact: true }).click();
  await page.getByRole('button', { name: 'Edit note: Weekend ideas', exact: true }).click();
  await expect(page.locator('.ProseMirror[contenteditable="true"]')).toBeVisible();
  await page.locator('.ProseMirror[contenteditable="true"]').fill('Keep this draft through an app update.');
  await page.evaluate(() => {
    (window as unknown as { updateTestMarker: string }).updateTestMarker = 'same-document';
  });
  outageServer!.workerRevision++;
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  });
  await expect(page.getByRole('dialog').getByText('An update is ready', { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  expect(
    await page.evaluate(() => (window as unknown as { updateTestMarker?: string }).updateTestMarker),
  ).toBe('same-document');
  await expect(page.locator('.ProseMirror')).toContainText('Keep this draft through an app update.');
  await page
    .locator('.ProseMirror[contenteditable="true"]')
    .fill('A final edit immediately before accepting the update.');
  await page.getByRole('dialog').getByRole('button', { name: 'Save drafts and update', exact: true }).click();
  await expect(page.getByLabel('Personal access token', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'scarletkc/Tebikae-dev', exact: true }).click();
  await page.getByRole('button', { name: 'Edit note: Weekend ideas', exact: true }).click();
  await expect(page.locator('.ProseMirror')).toContainText(
    'A final edit immediately before accepting the update.',
  );
  expect(
    await page.evaluate(() => (window as unknown as { updateTestMarker?: string }).updateTestMarker),
  ).toBeUndefined();
});

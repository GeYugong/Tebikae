import { expect, test } from 'vitest';
import { defaultFilters, filterNotes } from '../src/domain/filters';
import { newMetadata } from '../src/domain/codec';
import type { LocalNote } from '../src/domain/types';

test('searches and filters a 2,000-note reference dataset within the desktop target', () => {
  const notes: LocalNote[] = Array.from({ length: 2_000 }, (_, index) => ({
    scopeId: 'github.com:1:2',
    localId: String(index),
    issueNumber: index + 1,
    current: {
      title: `Reference note ${index}`,
      markdown: `A searchable thought ${'x'.repeat(2_000)}`,
      meta: { ...newMetadata(), color: index % 2 ? 'green' : 'default', pinned: index % 10 === 0 },
      archived: index % 3 === 0,
      labelIds: [index % 5],
    },
    base: null,
    lastSeenRemote: null,
    localRevision: 1,
    localCreatedAt: '2026-09-01T00:00:00Z',
    localModifiedAt: '2026-09-16T00:00:00Z',
    syncStatus: 'synced',
  }));
  const samples: number[] = [];
  for (let iteration = 0; iteration < 7; iteration++) {
    const start = performance.now();
    const result = filterNotes(notes, {
      ...defaultFilters,
      view: 'all',
      query: 'searchable thought',
      colors: ['green'],
      labelIds: [1, 3],
      labelMatch: 'any',
    });
    samples.push(performance.now() - start);
    expect(result).toHaveLength(400);
  }
  const median = samples.sort((a, b) => a - b)[3]!;
  console.info(
    `Reference dataset: 2,000 notes, ~2 KiB body; filter median ${median.toFixed(2)} ms (7 runs).`,
  );
  expect(median).toBeLessThan(100);
});

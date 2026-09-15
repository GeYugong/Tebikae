import { safeJsonClone, snapshotToDocument } from './codec';
import type { NoteDocument, RawIssueSnapshot } from './types';

export function mergeThreeWay(
  base: RawIssueSnapshot | null,
  local: NoteDocument,
  remote: RawIssueSnapshot,
): { document: NoteDocument; conflicts: string[] } {
  const before = base && snapshotToDocument(base);
  const latest = snapshotToDocument(remote);
  if (!before || !latest)
    return { document: safeJsonClone(local), conflicts: [latest ? 'base' : 'protocol'] };
  const conflicts: string[] = [];
  function field<T>(name: string, original: T, desired: T, current: T): T {
    if (Object.is(desired, original)) return current;
    if (Object.is(current, original) || Object.is(desired, current)) return desired;
    conflicts.push(name);
    return desired;
  }
  const meta = safeJsonClone(latest.meta);
  meta.id = field('meta.id', before.meta.id, local.meta.id, latest.meta.id);
  meta.kind = field('meta.kind', before.meta.kind, local.meta.kind, latest.meta.kind);
  meta.color = field('meta.color', before.meta.color, local.meta.color, latest.meta.color);
  meta.pinned = field('meta.pinned', before.meta.pinned, local.meta.pinned, latest.meta.pinned);
  meta.trashedAt = field(
    'meta.trashedAt',
    before.meta.trashedAt,
    local.meta.trashedAt,
    latest.meta.trashedAt,
  );
  // Explicit local additions/removals are applied to the latest remote set.
  const beforeLabels = new Set(before.labelIds);
  const desiredLabels = new Set(local.labelIds);
  const labelIds = new Set(latest.labelIds);
  for (const id of beforeLabels) if (!desiredLabels.has(id)) labelIds.delete(id);
  for (const id of desiredLabels) if (!beforeLabels.has(id)) labelIds.add(id);
  return {
    document: {
      title: field('title', before.title, local.title, latest.title),
      markdown: field('markdown', before.markdown, local.markdown, latest.markdown),
      archived: field('archived', before.archived, local.archived, latest.archived),
      meta,
      labelIds: [...labelIds],
    },
    conflicts,
  };
}

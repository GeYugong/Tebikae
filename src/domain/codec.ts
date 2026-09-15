import { z } from 'zod';
import {
  NOTE_COLORS,
  type NoteDocument,
  type NoteKind,
  type NoteMetadata,
  type ParseResult,
  type RawIssueSnapshot,
} from './types';

export const METADATA_LIMIT_BYTES = 8 * 1024;
export const TITLE_LIMIT = 120;
export const MARKDOWN_LIMIT = 40_000;
const marker = '<!-- issue-notes';
const schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().uuid(),
  kind: z.enum(['markdown', 'checklist']),
  color: z.enum(NOTE_COLORS),
  pinned: z.boolean(),
  trashedAt: z.string().datetime().nullable(),
});

export class DocumentValidationError extends Error {
  constructor(public readonly field: 'title' | 'markdown' | 'meta' | 'labels') {
    super(`Invalid note ${field}`);
    this.name = 'DocumentValidationError';
  }
}

/** Preserve extension keys, including __proto__, without invoking object setters. */
export function safeJsonClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  const container = (source: object): Record<string, unknown> =>
    (Array.isArray(source) ? [] : Object.create(null)) as Record<string, unknown>;
  const result = container(value);
  const seen = new WeakMap<object, Record<string, unknown>>([[value, result]]);
  const pending: [object, Record<string, unknown>][] = [[value, result]];
  while (pending.length) {
    const [source, target] = pending.pop()!;
    for (const [key, item] of Object.entries(source)) {
      if (item === null || typeof item !== 'object') {
        target[key] = item;
        continue;
      }
      let copy = seen.get(item);
      if (!copy) {
        copy = container(item);
        seen.set(item, copy);
        pending.push([item, copy]);
      }
      target[key] = copy;
    }
  }
  return result as T;
}

function metadataJSON(meta: NoteMetadata): string {
  if (!schema.safeParse(meta).success) throw new DocumentValidationError('meta');
  let json: string;
  try {
    json = JSON.stringify(meta).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e');
  } catch {
    throw new DocumentValidationError('meta');
  }
  if (new TextEncoder().encode(json).byteLength > METADATA_LIMIT_BYTES)
    throw new DocumentValidationError('meta');
  return json;
}

export function parseNoteBody(body: string): ParseResult {
  if (!body.startsWith(marker)) return { status: 'unmanaged', markdown: body };
  const invalid = (reason: string): ParseResult => ({ status: 'invalid', markdown: body, reason });
  if (!/^<!-- issue-notes(?:\r?\n|$)/u.test(body)) {
    const suffix = body.slice(marker.length);
    if (/^\s/u.test(suffix) || suffix.startsWith('{') || suffix.startsWith('[') || suffix.startsWith('-->'))
      return invalid('metadata-invalid-marker');
    return { status: 'unmanaged', markdown: body };
  }
  const end = body.indexOf('-->', marker.length);
  if (end < 0) return invalid('metadata-unclosed');
  const json = body.slice(marker.length, end).trim();
  if (new TextEncoder().encode(json).byteLength > METADATA_LIMIT_BYTES) return invalid('metadata-too-large');
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    return invalid('metadata-invalid-json');
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    return invalid('metadata-invalid-fields');
  const record = raw as Record<string, unknown>;
  if (typeof record.schemaVersion === 'number' && record.schemaVersion > 1) {
    return { status: 'unsupported', markdown: body, reason: 'metadata-newer-version' };
  }
  if (!schema.safeParse(record).success) return invalid('metadata-invalid-fields');
  // The protocol owns exactly the separator after the comment. All remaining bytes belong to the user.
  const markdown = body.slice(end + 3).replace(/^(?:\r?\n){1,2}/u, '');
  return { status: 'managed', meta: safeJsonClone(record) as NoteMetadata, markdown };
}

export function serializeNoteBody(meta: NoteMetadata, markdown: string): string {
  return `${marker}\n${metadataJSON(meta)}\n-->\n\n${markdown}`;
}

export function newMetadata(kind: NoteKind = 'markdown'): NoteMetadata {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    kind,
    color: 'default',
    pinned: false,
    trashedAt: null,
  };
}

export function snapshotToDocument(snapshot: RawIssueSnapshot): NoteDocument | null {
  const parsed = parseNoteBody(snapshot.body);
  if (parsed.status !== 'managed') return null;
  return {
    title: snapshot.title,
    markdown: parsed.markdown,
    meta: parsed.meta,
    archived: snapshot.state === 'closed',
    labelIds: snapshot.labels.map((label) => label.id),
  };
}

export function validateDocument(doc: NoteDocument): void {
  if (typeof doc.title !== 'string' || [...doc.title].length > TITLE_LIMIT)
    throw new DocumentValidationError('title');
  if (typeof doc.markdown !== 'string' || [...doc.markdown].length > MARKDOWN_LIMIT)
    throw new DocumentValidationError('markdown');
  if (!Array.isArray(doc.labelIds) || doc.labelIds.some((id) => !Number.isSafeInteger(id) || id < 0))
    throw new DocumentValidationError('labels');
  metadataJSON(doc.meta);
}

export function classify(doc: NoteDocument): 'notes' | 'archive' | 'trash' {
  return doc.meta.trashedAt !== null ? 'trash' : doc.archived ? 'archive' : 'notes';
}

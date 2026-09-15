import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearScope,
  createNote,
  discardDraft,
  exportMarkdown,
  exportScope,
  resolveConflict,
  saveEditedNote,
  saveNote,
} from '../src/application/commands';
import { newMetadata, serializeNoteBody } from '../src/domain/codec';
import type { NoteDocument, RawIssueSnapshot } from '../src/domain/types';
import { recoverInterruptedWrites, saveRecovery, TebikaeDB } from '../src/storage/db';

let db: TebikaeDB;
const document = (): NoteDocument => ({
  title: 'Note',
  markdown: 'Local content',
  meta: newMetadata(),
  archived: false,
  labelIds: [],
});
const snapshot = (doc: NoteDocument): RawIssueSnapshot => ({
  id: 1,
  nodeId: 'I_1',
  number: 1,
  url: 'https://github.com/a/b/issues/1',
  title: doc.title,
  body: serializeNoteBody(doc.meta, doc.markdown),
  state: 'open',
  stateReason: null,
  labels: [],
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
});
beforeEach(() => {
  db = new TebikaeDB(`storage-test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await db.delete();
});

describe('durable local commands', () => {
  it('saves desired document and one coalesced intent in one transaction', async () => {
    const note = await createNote('scope-a', document(), db);
    await saveNote('scope-a', note.localId, { ...note.current, markdown: 'Second' }, db);
    await saveNote('scope-a', note.localId, { ...note.current, markdown: 'Third' }, db);
    expect(await db.outbox.count()).toBe(1);
    expect(await db.notes.get(['scope-a', note.localId])).toMatchObject({
      localRevision: 3,
      current: { markdown: 'Third' },
    });
  });

  it('leaves both note and intent untouched if the local transaction fails', async () => {
    const note = await createNote('scope-a', document(), db);
    vi.spyOn(db.outbox, 'put').mockRejectedValueOnce(
      new DOMException('Storage is full', 'QuotaExceededError'),
    );
    await expect(
      saveNote('scope-a', note.localId, { ...note.current, markdown: 'Memory-only draft' }, db),
    ).rejects.toThrow();
    expect((await db.notes.get(['scope-a', note.localId]))?.current.markdown).toBe('Local content');
    expect((await db.notes.get(['scope-a', note.localId]))?.localRevision).toBe(1);
  });

  it('keeps the dispatched frozen attempt when later input is saved', async () => {
    const note = await createNote('scope-a', document(), db);
    await db.outbox.update(['scope-a', note.localId], {
      status: 'sending',
      attemptSnapshot: note.current,
      attemptRevision: 1,
      attemptStartedAt: new Date().toISOString(),
    });
    await saveNote('scope-a', note.localId, { ...note.current, markdown: 'New typing' }, db);
    expect(await db.outbox.get(['scope-a', note.localId])).toMatchObject({
      status: 'sending',
      attemptRevision: 1,
      attemptSnapshot: { markdown: 'Local content' },
    });
    await recoverInterruptedWrites(db, 'scope-a');
    expect((await db.notes.get(['scope-a', note.localId]))?.syncStatus).toBe('uncertain');
    await expect(discardDraft('scope-a', note.localId, db)).rejects.toThrow('DRAFT_ALREADY_DISPATCHED');
  });

  it('applies only editor changes when sync has merged an unseen remote field', async () => {
    const note = await createNote('scope-a', document(), db);
    const editorBaseline = note.current;
    await db.notes.update(['scope-a', note.localId], {
      current: { ...note.current, markdown: 'Remote content merged during editing' },
    });
    const result = await saveEditedNote(
      'scope-a',
      note.localId,
      editorBaseline,
      { ...editorBaseline, meta: { ...editorBaseline.meta, color: 'green' } },
      db,
    );
    expect(result.current.markdown).toBe('Remote content merged during editing');
    expect(result.current.meta.color).toBe('green');
  });

  it('stores competing editor text as a recoverable conflict rather than silently overwriting', async () => {
    const note = await createNote('scope-a', document(), db);
    const editorBaseline = note.current;
    await db.notes.update(['scope-a', note.localId], {
      current: { ...note.current, markdown: 'Fresh remote content' },
    });
    const result = await saveEditedNote(
      'scope-a',
      note.localId,
      editorBaseline,
      { ...editorBaseline, markdown: 'New local typing' },
      db,
    );
    expect(result.current.markdown).toBe('New local typing');
    expect(result.syncStatus).toBe('conflict');
    expect((await db.outbox.toArray())[0]?.status).toBe('conflict');
    expect((await db.recovery.toArray())[0]?.snapshot.markdown).toBe('Fresh remote content');
  });

  it('isolates cleanup to the requested stable account/repository scope', async () => {
    await createNote('scope-a', document(), db);
    await createNote('scope-b', document(), db);
    await clearScope('scope-a', db);
    expect(await db.notes.count()).toBe(1);
    expect((await db.notes.toArray())[0]?.scopeId).toBe('scope-b');
    expect(await db.outbox.count()).toBe(1);
  });

  it('protects unresolved recovery copies while trimming ordinary history', async () => {
    const note = await createNote('scope-a', document(), db);
    for (let i = 0; i < 15; i++) await saveRecovery(db, note, 'unresolved-conflict');
    expect(await db.recovery.count()).toBe(15);
    await db.recovery.toCollection().modify({ resolved: true });
    await saveRecovery(db, note, 'before-write', true);
    expect(await db.recovery.count()).toBe(10);
  });

  it('exports drafts, unknown attempts and conflicts without credentials or HTTP cache', async () => {
    const note = await createNote('scope-a', document(), db);
    await db.httpCache.put({
      scopeId: 'scope-a',
      url: 'https://api.github.com/private',
      accept: 'x',
      apiVersion: 'x',
      etag: 'x',
      response: { sensitiveCache: true },
      link: null,
    });
    const exported = await exportScope('scope-a', db);
    expect(exported.coverage.issueListingComplete).toBe(false);
    expect(exported.drafts[0]?.localId).toBe(note.localId);
    expect(exported.attempts).toHaveLength(1);
    expect(JSON.stringify(exported)).not.toContain('sensitiveCache');
    expect(exportMarkdown({ ...note, current: { ...note.current, title: 'A/B:*? note' } }).filename).toBe(
      'A_B___ note.md',
    );
  });

  it('resolves to a copy while retaining both the remote original and recovery', async () => {
    const note = await createNote('scope-a', document(), db);
    const remote = snapshot({ ...note.current, markdown: 'Remote content' });
    await db.notes.update(['scope-a', note.localId], {
      issueId: 1,
      issueNumber: 1,
      lastSeenRemote: remote,
      syncStatus: 'conflict',
    });
    await resolveConflict('scope-a', note.localId, 'copy', db);
    const notes = await db.notes.toArray();
    expect(notes).toHaveLength(2);
    expect(new Set(notes.map((item) => item.current.meta.id)).size).toBe(2);
    expect(notes.find((item) => item.localId === note.localId)?.current.markdown).toBe('Remote content');
    expect(notes.find((item) => item.localId !== note.localId)?.current.markdown).toBe('Local content');
    expect(await db.recovery.count()).toBe(1);
  });
});

import { useMemo } from 'react';
import { Pin, Archive, ArchiveRestore, Trash2, RotateCcw, CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Label, LocalNote } from '../../domain/types';
import { parseChecklist } from '../../domain/markdown';
import { IconButton } from '../../app/ui';

export default function NoteCard({
  note,
  labels,
  onOpen,
  onChange,
  writable,
}: {
  note: LocalNote;
  labels: Label[];
  onOpen(): void;
  onChange(action: 'pin' | 'archive' | 'trash' | 'restore' | number): void;
  writable: boolean;
}) {
  const { t, i18n } = useTranslation();
  const document = note.current;
  const checklist = useMemo(
    () => (document.meta.kind === 'checklist' ? parseChecklist(document.markdown) : []),
    [document.markdown, document.meta.kind],
  );
  const preview = document.markdown
    .slice(0, 700)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '[$1]')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`]/g, '')
    .slice(0, 340);
  const trashed = document.meta.trashedAt !== null;
  const editable = writable && !note.duplicate && !note.remoteUnavailable;
  const updated =
    note.syncStatus === 'synced' ? note.base?.updatedAt || note.localModifiedAt : note.localModifiedAt;
  return (
    <article className={`note-card note-${document.meta.color}`}>
      <button className="note-open" onClick={onOpen} aria-label={`${t('action.edit')}: ${document.title}`}>
        <div className="card-title">
          <h3>{document.title}</h3>
          {document.meta.pinned && <Pin size={14} />}
        </div>
        {!checklist.length && <p className="card-preview">{preview || t('note.blank')}</p>}
      </button>
      {checklist.length > 0 && (
        <div className="card-checklist">
          {checklist.slice(0, 6).map((item) => (
            <label key={item.index} style={{ paddingInlineStart: Math.min(item.depth, 3) * 10 }}>
              <input
                type="checkbox"
                checked={item.checked}
                disabled={!editable || trashed}
                onChange={() => onChange(item.index)}
              />
              <span className={item.checked ? 'checked' : ''}>{item.text}</span>
            </label>
          ))}
          <button className="checklist-count" onClick={onOpen}>
            {t('note.done', { done: checklist.filter((x) => x.checked).length, total: checklist.length })}
          </button>
        </div>
      )}
      {document.labelIds.length > 0 && (
        <div className="card-labels">
          {document.labelIds.map((id) => (
            <span key={id}>{labels.find((l) => l.id === id)?.name || `#${id}`}</span>
          ))}
        </div>
      )}
      <div className="card-footer">
        <time dateTime={updated}>
          {new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric' }).format(
            new Date(updated),
          )}
        </time>
        {note.syncStatus !== 'synced' && (
          <span
            className={`card-status status-${note.syncStatus}`}
            title={t(`status.${note.syncStatus}`)}
            aria-label={t(`status.${note.syncStatus}`)}
          >
            <CircleAlert size={13} />
            <span>{t(`status.${note.syncStatus}`)}</span>
          </span>
        )}
        <div className="card-actions">
          {trashed ? (
            <IconButton label={t('action.restore')} onClick={() => onChange('restore')} disabled={!editable}>
              <RotateCcw size={16} />
            </IconButton>
          ) : (
            <>
              <IconButton
                label={t(document.meta.pinned ? 'action.unpin' : 'action.pin')}
                onClick={() => onChange('pin')}
                disabled={!editable}
              >
                <Pin size={16} />
              </IconButton>
              <IconButton
                label={t(document.archived ? 'action.unarchive' : 'action.archive')}
                onClick={() => onChange('archive')}
                disabled={!editable}
              >
                {document.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </IconButton>
              <IconButton label={t('action.trash')} onClick={() => onChange('trash')} disabled={!editable}>
                <Trash2 size={16} />
              </IconButton>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

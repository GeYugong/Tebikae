import * as Dialog from '@radix-ui/react-dialog';
import { X, NotebookPen, Sun, Moon, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { type ReactNode } from 'react';
import { usePreferences } from './preferences';
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <NotebookPen size={compact ? 21 : 24} strokeWidth={1.8} />
      </span>
      <span>
        Tebikae<span className="brand-dot">.</span>
      </span>
    </div>
  );
}
export function IconButton({
  label,
  children,
  onClick,
  disabled,
  className = '',
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`}
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function PreferencesControls() {
  const prefs = usePreferences();
  const { t } = useTranslation();
  return (
    <div className="preferences-controls">
      <select
        aria-label={t('settings.language')}
        value={prefs.language}
        onChange={(e) => prefs.setLanguage(e.target.value)}
      >
        <option value="en">English</option>
        <option value="zh-CN">简体中文</option>
      </select>
      <IconButton
        label={t(`settings.${prefs.theme}`)}
        onClick={() =>
          prefs.setTheme(prefs.theme === 'system' ? 'light' : prefs.theme === 'light' ? 'dark' : 'system')
        }
      >
        {prefs.theme === 'dark' ? (
          <Moon size={18} />
        ) : prefs.theme === 'light' ? (
          <Sun size={18} />
        ) : (
          <Monitor size={18} />
        )}
      </IconButton>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  className = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`dialog ${className}`}
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="dialog-header">
            <Dialog.Title>{title}</Dialog.Title>
            <IconButton label={t('action.close')} onClick={onClose}>
              <X size={19} />
            </IconButton>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function download(name: string, value: string, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([value], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = [...name].map((c) => (c.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(c) ? '_' : c)).join('');
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

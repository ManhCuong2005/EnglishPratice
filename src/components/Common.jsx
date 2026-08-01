import { useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export function Button({ children, variant = 'primary', size = 'md', icon: Icon, className = '', ...props }) {
  return (
    <button className={`button button--${variant} button--${size} ${className}`} {...props}>
      {Icon && <Icon size={size === 'sm' ? 16 : 18} strokeWidth={2.2} />}
      <span>{children}</span>
    </button>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">{Icon ? <Icon size={28} /> : '🌿'}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, eyebrow, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', closeOnEscape);
    document.body.classList.add('modal-open');
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.body.classList.remove('modal-open');
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal modal--${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal__header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </header>
        <div className="modal__body">{children}</div>
      </section>
    </div>
  );
}

const toastIcons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

export function Toasts({ items, onDismiss }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map((toast) => {
        const Icon = toastIcons[toast.type] || Info;
        return (
          <div className={`toast toast--${toast.type || 'info'}`} key={toast.id}>
            <Icon size={20} />
            <div><strong>{toast.title}</strong>{toast.message && <p>{toast.message}</p>}</div>
            <button onClick={() => onDismiss(toast.id)} aria-label="Đóng thông báo"><X size={16} /></button>
          </div>
        );
      })}
    </div>
  );
}

export function ProgressBar({ value, max = 100, label, compact = false }) {
  const percent = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className={`progress-wrap ${compact ? 'progress-wrap--compact' : ''}`}>
      {label && <div className="progress-label"><span>{label}</span><strong>{Math.round(percent)}%</strong></div>}
      <div className="progress-track"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Xóa', danger = true }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="modal-description">{description}</p>
      <div className="modal-actions">
        <Button variant="ghost" onClick={onClose}>Hủy</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function SkeletonPage() {
  return (
    <div className="loading-page">
      <div className="brand-mark brand-mark--large"><span>V</span></div>
      <div className="loading-dots"><i /><i /><i /></div>
      <p>Đang mở góc học tập của bạn…</p>
    </div>
  );
}

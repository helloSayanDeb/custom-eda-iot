interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmDialog({
  open, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  onConfirm, onCancel,
  danger = false,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      {/* Dialog card */}
      <div
        className="rounded-2xl p-6 w-80 shadow-2xl"
        style={{
          background: 'rgba(15,23,42,0.98)',
          border: danger
            ? '1px solid rgba(239,68,68,0.35)'
            : '1px solid rgba(255,255,255,0.1)',
          boxShadow: danger
            ? '0 0 40px rgba(239,68,68,0.15), 0 24px 64px rgba(0,0,0,0.6)'
            : '0 24px 64px rgba(0,0,0,0.6)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + title */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
            style={{
              background: danger ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
              border: danger ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(99,102,241,0.3)',
            }}
          >
            {danger ? '🗑️' : '❓'}
          </div>
          <h2 className="text-sm font-bold text-white/90">{title}</h2>
        </div>

        {/* Message */}
        <p className="text-xs text-white/55 leading-relaxed mb-5 pl-12">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-2 justify-end">
          <button
            id="confirm-dialog-cancel"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-white/90 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {cancelLabel}
          </button>
          <button
            id="confirm-dialog-confirm"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: danger
                ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                : 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: '#fff',
              boxShadow: danger
                ? '0 4px 16px rgba(220,38,38,0.35)'
                : '0 4px 16px rgba(99,102,241,0.35)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

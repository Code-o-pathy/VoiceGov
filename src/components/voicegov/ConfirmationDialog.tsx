"use client";

interface Props {
  summary: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  note?: string;
}

export function ConfirmationDialog({
  summary,
  onConfirm,
  onCancel,
  title = "Confirmation Required",
  icon = "⚠️",
  confirmLabel = "Confirm & Submit",
  cancelLabel = "Cancel",
  note = "This is a consequential action. VoiceGov will only proceed after you confirm. You can also just say “yes” or “no”.",
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xl">
            {icon}
          </span>
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">{summary}</p>
        <p className="mt-2 text-xs text-slate-400">{note}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-[#0b5cab] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0a4f92]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

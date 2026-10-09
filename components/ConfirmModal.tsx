"use client";

import { Modal, Button } from "@/components/ui";

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} ariaLabel={title} closeDisabled={busy}>
      <div className="p-5 sm:p-6">
        <h2 className="text-lg font-black text-zinc-900" id="confirm-title">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

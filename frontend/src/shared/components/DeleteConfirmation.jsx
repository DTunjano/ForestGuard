import { useRef, useState } from "react";
import { Modal } from "./Modal";
import { Button, Notice } from "./UI";
export function DeleteConfirmation({ name, explanation, onDelete, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lock = useRef(false);
  async function remove() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal title={`Eliminar ${name}`} busy={busy} onClose={onClose}>
      <p>{explanation}</p>
      <Notice error={error} />
      <div className="fg-actions">
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="danger" disabled={busy} onClick={remove}>
          {busy ? "Eliminando…" : "Confirmar eliminación"}
        </Button>
      </div>
    </Modal>
  );
}

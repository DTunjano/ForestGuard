import { useRef, useState } from "react";
import { LuTrash2, LuTriangleAlert } from "react-icons/lu";
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
      <div className="fg-delete-dialog">
        <div className="fg-delete-warning-box">
          <div className="fg-delete-warning-icon" aria-hidden="true">
            <LuTriangleAlert size={22} />
          </div>
          <div className="fg-delete-warning-copy">
            <strong>Confirmación de borrado permanente</strong>
            <p>{explanation}</p>
          </div>
        </div>

        <Notice error={error} />

        <div className="fg-delete-actions">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            onClick={remove}
          >
            <LuTrash2 size={15} aria-hidden="true" />
            <span>{busy ? "Eliminando…" : "Confirmar eliminación"}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}

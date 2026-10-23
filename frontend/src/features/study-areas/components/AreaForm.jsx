import { useState } from "react";
import { saveArea } from "../api/areas";
import { Field, Button, Notice } from "../../../shared/components/UI";
export function AreaForm({ onCreated, area, onCancel, onBusy }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    onBusy?.(true);
    setError(null);
    try {
      const saved = await saveArea(
        Object.fromEntries(new FormData(form)),
        area?.id,
      );
      onCreated(saved);
      form.reset();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
        <Field
          label="Nombre del área"
          name="name"
          required
          maxLength={160}
          defaultValue={area?.name}
        />
        <Field
          label="Departamento"
          name="department"
          maxLength={100}
          defaultValue={area?.department}
        />
        <Field
          label="Municipio"
          name="municipality"
          maxLength={100}
          defaultValue={area?.municipality}
        />
        <Field label="Descripción del área">
          <textarea
            name="description"
            defaultValue={area?.description}
            rows={3}
          />
        </Field>
        <div className="fg-actions md:col-span-2">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button disabled={busy}>
            {busy ? "Guardando…" : area ? "Guardar área" : "Crear área"}
          </Button>
        </div>
        <Notice error={error} />
      </fieldset>
    </form>
  );
}

import { useState } from "react";
import { LuCheck, LuCompass, LuMapPin, LuTrees } from "react-icons/lu";
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
    <form onSubmit={submit} className="fg-area-form">
      <fieldset disabled={busy} className="fg-area-form-fieldset">
        <div className="fg-area-form-grid">
          <div className="fg-area-form-card">
            <div className="fg-area-form-card-header">
              <span className="fg-area-form-card-icon" aria-hidden="true">
                <LuMapPin size={18} />
              </span>
              <div>
                <p className="fg-eyebrow">Identificación territorial</p>
                <h4>Nombre y ubicación</h4>
              </div>
            </div>

            <Field
              label="Nombre del área"
              name="name"
              placeholder="Ej. Sector Norte · Reserva La Macarena"
              required
              maxLength={160}
              defaultValue={area?.name}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Departamento"
                name="department"
                placeholder="Ej. Meta"
                maxLength={100}
                defaultValue={area?.department}
              />
              <Field
                label="Municipio"
                name="municipality"
                placeholder="Ej. La Macarena"
                maxLength={100}
                defaultValue={area?.municipality}
              />
            </div>
          </div>

          <div className="fg-area-form-card">
            <div className="fg-area-form-card-header">
              <span className="fg-area-form-card-icon" aria-hidden="true">
                <LuCompass size={18} />
              </span>
              <div>
                <p className="fg-eyebrow">Contexto de observación</p>
                <h4>Notas y referencias del sector</h4>
              </div>
            </div>

            <Field label="Descripción del área">
              <textarea
                name="description"
                placeholder="Describe referencias geográficas, características del sector o notas para identificar este territorio (opcional)."
                defaultValue={area?.description}
                rows={4}
              />
            </Field>

            <p className="fg-area-form-tip">
              <LuTrees aria-hidden="true" />
              <span>
                Las escenas Sentinel-2 y los análisis históricos que registres
                quedarán organizados dentro de este territorio.
              </span>
            </p>
          </div>
        </div>

        <Notice error={error} />

        <div className="fg-area-form-footer">
          <span className="text-xs text-slate-400">
            El nombre del área es obligatorio; ubicación y descripción son
            opcionales.
          </span>
          <div className="fg-actions">
            {onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button disabled={busy}>
              <LuCheck aria-hidden="true" />
              {busy ? "Guardando…" : area ? "Guardar área" : "Crear área"}
            </Button>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

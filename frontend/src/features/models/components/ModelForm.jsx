import { useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import { Button, Field, Notice, Select } from "../../../shared/components/UI";
import { useResource } from "../../../shared/api/useResource";
import { saveModel } from "../api/models";

export function ModelForm({ model, onClose, onSaved }) {
  const packages = useResource(!model ? "admin/models/packages/" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [packageKey, setPackageKey] = useState("");
  const available =
    packages.data?.filter((item) => item.available && !item.registered_id) ||
    [];
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const body = Object.fromEntries(new FormData(event.currentTarget));
    body.active = body.active === "true";
    if (!body.name && !model) delete body.name;
    setBusy(true);
    setError(null);
    try {
      await saveModel(body, model?.id);
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={
        model ? `Editar modelo ${model.version}` : "Registrar modelo instalado"
      }
      busy={busy}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        {!model && (
          <>
            <Notice error={packages.error}>
              {packages.loading
                ? "Consultando paquetes instalados…"
                : "Selecciona un paquete verificado del servidor."}
            </Notice>
            {packages.error && (
              <Button type="button" onClick={packages.reload}>
                Reintentar paquetes
              </Button>
            )}
            {!packages.loading && !packages.error && !available.length && (
              <Notice>
                Todos los paquetes disponibles ya están registrados o requieren
                revisión en el servidor. Puedes editar los modelos existentes.
              </Notice>
            )}
          </>
        )}
        {model && (
          <p className="text-sm text-slate-300">
            {model.algorithm} · Versión {model.version}. Sus análisis y métricas
            se conservan.
          </p>
        )}
        <fieldset
          disabled={busy || (!model && !available.length)}
          className="grid gap-4"
        >
          {!model && (
            <Field label="Paquete instalado">
              <Select
                name="package_key"
                value={
                  available.find((item) => item.key === packageKey)?.key ||
                  available[0]?.key ||
                  ""
                }
                onChange={(event) => setPackageKey(event.target.value)}
              >
                {available.length ? (
                  available.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.name} · {item.version}
                    </option>
                  ))
                ) : (
                  <option value="">Sin paquetes para registrar</option>
                )}
              </Select>
            </Field>
          )}
          <Field
            label="Nombre del modelo"
            name="name"
            defaultValue={model?.name}
            required={Boolean(model)}
            maxLength={120}
          />
          <Field label="Descripción del modelo">
            <textarea
              name="description"
              defaultValue={model?.description || ""}
              rows={3}
              className="w-full rounded-lg border border-white/25 bg-[#08111f] p-3"
            />
          </Field>
          <Field label="Disponibilidad del modelo">
            <Select name="active" defaultValue={String(model?.active ?? true)}>
              <option value="true">
                Activo · disponible para nuevos análisis
              </option>
              <option value="false">
                Inactivo · conserva los análisis existentes
              </option>
            </Select>
          </Field>
          <Button disabled={busy || Boolean(packages.error)}>
            {busy
              ? "Guardando…"
              : model
                ? "Guardar modelo"
                : "Registrar modelo"}
          </Button>
        </fieldset>
        <Notice error={error} />
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={onClose}
        >
          Cancelar
        </Button>
      </form>
    </Modal>
  );
}

import { useState } from "react";
import { Modal } from "../../../shared/components/Modal";
import { Button, Field, Notice, Select } from "../../../shared/components/UI";
import { createAdministrator } from "../api/users";

export function AdministratorForm({ canCreateSuperuser, onClose, onSaved }) {
  const [type, setType] = useState("administrator");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (data.password !== data.confirm_password) {
      setError(new Error("Las contraseñas no coinciden."));
      return;
    }
    delete data.confirm_password;
    data.account_type = type;
    setBusy(true);
    setError(null);
    try {
      onSaved(await createAdministrator(data));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Crear cuenta administradora" busy={busy} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Notice>
          {type === "superuser"
            ? "Acceso completo a ForestGuard y al administrador de Django."
            : "Gestiona usuarios, roles y modelos, además de tus análisis de ForestGuard."}
        </Notice>
        <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
          {canCreateSuperuser && (
            <div className="md:col-span-2">
              <Field label="Tipo de cuenta administradora">
                <Select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                >
                  <option value="administrator">
                    Administrador de ForestGuard
                  </option>
                  <option value="superuser">Superusuario de Django</option>
                </Select>
              </Field>
            </div>
          )}
          <Field
            label="Usuario"
            name="username"
            autoComplete="off"
            required
            maxLength={150}
          />
          <Field
            label="Correo"
            name="email"
            type="email"
            autoComplete="off"
            required
            maxLength={254}
          />
          <Field label="Nombre" name="first_name" maxLength={150} />
          <Field label="Apellido" name="last_name" maxLength={150} />
          <Field
            label="Contraseña inicial"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
          <Field
            label="Confirmar contraseña"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            required
          />
        </fieldset>
        <Notice error={error} />
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy}>
            {busy ? "Creando cuenta…" : "Crear cuenta administradora"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { useState } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { changePassword } from "../../auth/api/auth";
import { clearSession } from "../../../shared/api/client";
import {
  Page,
  Panel,
  Field,
  Button,
  Notice,
} from "../../../shared/components/UI";
export function Profile() {
  const { user, updateProfile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("");
  async function submit(event, password = false) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (password) {
        await changePassword(body);
        clearSession();
      } else {
        await updateProfile(body);
        setMessage("Perfil actualizado.");
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Mi perfil">
      <Panel>
        <p>
          {user.username} ·{" "}
          {user.role === "admin" ? "Administrador" : "Analista"}
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Nombre"
            name="first_name"
            defaultValue={user.first_name}
          />
          <Field
            label="Apellido"
            name="last_name"
            defaultValue={user.last_name}
          />
          <Field
            label="Correo"
            name="email"
            type="email"
            required
            defaultValue={user.email}
          />
          <Button disabled={busy}>Guardar perfil</Button>
        </form>
      </Panel>
      <Panel>
        <h2>Cambiar contraseña</h2>
        <p>Después del cambio tendrás que iniciar sesión nuevamente.</p>
        <form onSubmit={(e) => submit(e, true)} className="space-y-4">
          <Field
            label="Contraseña actual"
            name="old_password"
            type="password"
            autoComplete="current-password"
            required
          />
          <Field
            label="Nueva contraseña"
            name="new_password"
            type="password"
            autoComplete="new-password"
            required
          />
          <Button disabled={busy}>Cambiar contraseña</Button>
        </form>
      </Panel>
      <Notice error={error}>{message}</Notice>
    </Page>
  );
}

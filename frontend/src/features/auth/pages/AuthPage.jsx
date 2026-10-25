import {
  LuTrees,
  LuSatellite,
  LuScanLine,
  LuShieldCheck,
} from "react-icons/lu";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { register } from "../api/auth";
import { Button, Field, Notice, Panel } from "../../../shared/components/UI";

export function AuthPage({ registration = false }) {
  const { signIn, isAuthenticated, checking } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [registered, setRegistered] = useState(false);
  if (checking) return <Notice>Comprobando sesión…</Notice>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (registration && !registered) {
        if (values.password !== values.confirm)
          throw new Error("Las contraseñas no coinciden.");
        delete values.confirm;
        await register(values);
        setRegistered(true);
      }
      await signIn({ username: values.username, password: values.password });
      navigate("/dashboard");
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="fg-auth text-white">
      <section className="fg-auth-story" aria-label="Acerca de ForestGuard">
        <div className="fg-auth-brand">
          <LuTrees size={32} />
          ForestGuard
        </div>
        <div>
          <p className="fg-eyebrow">Inteligencia territorial</p>
          <h2>Cada píxel cuenta para entender el bosque.</h2>
          <p>
            Observa tu territorio a través del tiempo. Convierte escenas
            satelitales en mapas, índices y nuevas preguntas para tu
            investigación.
          </p>
        </div>
        <div className="fg-auth-foot">
          <span>
            <LuSatellite /> Sentinel-2
          </span>
          <span>
            <LuScanLine /> Análisis histórico
          </span>
          <span>
            <LuShieldCheck /> Espacio privado
          </span>
        </div>
      </section>
      <div className="fg-auth-form">
        <Panel>
          <p className="fg-eyebrow">Tu espacio de observación</p>
          <h1 className="fg-auth-brand">
            <LuTrees /> ForestGuard
          </h1>
          <h2>{registration ? "Crear cuenta" : "Iniciar sesión"}</h2>
          {registered && (
            <Notice>
              Cuenta creada. Si el ingreso automático falla, puedes ir a Iniciar
              sesión.
            </Notice>
          )}
          <form onSubmit={submit} className="space-y-4">
            <Field
              label="Usuario"
              name="username"
              required
              autoComplete="username"
            />
            {registration && (
              <>
                <Field
                  label="Correo"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
                <Field
                  label="Nombre"
                  name="first_name"
                  autoComplete="given-name"
                />
                <Field
                  label="Apellido"
                  name="last_name"
                  autoComplete="family-name"
                />
              </>
            )}
            <Field
              label="Contraseña"
              name="password"
              type="password"
              required
              autoComplete={registration ? "new-password" : "current-password"}
            />
            {registration && (
              <Field
                label="Confirmar contraseña"
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
              />
            )}
            <Notice error={error} />
            <Button disabled={busy}>
              {busy
                ? "Enviando…"
                : registration
                  ? "Registrar e ingresar"
                  : "Ingresar"}
            </Button>
          </form>
          <Link
            className="underline"
            to={registration ? "/auth/login" : "/auth/register"}
          >
            {registration ? "Ya tengo una cuenta" : "Crear cuenta"}
          </Link>
        </Panel>
      </div>
    </main>
  );
}

import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { register } from '../api/auth';
import { Button, Field, Notice, Panel } from '../../../shared/components/UI';

export function AuthPage({ registration = false }) {
  const { signIn, isAuthenticated, checking } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  if (checking) return <Notice>Comprobando sesión…</Notice>;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (registration) {
        if (values.password !== values.confirm) throw new Error('Las contraseñas no coinciden.');
        delete values.confirm; await register(values);
      }
      await signIn({ username: values.username, password: values.password }); navigate('/dashboard');
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return <main className="min-h-screen bg-[#08111f] p-6 text-white"><div className="mx-auto mt-12 max-w-md"><Panel>
    <h1 className="text-3xl">ForestGuard</h1><h2>{registration ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
    <form onSubmit={submit} className="space-y-4"><Field label="Usuario" name="username" required autoComplete="username" />
      {registration && <><Field label="Correo" name="email" type="email" required autoComplete="email" /><Field label="Nombre" name="first_name" autoComplete="given-name" /><Field label="Apellido" name="last_name" autoComplete="family-name" /></>}
      <Field label="Contraseña" name="password" type="password" required autoComplete={registration ? 'new-password' : 'current-password'} />
      {registration && <Field label="Confirmar contraseña" name="confirm" type="password" required autoComplete="new-password" />}
      <Notice error={error} /><Button disabled={busy}>{busy ? 'Enviando…' : registration ? 'Registrar e ingresar' : 'Ingresar'}</Button>
    </form><Link className="underline" to={registration ? '/auth/login' : '/auth/register'}>{registration ? 'Ya tengo una cuenta' : 'Crear cuenta'}</Link>
  </Panel></div></main>;
}

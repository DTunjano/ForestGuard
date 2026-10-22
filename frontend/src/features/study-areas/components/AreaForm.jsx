import { useState } from 'react';
import { saveArea } from '../api/areas';
import { Field, Button, Notice } from '../../../shared/components/UI';
export function AreaForm({ onCreated }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(null);
  async function submit(e) {
    e.preventDefault(); const form = e.currentTarget; setBusy(true); setError(null);
    try { const area = await saveArea(Object.fromEntries(new FormData(form))); onCreated(area); form.reset(); }
    catch (err) { setError(err); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="grid gap-3 md:grid-cols-2"><Field label="Nombre del área" name="name" required maxLength={160} /><Field label="Departamento" name="department" /><Field label="Municipio" name="municipality" /><Field label="Descripción del área" name="description" /><Button disabled={busy}>Crear área</Button><Notice error={error} /></form>;
}

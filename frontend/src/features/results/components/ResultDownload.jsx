import { useState } from "react";
import { LuDownload } from "react-icons/lu";
import { download } from "../../../shared/api/client";
import { Button, Notice } from "../../../shared/components/UI";

export function ResultDownload({ artifact, children }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function save() {
    if (!artifact || busy) return;
    setBusy(true);
    setError(null);
    try {
      await download(
        artifact.download_url,
        artifact.relative_path.split("/").at(-1),
      );
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" disabled={!artifact || busy} onClick={save}>
        <LuDownload aria-hidden="true" />
        {busy ? "Descargando…" : children}
      </Button>
      <Notice error={error} />
    </div>
  );
}

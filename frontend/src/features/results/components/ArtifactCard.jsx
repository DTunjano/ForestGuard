import { useEffect, useState } from "react";
import { request, download } from "../../../shared/api/client";
import { Button, Notice, Panel } from "../../../shared/components/UI";
function PrivateImage({ url, label }) {
  const [state, setState] = useState({});
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    request(url, { binary: true, signal: controller.signal })
      .then((blob) => {
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setState({ url, src: objectUrl });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ url, error });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);
  return state.url === url && state.src ? (
    <img
      src={state.src}
      alt={label}
      className="max-h-[1000px] w-full object-contain"
    />
  ) : (
    <Notice error={state.url === url ? state.error : null}>
      Cargando visualización…
    </Notice>
  );
}
export function ArtifactCard({ artifact }) {
  const board =
    artifact.kind === "visualization" && !artifact.relative_path.includes("/");
  const [open, setOpen] = useState(board);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const name = artifact.relative_path.split("/").at(-1);
  const imageUrl =
    artifact.kind === "raster"
      ? artifact.png_download_url || artifact.preview_url
      : artifact.kind === "visualization"
        ? artifact.download_url
        : null;
  async function save(url, filename) {
    setBusy(true);
    setError(null);
    try {
      await download(url, filename);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Panel>
      <h3>{artifact.label}</h3>
      <div className="flex flex-wrap gap-3">
        {imageUrl && (
          <Button onClick={() => setOpen((value) => !value)}>
            {open ? "Ocultar mapa" : "Ver mapa"}
          </Button>
        )}
        <Button
          disabled={busy}
          onClick={() => save(artifact.download_url, name)}
        >
          Descargar{" "}
          {artifact.kind === "raster"
            ? "GeoTIFF"
            : name.split(".").at(-1).toUpperCase()}
        </Button>
        {artifact.kind === "raster" && (
          <Button
            disabled={busy}
            onClick={() =>
              save(artifact.png_download_url, name.replace(/\.tiff?$/i, ".png"))
            }
          >
            Descargar PNG
          </Button>
        )}
      </div>
      <Notice error={error} />
      {open && imageUrl && (
        <PrivateImage url={imageUrl} label={artifact.label} />
      )}
    </Panel>
  );
}

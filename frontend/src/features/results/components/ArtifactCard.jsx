import { useEffect, useState } from "react";
import {
  LuDownload,
  LuEye,
  LuEyeOff,
  LuFileCode,
  LuFileSpreadsheet,
  LuFileText,
  LuImage,
  LuLayers,
} from "react-icons/lu";
import { request, download } from "../../../shared/api/client";
import { Button, Notice, Panel } from "../../../shared/components/UI";

function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PrivateImage({ url, label }) {
  const [state, setState] = useState({});
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    request(url, { binary: true, signal: controller.signal })
      .then((blob) => {
        if (!controller.signal.aborted) {
          objectUrl = URL.createObjectURL(blob);
          setState({ url, revision, src: objectUrl });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setState({ url, revision, error });
      });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, revision]);
  const current = state.url === url && state.revision === revision;
  return current && state.src ? (
    <div className="fg-artifact-map-frame">
      <img
        src={state.src}
        alt={label}
        className="max-h-[960px] w-full object-contain"
      />
    </div>
  ) : (
    <>
      <Notice error={current ? state.error : null}>
        Cargando visualización…
      </Notice>
      {current && state.error && (
        <Button
          variant="secondary"
          onClick={() => setRevision((value) => value + 1)}
        >
          Reintentar visualización
        </Button>
      )}
    </>
  );
}

export function ArtifactCard({
  artifact,
  initialOpen,
  title = artifact.label,
  showToggle = true,
}) {
  const board =
    artifact.kind === "visualization" && !artifact.relative_path.includes("/");
  const [open, setOpen] = useState(initialOpen ?? board);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const name = artifact.relative_path.split("/").at(-1);
  const ext = name.split(".").at(-1).toUpperCase();
  const sizeLabel = formatSize(artifact.size_bytes);

  const imageUrl =
    artifact.kind === "raster"
      ? artifact.png_download_url || artifact.preview_url
      : artifact.kind === "visualization"
        ? artifact.download_url
        : null;

  let CategoryIcon = LuFileSpreadsheet;
  let categoryText = "Archivo de resultado";
  let categoryClass = "is-default";
  if (board) {
    CategoryIcon = LuImage;
    categoryText = "Lámina general de síntesis";
    categoryClass = "is-board";
  } else if (artifact.kind === "raster") {
    CategoryIcon = LuLayers;
    categoryText = "Capa geoespacial GeoTIFF + PNG";
    categoryClass = "is-raster";
  } else if (ext === "PDF") {
    CategoryIcon = LuFileText;
    categoryText = "Informe técnico en PDF";
    categoryClass = "is-report";
  } else if (ext === "JSON") {
    CategoryIcon = LuFileCode;
    categoryText = "Métricas estructuradas JSON";
    categoryClass = "is-json";
  } else if (artifact.kind === "visualization") {
    CategoryIcon = LuImage;
    categoryText = "Visualización cartográfica PNG";
    categoryClass = "is-board";
  }

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
      <div className="fg-artifact-card">
        <div className="fg-artifact-top">
          <div className="fg-artifact-info">
            <div
              className={`fg-artifact-icon ${categoryClass}`}
              aria-hidden="true"
            >
              <CategoryIcon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="fg-artifact-badges">
                <span className={`fg-artifact-type-pill ${categoryClass}`}>
                  {categoryText}
                </span>
                {sizeLabel && (
                  <span className="fg-artifact-meta-pill">{sizeLabel}</span>
                )}
                <span
                  className="fg-artifact-path-pill"
                  title={artifact.relative_path}
                >
                  {name}
                </span>
              </div>
              <h3 className="fg-artifact-title">{title}</h3>
            </div>
          </div>

          <div className="fg-artifact-actions">
            {imageUrl && showToggle && (
              <Button onClick={() => setOpen((value) => !value)}>
                {open ? (
                  <>
                    <LuEyeOff size={15} aria-hidden="true" />
                    <span>Ocultar mapa</span>
                  </>
                ) : (
                  <>
                    <LuEye size={15} aria-hidden="true" />
                    <span>Ver mapa</span>
                  </>
                )}
              </Button>
            )}
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => save(artifact.download_url, name)}
            >
              <LuDownload size={15} aria-hidden="true" />
              <span>
                Descargar {artifact.kind === "raster" ? "GeoTIFF" : ext}
              </span>
            </Button>
            {artifact.kind === "raster" && (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  save(
                    artifact.png_download_url,
                    name.replace(/\.tiff?$/i, ".png"),
                  )
                }
              >
                <LuDownload size={15} aria-hidden="true" />
                <span>Descargar PNG</span>
              </Button>
            )}
          </div>
        </div>

        <Notice error={error} />
        {!imageUrl && (
          <p className="text-sm text-slate-300">
            {ext === "PDF"
              ? "Informe del análisis con mapas, métricas e interpretación."
              : "Datos y métricas del análisis en formato estructurado."}
          </p>
        )}

        {open && imageUrl && <PrivateImage url={imageUrl} label={title} />}
      </div>
    </Panel>
  );
}

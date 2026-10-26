import { useEffect, useMemo, useRef, useState } from "react";
import { request } from "../../../shared/api/client";
import { useResource } from "../../../shared/api/useResource";
import { Button, Notice } from "../../../shared/components/UI";
import { composeMap, decodeMask, sameGrid } from "../utils/mapLayers";

function useIndexLayer(artifact) {
  const [state, setState] = useState({});
  const [revision, setRevision] = useState(0);
  const preview = artifact?.preview_url;
  const metadata = artifact?.metadata_url;
  useEffect(() => {
    if (!preview || !metadata) return;
    const controller = new AbortController();
    async function load() {
      try {
        const [blob, details] = await Promise.all([
          request(`${preview}?palette=contrast`, {
            binary: true,
            signal: controller.signal,
          }),
          request(`${metadata}?palette=contrast`, {
            signal: controller.signal,
          }),
        ]);
        const bitmap = await createImageBitmap(blob);
        try {
          if (controller.signal.aborted) return;
          const buffer = document.createElement("canvas");
          buffer.width = bitmap.width;
          buffer.height = bitmap.height;
          const context = buffer.getContext("2d", { willReadFrequently: true });
          context.drawImage(bitmap, 0, 0);
          const pixels = context.getImageData(
            0,
            0,
            buffer.width,
            buffer.height,
          );
          setState({ preview, revision, pixels, details });
        } finally {
          bitmap.close();
        }
      } catch (error) {
        if (!controller.signal.aborted) setState({ preview, revision, error });
      }
    }
    load();
    return () => controller.abort();
  }, [preview, metadata, revision]);
  return {
    ...(state.preview === preview && state.revision === revision ? state : {}),
    reload: () => setRevision((value) => value + 1),
  };
}

export function InteractiveCoverageMap({
  result,
  layer,
  indicator,
  temporal,
  categories,
  selected,
  contextOpacity,
  title,
  filename,
}) {
  const maskQuery = useResource(result.category_mask_url);
  const indexQuery = useIndexLayer(layer);
  const canvas = useRef(null);
  const [exportError, setExportError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const decoded = useMemo(() => {
    try {
      return maskQuery.data ? { mask: decodeMask(maskQuery.data) } : {};
    } catch (error) {
      return { error };
    }
  }, [maskQuery.data]);
  const mask = decoded.mask;
  const pixels = layer ? indexQuery.pixels : null;
  const mismatch =
    mask &&
    pixels &&
    (pixels.width !== mask.width ||
      pixels.height !== mask.height ||
      !sameGrid(mask.grid, indexQuery.details?.grid));
  const error =
    maskQuery.error ||
    decoded.error ||
    (layer && indexQuery.error) ||
    (mismatch
      ? new Error(
          "Las capas no comparten la misma geometría. Selecciona otra capa para visualizarla.",
        )
      : null);
  const ready = !!mask && (!layer || !!pixels) && !error;
  useEffect(() => {
    if (!ready || !canvas.current) return;
    const data = composeMap(
      mask,
      categories,
      selected,
      contextOpacity,
      pixels?.data,
    );
    canvas.current
      .getContext("2d")
      .putImageData(new ImageData(data, mask.width, mask.height), 0, 0);
  }, [ready, mask, pixels, categories, selected, contextOpacity]);

  async function saveView() {
    setExportError(null);
    setExporting(true);
    try {
      const blob = await new Promise((resolve, reject) =>
        canvas.current.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("No fue posible exportar el mapa.")),
          "image/png",
        ),
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${filename}${selected.length ? "_resaltado" : ""}.png`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setExportError(error);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      {ready ? (
        <div className="fg-artifact-map-frame">
          <canvas
            ref={canvas}
            width={mask.width}
            height={mask.height}
            role="img"
            aria-label={title}
            className="fg-interactive-map"
          />
        </div>
      ) : (
        <Notice error={error}>
          {error ? null : "Cargando capa del mapa…"}
        </Notice>
      )}
      {error && (
        <Button
          variant="secondary"
          onClick={() => {
            maskQuery.reload();
            indexQuery.reload();
          }}
        >
          Reintentar mapa
        </Button>
      )}
      {ready && layer && (
        <div
          className="fg-map-legend"
          role="group"
          aria-label="Cómo interpretar los colores"
        >
          <div
            style={{
              background: `linear-gradient(to right, ${indexQuery.details.style.colors.join(",")})`,
            }}
          />
          <div className="fg-map-legend-labels text-sm">
            <span>
              {temporal ? indicator.changeLowLabel : indicator.lowLabel}
            </span>
            <span>{temporal ? "Sin cambio" : "Intermedio"}</span>
            <span>
              {temporal ? indicator.changeHighLabel : indicator.highLabel}
            </span>
          </div>
          <details className="fg-map-numeric-scale">
            <summary>Ver escala numérica</summary>
            <p>
              Escala de color de {indicator.id}:{" "}
              {indexQuery.details.style.minimum.toLocaleString("es-CO")} a{" "}
              {indexQuery.details.style.maximum.toLocaleString("es-CO")}
              {temporal
                ? " (fecha final menos inicial)"
                : " (valor de esta fecha)"}
              . Es un índice, no un porcentaje de superficie. Los valores que
              exceden la escala usan el color del extremo.
            </p>
          </details>
        </div>
      )}
      <Button
        variant="secondary"
        disabled={!ready || exporting}
        onClick={saveView}
      >
        {exporting ? "Exportando…" : "Descargar vista PNG"}
      </Button>
      <Notice error={exportError} />
    </div>
  );
}

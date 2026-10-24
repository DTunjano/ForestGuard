import { useEffect, useRef, useState } from "react";
import {
  LuCheck,
  LuCircleAlert,
  LuFileUp,
  LuLoader,
  LuTrash2,
  LuUpload,
} from "react-icons/lu";
import { deleteImage, uploadImage } from "../api/images";
import { Button, Field, Notice } from "../../../shared/components/UI";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function canonicalBand(description) {
  const text = String(description || "").trim().toUpperCase();
  const match = text.match(/^(B0?[2-5]|B0?8|B11|B12)(?=$|\W)/);
  if (match) {
    return "B" + String(Number.parseInt(match[1].slice(1), 10));
  }
  if (/^SCL(?=$|\W)/.test(text)) {
    return "SCL";
  }
  return text;
}

function inferDateFromFilename(filename) {
  const stem = String(filename || "").replace(/\.[^.]+$/, "");
  const match =
    stem.match(/(?<!\d)(20\d{2})[-_]([01]\d)[-_]([0-3]\d)(?!\d)/) ||
    stem.match(/(?<!\d)(20\d{2})([01]\d)([0-3]\d)T\d{6}(?!\d)/);
  if (!match) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

async function inspectGeoTiffFile(file) {
  const info = {
    inferredDate: inferDateFromFilename(file?.name),
    width: null,
    height: null,
    samplesPerPixel: null,
    bands: [],
  };
  if (!file || typeof file.slice !== "function" || file.size < 8) {
    return info;
  }
  try {
    const headerBuf = await file.slice(0, 16).arrayBuffer();
    const headerView = new DataView(headerBuf);
    const byteOrder = headerView.getUint16(0, false);
    const littleEndian = byteOrder === 0x4949;
    if (!littleEndian && byteOrder !== 0x4d4d) return info;

    const version = headerView.getUint16(2, littleEndian);
    if (version !== 42) return info;

    const ifdOffset = headerView.getUint32(4, littleEndian);
    if (ifdOffset + 2 > file.size) return info;

    const ifdSliceSize = Math.min(65536, file.size - ifdOffset);
    const ifdBuf = await file
      .slice(ifdOffset, ifdOffset + ifdSliceSize)
      .arrayBuffer();
    const ifdView = new DataView(ifdBuf);
    const numEntries = ifdView.getUint16(0, littleEndian);

    let gdalMetaOffset = null;
    let gdalMetaCount = 0;

    for (let i = 0; i < numEntries; i++) {
      const entryOffset = 2 + i * 12;
      if (entryOffset + 12 > ifdBuf.byteLength) break;
      const tag = ifdView.getUint16(entryOffset, littleEndian);
      const type = ifdView.getUint16(entryOffset + 2, littleEndian);
      const count = ifdView.getUint32(entryOffset + 4, littleEndian);
      const value =
        type === 3
          ? ifdView.getUint16(entryOffset + 8, littleEndian)
          : ifdView.getUint32(entryOffset + 8, littleEndian);

      if (tag === 256) info.width = value;
      else if (tag === 257) info.height = value;
      else if (tag === 277) info.samplesPerPixel = value;
      else if (tag === 42112 && count > 0) {
        gdalMetaOffset = ifdView.getUint32(entryOffset + 8, littleEndian);
        gdalMetaCount = Math.min(count, 131072);
      }
    }

    if (
      gdalMetaOffset !== null &&
      gdalMetaOffset + gdalMetaCount <= file.size
    ) {
      const metaBuf = await file
        .slice(gdalMetaOffset, gdalMetaOffset + gdalMetaCount)
        .arrayBuffer();
      const xml = new TextDecoder("utf-8", { fatal: false }).decode(metaBuf);
      const itemRegex = /<Item\b[^>]*>([\s\S]*?)<\/Item>/gi;
      const foundBands = [];
      let m;
      while ((m = itemRegex.exec(xml)) !== null) {
        const tagText = m[0];
        const innerText = m[1].trim();
        if (/name\s*=\s*["']DESCRIPTION["']/i.test(tagText) && innerText) {
          foundBands.push(canonicalBand(innerText));
        } else if (
          !info.inferredDate &&
          /name\s*=\s*["'](acquisition_date|date_acquired|sensing_time|sensing_date)["']/i.test(
            tagText,
          )
        ) {
          const dMatch = innerText.match(
            /^(20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)/,
          );
          if (dMatch) {
            info.inferredDate = `${dMatch[1]}-${dMatch[2]}-${dMatch[3]}`;
          }
        }
      }
      if (foundBands.length > 0) {
        info.bands = foundBands;
      }
    }
  } catch {
    // La validación definitiva ocurre siempre en el servidor
  }
  return info;
}

const stateLabels = {
  pending: "Pendiente",
  uploading: "Cargando y validando…",
  done: "Cargada",
  failed: "Falló",
};

function duplicateDateError(dateStr) {
  return new Error(
    `Carga rechazada: ya existe una imagen con la fecha de adquisición ${dateStr} en esta área de estudio.`,
  );
}

export function UploadImages({
  area,
  existingDates,
  onUploaded,
  onCleared,
  onRemoved,
  onPendingChange,
}) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const enforceUniqueDates = Array.isArray(existingDates);
  const hasUnuploadedItems =
    busy ||
    items.some((i) => i.state === "pending" || i.state === "uploading");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    onPendingChange?.(hasUnuploadedItems);
  }, [hasUnuploadedItems, onPendingChange]);

  function choose(event) {
    const files = Array.from(event.target.files);
    const newFiles = [];
    const areaDateSet = new Set(
      enforceUniqueDates ? existingDates.filter(Boolean) : [],
    );

    setItems((current) => {
      const added = [...current];
      const occupiedDates = new Set(areaDateSet);
      for (const existingItem of added) {
        const d =
          existingItem.image?.acquisition_date ||
          existingItem.preview?.inferredDate;
        if (d && existingItem.state !== "failed") {
          occupiedDates.add(d);
        }
      }

      for (const file of files) {
        if (
          !added.some(
            (item) =>
              item.file.name === file.name &&
              item.file.size === file.size &&
              item.file.lastModified === file.lastModified,
          )
        ) {
          const inferredDate = inferDateFromFilename(file.name);
          const isDuplicate =
            enforceUniqueDates &&
            Boolean(inferredDate) &&
            occupiedDates.has(inferredDate);

          if (inferredDate && !isDuplicate) {
            occupiedDates.add(inferredDate);
          }

          added.push({
            file,
            state: isDuplicate ? "failed" : "pending",
            error: isDuplicate ? duplicateDateError(inferredDate) : null,
            duplicateDateRejected: isDuplicate,
            preview: {
              inferredDate,
              width: null,
              height: null,
              samplesPerPixel: null,
              bands: [],
            },
          });
          newFiles.push(file);
        }
      }
      return added;
    });
    event.target.value = "";

    for (const file of newFiles) {
      inspectGeoTiffFile(file).then((preview) => {
        if (!mounted.current) return;
        setItems((current) => {
          const occupiedDates = new Set(
            enforceUniqueDates ? existingDates.filter(Boolean) : [],
          );
          for (const it of current) {
            if (it.file === file) continue;
            const d = it.image?.acquisition_date || it.preview?.inferredDate;
            if (d && it.state !== "failed") {
              occupiedDates.add(d);
            }
          }
          return current.map((item) => {
            if (item.file !== file) return item;
            const isDuplicate =
              enforceUniqueDates &&
              Boolean(preview.inferredDate) &&
              occupiedDates.has(preview.inferredDate);
            if (isDuplicate && item.state !== "done") {
              return {
                ...item,
                preview,
                state: "failed",
                error: duplicateDateError(preview.inferredDate),
                duplicateDateRejected: true,
              };
            }
            return { ...item, preview };
          });
        });
      });
    }
  }

  async function upload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      const knownDates = new Set(
        enforceUniqueDates ? existingDates.filter(Boolean) : [],
      );
      for (const existing of items) {
        if (existing.state === "done" && existing.image?.acquisition_date) {
          knownDates.add(existing.image.acquisition_date);
        }
      }

      for (const item of items.filter((i) => i.state !== "done")) {
        if (!mounted.current) break;
        const update = (data) =>
          setItems((current) =>
            current.map((i) => (i.file === item.file ? { ...i, ...data } : i)),
          );

        const candidateDate =
          item.preview?.inferredDate || inferDateFromFilename(item.file.name);
        if (
          enforceUniqueDates &&
          candidateDate &&
          knownDates.has(candidateDate)
        ) {
          update({
            state: "failed",
            error: duplicateDateError(candidateDate),
            duplicateDateRejected: true,
          });
          continue;
        }

        update({
          state: "uploading",
          error: null,
          duplicateDateRejected: false,
        });
        try {
          const image = await uploadImage(item.file, area);
          if (!mounted.current) break;

          if (
            enforceUniqueDates &&
            image?.acquisition_date &&
            knownDates.has(image.acquisition_date)
          ) {
            await deleteImage(image.id).catch(() => {});
            if (!mounted.current) break;
            update({
              state: "failed",
              error: duplicateDateError(image.acquisition_date),
              duplicateDateRejected: true,
            });
            continue;
          }

          if (image?.acquisition_date) {
            knownDates.add(image.acquisition_date);
          }
          update({ state: "done", image, duplicateDateRejected: false });
          onUploaded(image);
        } catch (error) {
          if (mounted.current)
            update({ state: "failed", error, duplicateDateRejected: false });
        }
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function clearAll() {
    if (busy || items.length === 0) return;
    const uploadedIds = items
      .map((item) => item.image?.id)
      .filter((id) => id !== undefined && id !== null);
    setItems([]);
    if (enforceUniqueDates && uploadedIds.length > 0) {
      await Promise.allSettled(uploadedIds.map((id) => deleteImage(id)));
    }
    onCleared?.(uploadedIds);
  }

  async function removeItem(targetItem) {
    if (busy) return;
    setItems((current) => current.filter((i) => i !== targetItem));
    if (targetItem.image?.id) {
      if (enforceUniqueDates) {
        await deleteImage(targetItem.image.id).catch(() => {});
      }
      onRemoved?.(targetItem.image.id);
    }
  }

  const pendingCount = items.filter((i) => i.state !== "done").length;
  const doneCount = items.filter((i) => i.state === "done").length;
  const canUpload = !busy && Boolean(area) && pendingCount > 0;
  const canClear = !busy && items.length > 0;

  return (
    <div className="fg-upload-box space-y-4">
      {/* Apartado de validación automática ubicado encima del apartado donde se suben las imágenes */}
      <div className="fg-upload-specs">
        <div className="fg-upload-specs-header">
          <p className="fg-eyebrow">Validación automática en servidor</p>
          <h3>Requisitos técnicos de las escenas</h3>
        </div>
        <div className="fg-upload-spec-grid">
          <div className="fg-upload-spec-card">
            <strong>Bandas requeridas</strong>
            <p>
              B2, B3, B4, B5, B8, B11 y B12 en una sola grilla con sistema de
              referencia (CRS) definido.
            </p>
          </div>
          <div className="fg-upload-spec-card">
            <strong>Banda SCL</strong>
            <p>
              Opcional para índices descriptivos (NDVI, NDMI, NBR, NDRE);
              requerida para el modelo exploratorio v9.
            </p>
          </div>
          <div className="fg-upload-spec-card">
            <strong>Detección de metadatos</strong>
            <p>
              La fecha de adquisición, escala de reflectancia y factor SCL se
              extraen automáticamente al subir.
            </p>
          </div>
        </div>
      </div>

      {/* Selector de archivos a ancho completo */}
      <div className="fg-upload-dropzone">
        <Field
          label="Archivos Sentinel-2 GeoTIFF"
          type="file"
          accept=".tif,.tiff"
          multiple
          disabled={busy || !area}
          onChange={choose}
        />
        <p className="fg-upload-hint">
          Puedes elegir uno o varios archivos <code>.tif</code> /{" "}
          <code>.tiff</code> desde tu equipo para agregarlos a la cola de
          validación.
        </p>
      </div>

      {/* Lista / Cola de transferencia */}
      <div className="fg-upload-queue" aria-live="polite">
        <div className="fg-upload-queue-header">
          <div className="fg-upload-queue-title">
            <span>
              Cola de transferencia ({items.length}{" "}
              {items.length === 1 ? "archivo" : "archivos"})
            </span>
            <small>
              {items.length === 0
                ? "Sin archivos pendientes de envío"
                : `${doneCount} ${doneCount === 1 ? "cargada" : "cargadas"} · ${pendingCount} ${pendingCount === 1 ? "pendiente" : "pendientes"}`}
            </small>
          </div>
          <div className="fg-upload-action-buttons">
            <Button
              type="button"
              variant="clear"
              disabled={!canClear}
              onClick={clearAll}
            >
              <LuTrash2 aria-hidden="true" />
              <span>Eliminar todas las imágenes</span>
            </Button>
            <Button
              type="button"
              variant="upload"
              disabled={!canUpload}
              onClick={upload}
            >
              <LuUpload aria-hidden="true" />
              <span>{busy ? "Cargando…" : "Cargar pendientes"}</span>
            </Button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="fg-upload-empty">
            <LuFileUp size={22} aria-hidden="true" />
            <p>
              No hay archivos nuevos en la cola. Selecciona archivos GeoTIFF
              arriba y pulsa{" "}
              <strong>«Cargar pendientes / reintentar fallidas»</strong>, o
              continúa al siguiente paso si tus escenas ya fueron subidas.
            </p>
          </div>
        ) : (
          <div className="fg-upload-list">
            {items.map((item) => {
              const detectedBands =
                item.image?.band_descriptions?.filter(Boolean) ||
                item.preview?.bands?.filter(Boolean) ||
                [];
              const dateText =
                item.image?.acquisition_date || item.preview?.inferredDate;
              const width = item.image?.width ?? item.preview?.width;
              const height = item.image?.height ?? item.preview?.height;
              const hasScl = item.image
                ? Boolean(item.image.scl_factor)
                : detectedBands.includes("SCL");

              return (
                <div
                  key={`${item.file.name}-${item.file.size}-${item.file.lastModified}`}
                  className={`fg-upload-item fg-upload-item-${item.state}`}
                >
                  <div className="fg-upload-item-top">
                    <div className="min-w-0 flex-1">
                      <p className="fg-upload-filename">{item.file.name}</p>
                      <div className="fg-upload-file-submeta">
                        <span className="fg-upload-filesize">
                          Tamaño:{" "}
                          {formatBytes(item.image?.size_bytes ?? item.file.size)}
                        </span>
                        <span className="fg-upload-filesize">
                          Formato: GeoTIFF
                        </span>
                        {item.file.lastModified && (
                          <span className="fg-upload-filesize">
                            Modificado:{" "}
                            {new Date(item.file.lastModified).toLocaleDateString(
                              "es-CO",
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="fg-upload-item-actions">
                      <span
                        className={`fg-status fg-status-${
                          item.state === "done"
                            ? "completed"
                            : item.state === "failed"
                              ? "failed"
                              : item.state === "uploading"
                                ? "running"
                                : "queued"
                        }`}
                      >
                        {item.state === "done" && (
                          <LuCheck aria-hidden="true" />
                        )}
                        {item.state === "failed" && (
                          <LuCircleAlert aria-hidden="true" />
                        )}
                        {item.state === "uploading" && (
                          <LuLoader aria-hidden="true" />
                        )}
                        {item.state === "pending" && (
                          <LuFileUp aria-hidden="true" />
                        )}
                        {stateLabels[item.state]}
                      </span>
                      <button
                        type="button"
                        disabled={busy}
                        className="fg-upload-remove"
                        onClick={() => removeItem(item)}
                      >
                        <LuTrash2 aria-hidden="true" />
                        Quitar de la selección
                      </button>
                    </div>
                  </div>
                  <Notice error={item.error} />
                  <div className="fg-upload-image-details">
                    <div className="fg-upload-meta">
                      {dateText && <span>Fecha: {dateText}</span>}
                      {width && height && (
                        <span>
                          Dimensiones: {width} × {height} px
                        </span>
                      )}
                      {item.image?.crs && <span>CRS: {item.image.crs}</span>}
                      {item.image?.reflectance_scale && (
                        <span>Escala: {item.image.reflectance_scale}</span>
                      )}
                      {item.image ? (
                        <span>
                          SCL: {item.image.scl_factor ?? "sin banda SCL"}
                        </span>
                      ) : (
                        detectedBands.length > 0 && (
                          <span>
                            SCL: {hasScl ? "presente" : "sin banda SCL"}
                          </span>
                        )
                      )}
                    </div>
                    <div className="fg-upload-bands">
                      <span className="fg-upload-bands-label">
                        {detectedBands.length > 0
                          ? `Bandas encontradas (${detectedBands.length}):`
                          : "Bandas encontradas:"}
                      </span>
                      {detectedBands.length > 0 ? (
                        <div className="fg-upload-bands-list">
                          {detectedBands.map((band, idx) => (
                            <span
                              key={`${band}-${idx}`}
                              className={`fg-upload-band-pill ${band === "SCL" ? "is-scl" : ""}`}
                            >
                              {band}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="fg-upload-bands-empty">
                          Se extraerán al validar el archivo en el servidor
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Barra inferior de acciones de carga */}
        <div className="fg-upload-footer">
          <p className="text-xs text-slate-400">
            Se conservan las cargas válidas aunque otro archivo falle. Si se
            interrumpe la red, verifica la colección antes de reintentar.
          </p>
          <div className="fg-upload-action-buttons">
            <Button
              type="button"
              variant="clear"
              disabled={!canClear}
              onClick={clearAll}
            >
              <LuTrash2 aria-hidden="true" />
              <span>Eliminar todas las imágenes</span>
            </Button>
            <Button
              type="button"
              variant="upload"
              disabled={!canUpload}
              onClick={upload}
            >
              <LuUpload aria-hidden="true" />
              <span>
                {busy
                  ? "Cargando…"
                  : "Cargar pendientes"}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

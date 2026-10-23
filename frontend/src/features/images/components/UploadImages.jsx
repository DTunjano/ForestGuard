import { useEffect, useRef, useState } from "react";
import { uploadImage } from "../api/images";
import { Button, Field, Notice } from "../../../shared/components/UI";
export function UploadImages({ area, onUploaded }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function choose(event) {
    const files = Array.from(event.target.files);
    setItems((current) => {
      const added = [...current];
      for (const file of files)
        if (
          !added.some(
            (item) =>
              item.file.name === file.name &&
              item.file.size === file.size &&
              item.file.lastModified === file.lastModified,
          )
        )
          added.push({ file, state: "pending" });
      return added;
    });
    event.target.value = "";
  }
  async function upload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      for (const item of items.filter((i) => i.state !== "done")) {
        if (!mounted.current) break;
        const update = (data) =>
          setItems((current) =>
            current.map((i) => (i.file === item.file ? { ...i, ...data } : i)),
          );
        update({ state: "uploading", error: null });
        try {
          const image = await uploadImage(item.file, area);
          if (!mounted.current) break;
          update({ state: "done", image });
          onUploaded(image);
        } catch (error) {
          if (mounted.current) update({ state: "failed", error });
        }
      }
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <Field
        label="Archivos Sentinel-2 GeoTIFF"
        type="file"
        accept=".tif,.tiff"
        multiple
        disabled={busy || !area}
        onChange={choose}
      />
      <p className="text-sm text-slate-300">
        La fecha, reflectancia y SCL se detectan en el servidor. Se conservan
        las cargas correctas aunque otra falle. Si se interrumpe la red,
        consulta las imágenes existentes antes de reintentar para evitar
        duplicados. Al salir se detienen los envíos pendientes; el archivo que
        ya se envió puede terminar de guardarse. No se eliminan cargas
        automáticamente.
      </p>
      {items.map((item) => (
        <div
          key={`${item.file.name}-${item.file.size}-${item.file.lastModified}`}
          className="break-all border-b border-white/10 py-2"
        >
          <p>
            {item.file.name} —{" "}
            {
              {
                pending: "Pendiente",
                uploading: "Cargando y validando…",
                done: "Cargada",
                failed: "Falló",
              }[item.state]
            }
          </p>
          <Notice error={item.error} />
          {item.image && (
            <p>
              Fecha: {item.image.acquisition_date} · {item.image.width} ×{" "}
              {item.image.height} · {item.image.crs} · Escala detectada:{" "}
              {item.image.reflectance_scale} · SCL:{" "}
              {item.image.scl_factor ?? "sin banda SCL"}
            </p>
          )}
          {item.state !== "done" && (
            <button
              type="button"
              disabled={busy}
              className="underline"
              onClick={() =>
                setItems((current) => current.filter((i) => i !== item))
              }
            >
              Quitar de la selección
            </button>
          )}
        </div>
      ))}
      <Button
        type="button"
        disabled={busy || !area || !items.some((i) => i.state !== "done")}
        onClick={upload}
      >
        {busy ? "Cargando…" : "Cargar pendientes / reintentar fallidas"}
      </Button>
    </div>
  );
}

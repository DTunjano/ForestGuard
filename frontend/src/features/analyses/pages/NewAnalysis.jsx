import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useCollection } from "../../../shared/api/useCollection";
import { useResource } from "../../../shared/api/useResource";
import {
  Page,
  Panel,
  Field,
  Select,
  Button,
  Notice,
} from "../../../shared/components/UI";
import { AreaForm } from "../../study-areas/components/AreaForm";
import { UploadImages } from "../../images/components/UploadImages";
import { createAnalysis } from "../api/analyses";

export function NewAnalysis() {
  const areas = useCollection("study-areas/?ordering=name");
  const models = useCollection("models/");
  const [area, setArea] = useState("");
  return (
    <Page title="Nuevo análisis">
      <Panel>
        <Field label="Área de estudio">
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">Selecciona un área</option>
            {areas.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <Notice error={areas.error} />
        <details>
          <summary className="cursor-pointer">Crear un área de estudio</summary>
          <AreaForm
            onCreated={(item) => {
              areas.reload();
              setArea(String(item.id));
            }}
          />
        </details>
      </Panel>
      {area && <AreaAnalysis key={area} area={area} models={models} />}
    </Page>
  );
}
function AreaAnalysis({ area, models }) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const images = useResource(
    `images/?study_area=${area}&page=${page}&ordering=-acquisition_date`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lock = useRef(false);
  const navigate = useNavigate();
  function toggle(image) {
    setSelected((rows) =>
      rows.some((row) => row.id === image.id)
        ? rows.filter((row) => row.id !== image.id)
        : [...rows, image],
    );
  }
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (
        new Set(selected.map((i) => i.acquisition_date)).size !==
        selected.length
      )
        throw new Error(
          "Selecciona una imagen por fecha. Se admiten varias fechas del mismo año.",
        );
      const analysis = await createAnalysis({
        name: values.name,
        description: values.description,
        study_area: Number(area),
        image_ids: selected.map((i) => i.id),
        ...(selected.length > 1 && values.model_id
          ? { model_id: Number(values.model_id) }
          : {}),
      });
      navigate(`/dashboard/results/${analysis.id}`);
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Panel>
        <h2 className="text-xl">1. Cargar imágenes</h2>
        <UploadImages
          area={area}
          onUploaded={(image) => {
            images.reload();
            setSelected((rows) =>
              rows.length < 32 && !rows.some((i) => i.id === image.id)
                ? [...rows, image]
                : rows,
            );
          }}
        />
      </Panel>
      <Panel>
        <h2 className="text-xl">2. Seleccionar imágenes del área</h2>
        <p>
          Seleccionadas: {selected.length} / 32. Una fecha genera índices;
          varias fechas generan comparaciones. La cobertura válida exacta
          aparece en los resultados.
        </p>
        <Notice error={images.error}>
          {images.loading ? "Cargando imágenes…" : null}
        </Notice>
        {images.data?.count === 0 && <p>Aún no hay imágenes en esta área.</p>}
        {images.data?.results.map((image) => (
          <label
            key={image.id}
            className="flex items-start gap-3 border-b border-white/10 py-3"
          >
            <input
              type="checkbox"
              checked={selected.some((i) => i.id === image.id)}
              disabled={
                busy ||
                (selected.length >= 32 &&
                  !selected.some((i) => i.id === image.id))
              }
              onChange={() => toggle(image)}
            />
            <span className="break-all">
              {image.acquisition_date} · {image.name}
              <small className="block">
                {image.width} × {image.height} · {image.crs} ·{" "}
                {image.scl_factor ? "SCL disponible" : "Sin SCL"}
              </small>
            </span>
          </label>
        ))}
        <div className="flex gap-3">
          <Button
            disabled={!images.data?.previous}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            disabled={!images.data?.next}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
        <p>
          Fechas elegidas:{" "}
          {selected
            .map((i) => i.acquisition_date)
            .sort()
            .join(", ") || "ninguna"}
        </p>
        <Button onClick={() => setSelected([])} disabled={busy}>
          Limpiar selección
        </Button>
      </Panel>
      <Panel>
        <h2 className="text-xl">3. Solicitar análisis</h2>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="Nombre del análisis"
            name="name"
            required
            maxLength={160}
          />
          <Field label="Descripción" name="description" />
          {selected.length > 1 ? (
            <>
              <Field label="Clasificación opcional">
                <Select
                  name="model_id"
                  defaultValue=""
                  disabled={!selected.every((i) => i.scl_factor)}
                >
                  <option value="">Solo índices y comparación espectral</option>
                  {models.data?.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · {model.version}
                    </option>
                  ))}
                </Select>
              </Field>
              <p>
                v9 requiere SCL y se aplica únicamente a intervalos compatibles
                (35–330 días). Una clasificación omitida no significa ausencia
                de cambios.
              </p>
              <Notice error={models.error} />
            </>
          ) : (
            <p>
              Para una imagen se calculan NDVI, NDMI, NBR y NDRE sin modelo v9.
            </p>
          )}
          <Notice error={error} />
          <Button disabled={busy || !selected.length || selected.length > 32}>
            {busy ? "Solicitando…" : "Crear análisis"}
          </Button>
        </form>
        <p className="text-sm text-slate-300">
          El worker debe estar activo. Puedes consultar el trabajo después desde
          el historial. Los índices no confirman por sí solos deforestación.
        </p>
      </Panel>
    </>
  );
}

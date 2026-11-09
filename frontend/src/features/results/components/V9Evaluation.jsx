import { useEffect, useRef, useState } from "react";
import { LuFileCheck2 } from "react-icons/lu";
import { request } from "../../../shared/api/client";
import { useResource } from "../../../shared/api/useResource";
import {
  Button,
  Field,
  Notice,
  Panel,
  Select,
} from "../../../shared/components/UI";
import { ResultDownload } from "./ResultDownload";
import { V9EvaluationMetrics } from "./JaccardMetrics";

function ReferenceForm({ prediction, canEvaluate }) {
  const url = prediction.v9_evaluation_url;
  const query = useResource(url);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const evaluation = saved || query.data?.evaluation;
  const headingRef = useRef(null);
  useEffect(() => {
    if (saved) headingRef.current?.focus();
  }, [saved]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    setBusy(true);
    setError(null);
    try {
      const result = await request(url, {
        method: "POST",
        body: new FormData(form),
      });
      form.reset();
      const disclosure = form.closest("details");
      if (disclosure) disclosure.open = false;
      setSaved(result.evaluation);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const uploadForm = (
    <form
      onSubmit={submit}
      className="space-y-4 border-t border-white/15 pt-4"
      aria-busy={busy}
    >
      {!evaluation && <h3>Cargar referencia verificada</h3>}
      <div className="space-y-2">
        <p>
          <strong>Archivo para descargar.</strong> La predicción de v9 te sirve
          de plantilla para consultar la cuadrícula y preparar una referencia
          alineada.
        </p>
        <p>
          <strong>Archivo para cargar.</strong> Una máscara de referencia con
          etiquetas independientes, obtenidas de una fuente verificada para esta
          zona y periodo. Comparar la predicción consigo misma solo mide su
          coincidencia con una copia.
        </p>
        <p>
          La máscara debe ser un GeoTIFF de una banda Byte con la misma
          cuadrícula que la predicción. Usa <strong>0</strong> para sin pérdida,{" "}
          <strong>1</strong> para pérdida y <strong>255</strong> para sin
          etiqueta. Tamaño máximo: 64 MB y 25 millones de píxeles.
        </p>
      </div>
      <ResultDownload artifact={prediction}>
        Descargar predicción GeoTIFF
      </ResultDownload>
      <fieldset disabled={busy} className="space-y-4">
        <Field label="Máscara de referencia GeoTIFF">
          <input
            className="w-full rounded-lg"
            type="file"
            name="reference"
            accept=".tif,.tiff"
            required
          />
        </Field>
        <Field
          label="Fuente de las etiquetas"
          name="reference_source"
          maxLength={300}
          placeholder="Ej. Inventario verificado o revisión de campo"
          required
        />
        <label className="flex items-start gap-3">
          <input
            name="independent_reference"
            type="checkbox"
            value="true"
            data-required-message="Confirma que las etiquetas corresponden a la zona y al periodo y son independientes de v9."
            required
          />
          <span>
            Confirmo que las etiquetas corresponden a esta zona y periodo y se
            obtuvieron de forma independiente del entrenamiento y ajuste de v9.
          </span>
        </label>
      </fieldset>
      {evaluation && (
        <p>
          Al guardar una referencia válida, se reemplaza la evaluación anterior
          de este intervalo.
        </p>
      )}
      <Button type="submit" disabled={busy}>
        <LuFileCheck2 aria-hidden="true" />
        {busy
          ? "Comparando máscaras…"
          : evaluation
            ? "Reemplazar evaluación"
            : "Calcular y guardar evaluación"}
      </Button>
      <Notice error={error} />
    </form>
  );

  return (
    <>
      <Notice error={query.error}>
        {query.loading ? "Consultando la evaluación guardada…" : null}
      </Notice>
      {query.error && (
        <Button onClick={query.reload}>Reintentar consulta</Button>
      )}
      {evaluation && (
        <V9EvaluationMetrics evaluation={evaluation} headingRef={headingRef} />
      )}
      {saved && <p role="status">Evaluación guardada.</p>}
      {canEvaluate &&
        query.data &&
        (evaluation ? (
          <details className="space-y-3">
            <summary className="cursor-pointer font-semibold">
              Actualizar la evaluación
            </summary>
            {uploadForm}
          </details>
        ) : (
          uploadForm
        ))}
      {!canEvaluate && query.data && !evaluation && (
        <p>Este intervalo todavía no tiene una evaluación guardada.</p>
      )}
    </>
  );
}

export function V9Evaluation({ predictions, canEvaluate }) {
  const [id, setId] = useState("");
  const prediction =
    predictions.find((item) => String(item.id) === id) || predictions.at(-1);
  return (
    <Panel>
      <p className="fg-eyebrow">Validación por intervalo</p>
      <h2>Evaluación del modelo v9</h2>
      <p>
        Contrasta la predicción de pérdida de cobertura con etiquetas
        verificadas del mismo territorio y periodo. La evaluación usa los
        píxeles válidos y etiquetados de ambas capas.
      </p>
      <Field label="Intervalo de la predicción">
        <Select
          value={String(prediction.id)}
          onChange={(event) => setId(event.target.value)}
        >
          {predictions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.relative_path.split("/")[1].replace("_", " a ")}
            </option>
          ))}
        </Select>
      </Field>
      <ReferenceForm
        key={prediction.id}
        prediction={prediction}
        canEvaluate={canEvaluate}
      />
    </Panel>
  );
}

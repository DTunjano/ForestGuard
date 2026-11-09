import { useEffect, useRef, useState } from "react";
import { LuFileCheck2, LuX } from "react-icons/lu";
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
import { IdeamEvaluation } from "./IdeamEvaluation";

function ReferenceForm({ prediction, canEvaluate }) {
  const url = prediction.v9_evaluation_url;
  const query = useResource(url);
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [hasFile, setHasFile] = useState(false);
  const evaluation = saved || query.data?.evaluation;
  const automatic = query.data?.ideam;
  const headingRef = useRef(null);
  const fileInput = useRef(null);
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
      setHasFile(false);
      const disclosure = form.closest("details[data-manual-replace]");
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
      <p>
        Carga una máscara independiente y verificada sobre la cuadrícula de la
        predicción. GeoTIFF Byte de una banda, con 0 para sin pérdida, 1 para
        pérdida y 255 para sin etiqueta. Máximo 64 MB y 25 millones de píxeles.
      </p>
      <ResultDownload artifact={prediction}>
        Descargar predicción GeoTIFF
      </ResultDownload>
      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <Field label="Máscara de referencia GeoTIFF">
            <input
              ref={fileInput}
              className="w-full min-w-0 rounded-lg"
              type="file"
              name="reference"
              accept=".tif,.tiff"
              required
              onChange={(event) =>
                setHasFile(event.currentTarget.files.length > 0)
              }
            />
          </Field>
          {hasFile && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                fileInput.current.value = "";
                setHasFile(false);
                setError(null);
                fileInput.current.focus();
              }}
            >
              <LuX aria-hidden="true" /> Quitar archivo
            </Button>
          )}
        </div>
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
            Confirmo que las etiquetas son independientes de v9 y corresponden a
            esta zona y periodo.
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

  const manualEvaluation = (
    <>
      {evaluation && (
        <V9EvaluationMetrics evaluation={evaluation} headingRef={headingRef} />
      )}
      {saved && (
        <p role="status" className="sr-only">
          Evaluación guardada.
        </p>
      )}
      {canEvaluate &&
        query.data &&
        (evaluation ? (
          <details data-manual-replace className="space-y-3">
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

  return (
    <>
      <Notice error={query.error}>
        {query.loading ? "Consultando la evaluación guardada…" : null}
      </Notice>
      {query.error && (
        <Button onClick={query.reload}>Reintentar consulta</Button>
      )}
      {automatic && (
        <IdeamEvaluation
          url={url}
          reference={automatic}
          canEvaluate={canEvaluate}
        />
      )}
      {automatic ? (
        <details className="space-y-4 border-t border-white/15 pt-4">
          <summary className="cursor-pointer font-semibold">
            Evaluación con referencia propia
          </summary>
          {manualEvaluation}
        </details>
      ) : (
        manualEvaluation
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
      <h2>Evaluación del modelo v9</h2>
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

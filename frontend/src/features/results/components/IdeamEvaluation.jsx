import { useEffect, useRef, useState } from "react";
import { LuLayers } from "react-icons/lu";
import { request } from "../../../shared/api/client";
import { Button, Notice } from "../../../shared/components/UI";
import { V9EvaluationMetrics } from "./JaccardMetrics";

export function IdeamEvaluation({ url, reference, canEvaluate }) {
  const [saved, setSaved] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const headingRef = useRef(null);
  const evaluation = saved || reference.evaluation;

  useEffect(() => {
    if (saved) headingRef.current?.focus();
  }, [saved]);

  async function calculate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await request(`${url}ideam/`, { method: "POST" });
      setSaved(response.ideam.evaluation);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Evaluación automática con IDEAM">
      {!evaluation && <h3>Evaluación con IDEAM</h3>}
      {!reference.available && <Notice>{reference.reason}</Notice>}
      {evaluation && (
        <V9EvaluationMetrics
          evaluation={evaluation}
          headingRef={headingRef}
          official
          method={`Años completos evaluados: ${reference.complete_years.join(", ")}. Se excluyen los cambios de años parciales. Resolución de la referencia: aproximadamente 30 m.`}
        />
      )}
      {saved && (
        <p role="status" className="sr-only">
          Evaluación con IDEAM guardada.
        </p>
      )}
      {canEvaluate && reference.available && (
        <Button
          type="button"
          variant={evaluation ? "secondary" : "primary"}
          disabled={busy}
          aria-busy={busy}
          onClick={calculate}
        >
          <LuLayers aria-hidden="true" />
          {busy
            ? "Comparando con IDEAM…"
            : evaluation
              ? "Recalcular con IDEAM"
              : "Evaluar con IDEAM"}
        </Button>
      )}
      <Notice error={error} />
    </section>
  );
}

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
      <h3>Evaluación automática con IDEAM</h3>
      {reference.available && (
        <>
          <p>
            ForestGuard alinea las capas oficiales de{" "}
            {reference.years.join(", ")}. Cuenta las pérdidas registradas en los
            años completos del intervalo ({reference.complete_years.join(", ")})
            y excluye los cambios de años parciales.
          </p>
          <p className="text-sm text-slate-300">
            El resultado mide concordancia con mapas anuales fuera de las zonas
            supervisadas registradas. Alinear las capas a la cuadrícula de v9
            conserva el detalle de la fuente IDEAM, de aproximadamente 30
            metros.
          </p>
        </>
      )}
      {!reference.available && <Notice>{reference.reason}</Notice>}
      {evaluation && (
        <V9EvaluationMetrics
          evaluation={evaluation}
          headingRef={headingRef}
          official
        />
      )}
      {evaluation &&
        evaluation.metrics.verdaderos_positivos +
          evaluation.metrics.falsos_negativos ===
          0 && (
          <Notice>
            IDEAM no registró pérdidas en los píxeles comparados. En este
            intervalo se pueden observar discrepancias de v9, pero la
            sensibilidad para detectar pérdidas queda sin evaluar.
          </Notice>
        )}
      {saved && <p role="status">Evaluación con IDEAM guardada.</p>}
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

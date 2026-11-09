const formatter = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });
const number = (value) => formatter.format(value);
const percentage = (value) =>
  value == null ? "No evaluable" : `${number(value * 100)} %`;
const area = (value) =>
  value == null ? "No disponible" : `${number(value)} ha`;

function Metric({ label, value, children }) {
  return (
    <div className="fg-metric-kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{children}</small>
    </div>
  );
}

export function VegetationOverlap({ overlap }) {
  return (
    <section
      className="space-y-3"
      aria-label="Coincidencia de vegetación entre fechas"
    >
      <h3>Coincidencia de vegetación de vigor alto</h3>
      <p>
        Compara la ubicación de los píxeles con NDVI ≥{" "}
        {number(overlap.umbral_ndvi)} en cada fecha, dentro del área válida
        común.
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        <Metric
          label="Superposición · Jaccard"
          value={percentage(overlap.jaccard)}
        >
          {overlap.jaccard == null
            ? "Ninguna fecha tiene píxeles de vigor alto en el área válida común."
            : `${number(overlap.pixeles_interseccion)} de ${number(overlap.pixeles_union)} píxeles coinciden`}
        </Metric>
        <Metric
          label="Salió de la categoría"
          value={area(overlap.area_salida_ha)}
        >
          Vigor alto solo al inicio ·{" "}
          {number(overlap.pixeles_solo_fecha_inicial)} píxeles
        </Metric>
        <Metric
          label="Entró en la categoría"
          value={area(overlap.area_entrada_ha)}
        >
          Vigor alto solo al final · {number(overlap.pixeles_solo_fecha_final)}{" "}
          píxeles
        </Metric>
      </div>
    </section>
  );
}

export function V9EvaluationMetrics({
  evaluation,
  headingRef,
  official = false,
}) {
  const { metrics } = evaluation;
  return (
    <section
      className="space-y-4"
      aria-label="Resultado guardado de la evaluación v9"
    >
      <h3 ref={headingRef} tabIndex={-1} className="scroll-mt-6">
        Resultado de la evaluación
      </h3>
      <p className="break-words">
        Referencia: <strong>{evaluation.reference_name}</strong> ·{" "}
        {evaluation.reference_source}
        {" · "}
        {new Date(evaluation.evaluated_at).toLocaleString("es-CO")}
      </p>
      <div className="grid gap-3 lg:grid-cols-3">
        <Metric label="Jaccard (IoU)" value={percentage(metrics.jaccard)}>
          Superposición entre las zonas de pérdida de v9 y las de la referencia
        </Metric>
        <Metric label="Precisión" value={percentage(metrics.precision)}>
          Proporción de los positivos de v9 que coinciden con la referencia
        </Metric>
        <Metric label="Sensibilidad" value={percentage(metrics.sensibilidad)}>
          Proporción de los positivos de referencia que detectó v9
        </Metric>
      </div>
      {metrics.jaccard == null && (
        <p>
          Ambas máscaras carecen de positivos en la zona evaluada. Jaccard queda
          indeterminado.
        </p>
      )}
      <p>
        Se evaluaron <strong>{number(metrics.pixeles_evaluados)}</strong> de{" "}
        {number(metrics.pixeles_prediccion_validos)} píxeles válidos de la
        predicción (
        {percentage(
          metrics.pixeles_evaluados / metrics.pixeles_prediccion_validos,
        )}
        ). El resultado describe este intervalo y la superficie etiquetada.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["verdaderos_positivos", "Pérdidas coincidentes"],
          [
            "falsos_positivos",
            official
              ? "Positivos de v9 sin pérdida en IDEAM"
              : "Falsas alarmas",
          ],
          [
            "falsos_negativos",
            official
              ? "Pérdidas de IDEAM omitidas por v9"
              : "Pérdidas omitidas",
          ],
          ["verdaderos_negativos", "Sin pérdida en ambos"],
        ].map(([key, label]) => (
          <div className="fg-metric-kpi-card" key={key}>
            <dt>{label}</dt>
            <dd>
              <strong>{number(metrics[key])}</strong>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

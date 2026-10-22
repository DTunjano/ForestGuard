import { Panel } from "../../../shared/components/UI";
const number = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("es-CO", { maximumFractionDigits: 4 })
    : "No disponible";
function Statistics({ values }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {[
              "Índice",
              "Media",
              "p10",
              "Mediana",
              "p90",
              "Píxeles válidos",
            ].map((label) => (
              <th className="p-2" key={label}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(values || {}).map(([name, stats]) => (
            <tr key={name} className="border-t border-white/10">
              <th className="p-2">{name}</th>
              {["media", "p10", "mediana", "p90", "pixeles_validos"].map(
                (key) => (
                  <td className="p-2" key={key}>
                    {number(stats[key])}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Metrics({ summary }) {
  return (
    <div className="space-y-4">
      <p>
        p10–p90 abarca aproximadamente el 80 % central de los valores de píxeles
        válidos. No es un intervalo de confianza ni una medida de exactitud.
      </p>
      {(summary.escenas || []).map((scene) => (
        <Panel key={scene.fecha}>
          <h3 className="text-xl">Fecha {scene.fecha}</h3>
          <p>
            Área observada: {number(scene.area_observada_ha_aprox)} ha · Píxeles
            válidos: {number(scene.pixeles_validos)} /{" "}
            {number(scene.pixeles_totales)} · Cobertura válida:{" "}
            {number(
              typeof scene.fraccion_valida === "number"
                ? scene.fraccion_valida * 100
                : null,
            )}{" "}
            %
          </p>
          <Statistics values={scene.indices} />
        </Panel>
      ))}
      {(summary.intervalos || []).map((interval) => (
        <Panel key={`${interval.fecha_inicial}_${interval.fecha_final}`}>
          <h3 className="text-xl">
            {interval.fecha_inicial} → {interval.fecha_final}
          </h3>
          <p>
            {interval.dias} días · Área común:{" "}
            {number(interval.area_comun_ha_aprox)} ha · Píxeles comunes:{" "}
            {number(interval.pixeles_comunes)}
          </p>
          <Statistics values={interval.diferencias} />
          <p>
            Cambios = fecha final menos inicial. Rojo: descenso; azul: aumento.
          </p>
          <p>
            Área con indicios espectrales:{" "}
            {number(interval.degradacion_observada?.area_con_indicios_ha_aprox)}{" "}
            ha.
          </p>
          <p>
            Clasificación: {interval.estado_clasificacion || "No informada"}.{" "}
            {interval.degradacion_observada?.interpretacion}
          </p>
          {interval.motivo_omision && (
            <p>Motivo de omisión: {interval.motivo_omision}</p>
          )}
          {interval.superficie && (
            <p>
              Superficie clase 1 exploratoria:{" "}
              {number(interval.superficie.area_clase_1_ha_aprox)} ha.
            </p>
          )}
        </Panel>
      ))}
      {!summary.escenas?.length && (
        <p>No se publicaron métricas de escenas para este análisis.</p>
      )}
    </div>
  );
}

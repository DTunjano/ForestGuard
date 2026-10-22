import { Link } from "react-router";
import { useResource } from "../../../shared/api/useResource";
import { Page, Panel, Notice } from "../../../shared/components/UI";
import { statusLabel } from "../utils/status";
export function Dashboard() {
  const analyses = useResource("analyses/?ordering=-created_at");
  const areas = useResource("study-areas/");
  const images = useResource("images/");
  return (
    <Page title="ForestGuard · Panel de trabajo">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Áreas", areas],
          ["Imágenes", images],
          ["Análisis", analyses],
        ].map(([label, query]) => (
          <Panel key={label}>
            <h2>{label}</h2>
            <Notice error={query.error}>
              {query.loading ? "Consultando…" : null}
            </Notice>
            <p className="text-3xl">{query.data?.count ?? "—"}</p>
          </Panel>
        ))}
      </div>
      <div className="flex flex-wrap gap-4">
        <Link className="text-[#b9e75c] underline" to="/dashboard/new">
          Nuevo análisis
        </Link>
        <Link className="underline" to="/dashboard/history">
          Historial completo
        </Link>
      </div>
      <Panel>
        <h2>Análisis recientes</h2>
        {analyses.data?.results.slice(0, 5).map((item) => (
          <Link
            key={item.id}
            className="block border-b border-white/10 py-3"
            to={`/dashboard/results/${item.id}`}
          >
            {item.name} · {statusLabel(item.status)}
          </Link>
        ))}
        {analyses.data?.count === 0 && (
          <p>
            Tu cuenta aún no tiene análisis. Empieza creando un área y cargando
            un GeoTIFF.
          </p>
        )}
      </Panel>
      <p>
        Los totales corresponden a tu cuenta. No se calcula una superficie total
        sumando fechas superpuestas.
      </p>
    </Page>
  );
}

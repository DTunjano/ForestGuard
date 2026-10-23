import { Link } from "react-router";
import {
  LuMapPin,
  LuSatellite,
  LuScanLine,
  LuArrowUpRight,
  LuPlus,
} from "react-icons/lu";
import { useResource } from "../../../shared/api/useResource";
import {
  Page,
  Panel,
  Notice,
  StatusBadge,
  EmptyState,
  SectionHeading,
} from "../../../shared/components/UI";
import { statusLabel } from "../utils/status";
export function Dashboard() {
  const analyses = useResource("analyses/?ordering=-created_at");
  const areas = useResource("study-areas/");
  const images = useResource("images/");
  return (
    <Page title="ForestGuard · Panel de trabajo">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="fg-eyebrow">Tu territorio, en perspectiva</p>
          <p className="mt-2 text-slate-400">
            Continúa explorando los cambios de tus áreas de estudio.
          </p>
        </div>
        <Link
          className="fg-button rounded-xl bg-[#b9e75c] px-5 text-[#10261d]"
          to="/dashboard/new"
        >
          <LuPlus />
          Nuevo análisis
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          ["Áreas", areas, LuMapPin, "Territorios de estudio"],
          ["Imágenes", images, LuSatellite, "Escenas de tu colección"],
          ["Análisis", analyses, LuScanLine, "Estudios registrados"],
        ].map(([label, query, Icon, note]) => (
          <Panel key={label}>
            <div className="fg-stat">
              <div className="flex items-center justify-between">
                <h2>{label}</h2>
                <Icon size={22} />
              </div>
              <strong>{query.data?.count ?? "—"}</strong>
              <small>{note}</small>
              <Notice error={query.error}>
                {query.loading ? "Consultando…" : null}
              </Notice>
            </div>
          </Panel>
        ))}
      </div>
      <SectionHeading eyebrow="Actividad reciente" title="Análisis recientes">
        <Link to="/dashboard/history">Historial completo</Link>
      </SectionHeading>
      <Notice error={analyses.error} />
      <div className="fg-activity">
        {analyses.data?.results.slice(0, 5).map((item) => (
          <Link key={item.id} to={`/dashboard/results/${item.id}`}>
            <div className="flex justify-between">
              <StatusBadge status={item.status}>
                {statusLabel(item.status)}
              </StatusBadge>
              <LuArrowUpRight />
            </div>
            <h3>{item.name}</h3>
            <p>
              {item.images.length} escenas ·{" "}
              {new Date(item.created_at).toLocaleDateString("es-CO")}
            </p>
            <p className="mt-3 border-t border-white/10 pt-3">
              {item.images.map((i) => i.date).join(" → ")}
            </p>
          </Link>
        ))}
      </div>
      {analyses.data?.count === 0 && (
        <EmptyState title="Tu próximo descubrimiento empieza aquí">
          Tu cuenta aún no tiene análisis. Empieza creando un área y cargando un
          GeoTIFF.
        </EmptyState>
      )}
      <p className="text-xs text-slate-400">
        Los totales corresponden a tu cuenta. No se suman superficies de fechas
        superpuestas.
      </p>
    </Page>
  );
}

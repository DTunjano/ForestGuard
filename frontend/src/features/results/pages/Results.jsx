import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  LuArrowLeft,
  LuCalendarDays,
  LuLayers,
  LuPlus,
  LuSatellite,
} from "react-icons/lu";
import { useResource } from "../../../shared/api/useResource";
import {
  Page,
  Panel,
  Button,
  Notice,
  StatusBadge,
} from "../../../shared/components/UI";
import { statusLabel } from "../../analyses/utils/status";
import { SatelliteProcessingCard } from "../../analyses/components/SatelliteProcessingCard";
import { CompletedResults } from "../components/CompletedResults";

export function Results() {
  const { id } = useParams();
  const location = useLocation();
  const query = useResource(`analyses/${id}/`, { poll: true });

  return (
    <Page title={query.data?.name || "Resultados del análisis"}>
      <div className="fg-res-topbar">
        <Link className="fg-res-back-btn" to="/dashboard/history">
          <LuArrowLeft size={16} aria-hidden="true" />
          <span>Volver al historial</span>
        </Link>
        <Link className="fg-res-new-btn" to="/dashboard/new">
          <LuPlus size={15} aria-hidden="true" />
          <span>Nuevo análisis</span>
        </Link>
      </div>

      <Notice error={query.error}>
        {query.loading ? "Consultando análisis…" : null}
      </Notice>
      {query.error && (
        <Button onClick={query.reload}>Reintentar consulta</Button>
      )}

      {query.data && (
        <AnalysisResultContent
          key={id}
          id={id}
          data={query.data}
          fromCreate={Boolean(location.state?.fromCreate)}
        />
      )}
    </Page>
  );
}

function AnalysisResultContent({ id, data }) {
  const navigate = useNavigate();

  const isFailed = data.status === "failed";
  const showProcessingBar = ["queued", "running"].includes(data.status);
  const effectiveStatus = data.status;

  return (
    <>
      <Panel>
        <div className="fg-res-executive-header">
          <div className="fg-res-executive-top">
            <div className="fg-res-status-block">
              <span className="fg-eyebrow">
                <LuSatellite aria-hidden="true" /> Estudio satelital #{id}
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <p role="status" className="fg-res-status-text">
                  Estado: {statusLabel(effectiveStatus)}
                </p>
                <span className="fg-res-mode-pill">
                  {data.images.length > 1
                    ? `Serie multitemporal (${data.images.length} fechas)`
                    : "Diagnóstico de 1 fecha"}
                </span>
              </div>
            </div>

            <ol className="fg-processing" aria-label="Etapas del análisis">
              {[
                ["queued", "En cola"],
                ["running", "Procesando"],
                ["completed", "Resultados"],
              ].map(([state, label]) => (
                <li
                  key={state}
                  aria-current={effectiveStatus === state ? "step" : undefined}
                >
                  <StatusBadge
                    status={effectiveStatus === state ? state : undefined}
                  >
                    {label}
                  </StatusBadge>
                </li>
              ))}
            </ol>
          </div>

          <div className="fg-res-meta-grid">
            <div className="fg-res-meta-item">
              <span className="fg-res-meta-icon" aria-hidden="true">
                <LuCalendarDays size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <small>Secuencia temporal analizada</small>
                <p className="fg-res-dates-line">
                  Fechas: {data.images.map((image) => image.date).join(", ")}
                </p>
              </div>
            </div>

            <div className="fg-res-meta-item">
              <span className="fg-res-meta-icon" aria-hidden="true">
                <LuLayers size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <small>Cobertura de escenas</small>
                <strong>
                  {data.images.length}{" "}
                  {data.images.length === 1
                    ? "escena Sentinel-2 procesada"
                    : "escenas Sentinel-2 procesadas"}
                </strong>
              </div>
            </div>
          </div>

          {data.description && (
            <p className="fg-res-description-note">{data.description}</p>
          )}

          {showProcessingBar && (
            <>
              <SatelliteProcessingCard
                status={data.status}
                scenesCount={data.images?.length || 1}
                cancelLabel="Volver al historial"
                onCancel={() => navigate("/dashboard/history")}
              />
              <p className="text-center text-xs text-slate-400">
                Actualización automática activa. Puedes salir y retomar el
                estudio en cualquier momento desde el historial.
              </p>
            </>
          )}

          {isFailed && (
            <Notice
              error={
                data.error_message ||
                "El procesamiento falló. Revisa las imágenes y el worker."
              }
            />
          )}
        </div>
      </Panel>

      {data.status === "completed" && (
        <CompletedResults key={id} id={id} summary={data.summary} />
      )}
    </>
  );
}

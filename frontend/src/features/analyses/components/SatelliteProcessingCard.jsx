import { useEffect, useState } from "react";
import { LuCheck, LuCircleAlert, LuFileCheck2, LuLoader } from "react-icons/lu";

function formatDuration(totalSeconds) {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const hours = String(Math.floor(safe / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function SatelliteProcessingCard({
  status = "submitting",
  scenesCount = 1,
  onComplete,
  onCancel,
  cancelLabel = "Cancelar",
}) {
  const isFailed = status === "failed";
  const targetSeconds = Math.max(8, Math.min(32, 4 + scenesCount * 4));
  const [percent, setPercent] = useState(2);

  const isFullyDone = status === "completed" && percent >= 100;
  const isLive = !isFullyDone && !isFailed;

  useEffect(() => {
    if (isFailed) return undefined;

    const tickMs = 120;
    const runningStep = Math.max(0.8, 92 / ((targetSeconds * 1000) / tickMs));

    const timer = window.setInterval(() => {
      setPercent((prev) => {
        if (status === "completed") {
          return Math.min(100, prev + 6);
        }
        if (status === "submitting") {
          return Math.min(22, prev + 2.5);
        }
        if (prev < 95) {
          return Math.min(95, Number((prev + runningStep).toFixed(2)));
        }
        return prev;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [status, isFailed, targetSeconds]);

  useEffect(() => {
    if (status === "completed" && percent >= 100 && onComplete) {
      const doneTimer = window.setTimeout(() => {
        onComplete();
      }, 450);
      return () => window.clearTimeout(doneTimer);
    }
    return undefined;
  }, [status, percent, onComplete]);

  const displayPercent = isFailed ? 100 : Math.min(100, Math.round(percent));

  const remainingSeconds = isFullyDone
    ? 0
    : status === "completed"
      ? Math.max(1, Math.ceil(((100 - displayPercent) / 50) * 1.2))
      : Math.max(1, Math.ceil(((100 - displayPercent) / 100) * targetSeconds));

  const getStageState = (startThreshold, endThreshold) => {
    if (isFullyDone) return "completed";
    if (isFailed) {
      if (displayPercent >= endThreshold) return "completed";
      if (displayPercent >= startThreshold) return "failed";
      return "pending";
    }
    if (displayPercent >= endThreshold) return "completed";
    if (displayPercent >= startThreshold) return "active";
    return "pending";
  };

  const stages = [
    {
      key: "load",
      title: "Cargando imagen",
      state: getStageState(0, 25),
    },
    {
      key: "preprocess",
      title: "Preprocesando",
      state: getStageState(25, 52),
    },
    {
      key: "model",
      title: "Ejecutando modelo",
      state: getStageState(52, 80),
    },
    {
      key: "results",
      title: "Generando resultados",
      state: getStageState(80, 100),
    },
  ];

  const statusTextForStage = (stageState) => {
    if (stageState === "completed") return "Completado";
    if (stageState === "active") return "En progreso";
    if (stageState === "failed") return "Detenido";
    return "Pendiente";
  };

  return (
    <div
      className={`fg-sat-processing-card ${isLive ? "is-live" : ""} ${isFailed ? "is-failed" : ""}`}
      aria-live="polite"
    >
      <div className="fg-sat-processing-header">
        <span className="fg-sat-processing-pill">
          {isFullyDone
            ? "Procesamiento finalizado"
            : isFailed
              ? "Ejecución interrumpida"
              : "Motor satelital en ejecución"}
        </span>
        <h4>
          {isFullyDone
            ? "Imagen satelital procesada"
            : isFailed
              ? "Error al procesar la imagen satelital"
              : "Procesando imagen satelital"}
        </h4>
        <p>
          {isFullyDone
            ? "El modelo finalizó el cálculo de índices y artefactos del territorio seleccionado."
            : isFailed
              ? "Ocurrió un inconveniente durante la ejecución del pipeline sobre las escenas seleccionadas."
              : "Por favor espera mientras nuestro modelo analiza la zona seleccionada"}
        </p>
      </div>

      {/* Stepper horizontal de 4 etapas con círculos e iconos */}
      <ol
        className="fg-sat-stepper"
        aria-label="Etapas del procesamiento satelital"
      >
        {stages.map((stage, index) => {
          const nextStage = stages[index + 1];
          const connectorDone =
            stage.state === "completed" &&
            (nextStage?.state === "completed" || nextStage?.state === "active");

          return (
            <li
              key={stage.key}
              className={`fg-sat-step is-${stage.state}`}
              aria-current={stage.state === "active" ? "step" : undefined}
            >
              <div className="fg-sat-step-track">
                <div className="fg-sat-circle" aria-hidden="true">
                  {stage.state === "completed" ? (
                    <LuCheck size={22} />
                  ) : stage.state === "active" ? (
                    <LuLoader size={22} className="fg-sat-spin" />
                  ) : stage.state === "failed" ? (
                    <LuCircleAlert size={22} />
                  ) : (
                    <LuFileCheck2 size={20} />
                  )}
                </div>
                {nextStage && (
                  <div
                    className={`fg-sat-connector ${
                      stage.state === "completed" &&
                      nextStage.state === "completed"
                        ? "is-completed"
                        : connectorDone
                          ? "is-active"
                          : ""
                    }`}
                    aria-hidden="true"
                  />
                )}
              </div>

              <div className="fg-sat-step-copy">
                <strong>{stage.title}</strong>
                <span>{statusTextForStage(stage.state)}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Barra de progreso horizontal + porcentaje a la derecha */}
      <div className="fg-sat-bar-row">
        <div
          className="fg-sat-bar-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={displayPercent}
          aria-label="Progreso del procesamiento de imagen satelital"
        >
          <div
            className={`fg-sat-bar-fill ${isLive ? "is-animating" : ""} ${isFailed ? "is-failed" : ""}`}
            style={{ width: `${displayPercent}%` }}
          />
        </div>
        <span className="fg-sat-percent">{displayPercent}%</span>
      </div>

      {/* Tiempo estimado y botón inferior */}
      <div className="fg-sat-footer">
        <p className="fg-sat-timer">
          {isFullyDone
            ? "Tiempo estimado restante: 00:00:00"
            : `Tiempo estimado restante: ${formatDuration(remainingSeconds)}`}
        </p>
        {onCancel && (
          <button
            type="button"
            className="fg-sat-cancel-btn"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  );
}

import { LuLoader } from "react-icons/lu";

export function SatelliteProcessingCard({
  status = "submitting",
  scenesCount = 1,
  onCancel,
  cancelLabel = "Volver",
}) {
  const descriptions = {
    submitting: "Enviando la solicitud al servidor…",
    queued: "Solicitud en cola. El worker la procesará cuando esté disponible.",
    running:
      "El worker está procesando las imágenes y generando los resultados.",
    completed: "Resultados disponibles.",
    failed: "El procesamiento se detuvo. Consulta el detalle del análisis.",
  };
  return (
    <section
      className="fg-sat-processing-card"
      aria-live="polite"
      aria-busy={["submitting", "queued", "running"].includes(status)}
    >
      <div className="fg-sat-processing-header">
        <h4 className="flex items-center gap-2">
          <LuLoader aria-hidden="true" /> Procesamiento satelital
        </h4>
        <p role="status">{descriptions[status] || status}</p>
        <p>
          {scenesCount}{" "}
          {scenesCount === 1 ? "escena seleccionada" : "escenas seleccionadas"}.
          El estado se actualiza con la respuesta del servidor.
        </p>
      </div>
      {onCancel && (
        <button
          className="fg-button fg-button-secondary"
          type="button"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      )}
    </section>
  );
}

export const statusLabel = (value) =>
  ({
    queued: "En cola",
    running: "Procesando",
    completed: "Completado",
    failed: "Falló",
  })[value] || value;

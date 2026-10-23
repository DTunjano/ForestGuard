import { LuBrainCircuit } from "react-icons/lu";
import { useState } from "react";
import { useResource } from "../../../shared/api/useResource";
import { Page, Panel, Button, Notice } from "../../../shared/components/UI";
export function Models() {
  const [page, setPage] = useState(1);
  const query = useResource(`models/?page=${page}`);
  return (
    <Page title="Modelos disponibles">
      <p>
        Catálogo de modelos activos. La API permite consultar modelos; su
        instalación y activación se gestionan en el backend.
      </p>
      <Notice error={query.error}>{query.loading ? "Cargando…" : null}</Notice>
      {query.data?.results.map((model) => (
        <Panel key={model.id}>
          <div className="fg-model-icon">
            <LuBrainCircuit size={28} aria-hidden="true" />
          </div>
          <span className="fg-status fg-status-completed">Modelo activo</span>
          <h2>
            {model.name} · {model.version}
          </h2>
          <p>{model.algorithm}</p>
          <p>{model.description}</p>
          <details>
            <summary>Ficha técnica publicada</summary>
            <pre className="overflow-auto text-sm">
              {JSON.stringify(model.performance_profile, null, 2)}
            </pre>
          </details>
        </Panel>
      ))}
      {query.data?.count === 0 && (
        <p>No hay modelos activos. Puedes generar índices sin modelo.</p>
      )}
      <div className="flex gap-3">
        <Button
          disabled={!query.data?.previous}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </Button>
        <Button
          disabled={!query.data?.next}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </Button>
      </div>
    </Page>
  );
}

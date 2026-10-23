import { LuMapPin } from "react-icons/lu";
import { useState } from "react";
import { useResource } from "../../../shared/api/useResource";
import { AreaForm } from "../components/AreaForm";
import { Page, Panel, Button, Notice } from "../../../shared/components/UI";
export function StudyAreas() {
  const [page, setPage] = useState(1);
  const query = useResource(`study-areas/?page=${page}&ordering=-created_at`);
  return (
    <Page title="Áreas de estudio">
      <Panel>
        <h2>Crear área</h2>
        <AreaForm
          onCreated={() => {
            setPage(1);
            query.reload();
          }}
        />
      </Panel>
      <Notice error={query.error}>
        {query.loading ? "Cargando áreas…" : null}
      </Notice>
      {query.data?.results.map((area) => (
        <Panel key={area.id}>
          <div className="fg-model-icon">
            <LuMapPin size={26} aria-hidden="true" />
          </div>
          <h2>{area.name}</h2>
          <p>
            {[area.department, area.municipality].filter(Boolean).join(" · ")}
          </p>
          <p>{area.description}</p>
        </Panel>
      ))}
      {query.data?.count === 0 && (
        <p>Crea tu primera área para asociar las imágenes.</p>
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

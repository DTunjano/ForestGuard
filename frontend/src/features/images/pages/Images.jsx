import { useState } from "react";
import { useSearchParams, Link } from "react-router";
import { useCollection } from "../../../shared/api/useCollection";
import { useResource } from "../../../shared/api/useResource";
import { deleteImage } from "../api/images";
import { UploadImages } from "../components/UploadImages";
import { Modal } from "../../../shared/components/Modal";
import { DeleteConfirmation } from "../../../shared/components/DeleteConfirmation";
import {
  Page,
  Panel,
  Button,
  Field,
  Select,
  Notice,
  EmptyState,
} from "../../../shared/components/UI";
export function Images() {
  const [params, setParams] = useSearchParams();
  const area = params.get("area") || "";
  const areas = useCollection("study-areas/?ordering=name");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null),
    [message, setMessage] = useState("");
  const query = useResource(
    `images/?page=${page}&ordering=-acquisition_date${area ? `&study_area=${encodeURIComponent(area)}` : ""}`,
  );
  return (
    <Page title="Imágenes satelitales">
      <div className="fg-module-toolbar">
        <p>
          Consulta tus cargas, revisa sus metadatos y prepara nuevos estudios.
        </p>
        <Button disabled={!area} onClick={() => setDialog({ type: "upload" })}>
          Cargar imágenes
        </Button>
      </div>
      <Panel>
        <Field label="Filtrar por área">
          <Select
            value={area}
            onChange={(e) => {
              setParams(e.target.value ? { area: e.target.value } : {});
              setPage(1);
            }}
          >
            <option value="">Todas las áreas</option>
            {areas.data?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        </Field>
        <p>
          Elige un área para habilitar la carga. También puedes{" "}
          <Link className="underline" to="/study-areas">
            gestionar tus áreas
          </Link>
          .
        </p>
        <Notice error={areas.error} />
        <Notice error={query.error}>
          {query.loading ? "Cargando imágenes…" : message}
        </Notice>
        {query.error && <Button onClick={query.reload}>Reintentar</Button>}
        <div className="overflow-x-auto">
          <table className="fg-table">
            <thead>
              <tr>
                <th scope="col">Imagen</th>
                <th scope="col">Fecha de adquisición</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {query.data?.results.map((image) => (
                <tr key={image.id}>
                  <td className="fg-image-name">{image.name}</td>
                  <td>{image.acquisition_date}</td>
                  <td>
                    <div className="fg-actions">
                      <Button
                        variant="secondary"
                        onClick={() => setDialog({ type: "detail", image })}
                      >
                        Ver metadatos
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => setDialog({ type: "delete", image })}
                      >
                        Eliminar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {query.data?.count === 0 && (
          <EmptyState title="Sin imágenes en esta colección">
            Selecciona un área y carga tu primera escena Sentinel-2.
          </EmptyState>
        )}
        <nav className="fg-actions" aria-label="Páginas de imágenes">
          <Button
            variant="secondary"
            disabled={!query.data?.previous}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span>Página {page}</span>
          <Button
            variant="secondary"
            disabled={!query.data?.next}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
          <Link className="underline" to="/dashboard/new">
            Crear un análisis
          </Link>
        </nav>
      </Panel>
      {dialog?.type === "upload" && (
        <Modal title="Cargar imágenes del área" onClose={() => setDialog(null)}>
          <p>
            Las cargas aceptadas se conservan. Al cerrar se detienen los
            próximos envíos; el que ya llegó al servidor puede terminar.
          </p>
          <UploadImages
            area={area}
            onUploaded={() => {
              query.reload();
              setPage(1);
              setMessage("Imagen cargada.");
            }}
          />
        </Modal>
      )}
      {dialog?.type === "detail" && (
        <Modal title="Metadatos de la imagen" onClose={() => setDialog(null)}>
          <h3 className="break-all">{dialog.image.name}</h3>
          <dl className="fg-details">
            {[
              ["Fecha", dialog.image.acquisition_date],
              ["Dimensiones", `${dialog.image.width} × ${dialog.image.height}`],
              ["CRS", dialog.image.crs],
              ["Reflectancia detectada", dialog.image.reflectance_scale],
              ["Factor SCL", dialog.image.scl_factor ?? "Sin SCL"],
              ["Bandas", dialog.image.band_descriptions.join(", ")],
            ].map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
      {dialog?.type === "delete" && (
        <DeleteConfirmation
          name="imagen"
          explanation={`Se eliminará «${dialog.image.name}». Las imágenes asociadas a análisis no pueden eliminarse. Esta acción no se puede deshacer.`}
          onClose={() => setDialog(null)}
          onDelete={async () => {
            await deleteImage(dialog.image.id);
            setDialog(null);
            setMessage("Imagen eliminada.");
            if (query.data.results.length === 1 && page > 1)
              setPage((p) => p - 1);
            else query.reload();
          }}
        />
      )}
    </Page>
  );
}

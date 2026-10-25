import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  LuArrowLeft,
  LuArrowRight,
  LuBrainCircuit,
  LuCalendarDays,
  LuCheck,
  LuCircleAlert,
  LuCloudUpload,
  LuFileCheck2,
  LuLayers,
  LuMapPin,
  LuPlus,
  LuRotateCcw,
  LuSatellite,
  LuSparkles,
  LuTrash2,
} from "react-icons/lu";
import { useCollection } from "../../../shared/api/useCollection";
import { useResource } from "../../../shared/api/useResource";
import {
  Page,
  Panel,
  Field,
  Select,
  Button,
  Notice,
  EmptyState,
} from "../../../shared/components/UI";
import { DeleteConfirmation } from "../../../shared/components/DeleteConfirmation";
import { AreaForm } from "../../study-areas/components/AreaForm";
import { UploadImages } from "../../images/components/UploadImages";
import { deleteImage } from "../../images/api/images";
import { createAnalysis } from "../api/analyses";
import { SatelliteProcessingCard } from "../components/SatelliteProcessingCard";

export function NewAnalysis() {
  const areas = useCollection("study-areas/?ordering=name");
  const models = useCollection("models/");
  const [area, setArea] = useState("");
  const [activeStep, setActiveStep] = useState(1);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [selectionState, setSelectionState] = useState({
    count: 0,
    hasDuplicateDates: false,
  });

  const hasNoAreas = Array.isArray(areas.data) && areas.data.length === 0;
  const isCreatingArea = showAreaForm || hasNoAreas;
  const selectedArea = areas.data?.find(
    (item) => String(item.id) === String(area),
  );

  const canGoBackToStep = (stepNumber) => stepNumber < activeStep;

  const getStepStatus = (stepNumber) => {
    if (activeStep === stepNumber) return "current";
    if (stepNumber < activeStep) return "done";
    return "upcoming";
  };

  const steps = [
    {
      number: 1,
      code: "01",
      title: "Área de estudio",
      subtitle: selectedArea
        ? selectedArea.name
        : "Selecciona o crea el territorio",
      icon: LuMapPin,
    },
    {
      number: 2,
      code: "02",
      title: "Cargar imágenes",
      subtitle: area
        ? "Subir nuevos GeoTIFF (opcional)"
        : "Requiere elegir un área",
      icon: LuCloudUpload,
    },
    {
      number: 3,
      code: "03",
      title: "Seleccionar escenas",
      subtitle:
        selectionState.count > 0
          ? `${selectionState.count} ${selectionState.count === 1 ? "fecha seleccionada" : "fechas seleccionadas"}`
          : "Elige de 1 a 32 fechas del área",
      icon: LuSatellite,
    },
    {
      number: 4,
      code: "04",
      title: "Solicitar análisis",
      subtitle:
        selectionState.count > 1
          ? "Comparación multitemporal"
          : selectionState.count === 1
            ? "Índices descriptivos"
            : "Nombre, modelo y envío",
      icon: LuSparkles,
    },
  ];

  return (
    <Page title="Nuevo análisis">
      <ol className="fg-wizard-steps" aria-label="Pasos para crear un análisis">
        {steps.map((step) => {
          const StepIcon = step.icon;
          const status = getStepStatus(step.number);
          const canGoBack = canGoBackToStep(step.number);
          return (
            <li key={step.number}>
              <button
                type="button"
                disabled={!canGoBack}
                onClick={() => canGoBack && setActiveStep(step.number)}
                className={`fg-wizard-step fg-wizard-step-${status}`}
                aria-current={status === "current" ? "step" : undefined}
              >
                <span className="fg-wizard-step-badge" aria-hidden="true">
                  {status === "done" ? <LuCheck size={16} /> : step.code}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="fg-wizard-step-label">
                    <StepIcon size={13} aria-hidden="true" />
                    Paso {step.code}
                  </p>
                  <strong className="fg-wizard-step-title">{step.title}</strong>
                  <span className="fg-wizard-step-subtitle">
                    {step.subtitle}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>

      {activeStep === 1 && (
        <Panel>
          <div className="fg-step-header">
            <div>
              <p className="fg-eyebrow">
                <LuMapPin aria-hidden="true" /> Paso 01 de 04 · Delimitación
                territorial
              </p>
              <h2>
                {isCreatingArea
                  ? "Registrar nueva área de estudio"
                  : "1. Selecciona el área de estudio"}
              </h2>
              <p>
                {hasNoAreas
                  ? "Aún no tienes áreas registradas. Crea tu primera área de estudio para continuar al paso de carga de imágenes."
                  : isCreatingArea
                    ? "Completa los datos del territorio. Al guardarlo quedará seleccionado automáticamente."
                    : "Elige un territorio existente de tu catálogo o registra uno nuevo para iniciar el flujo."}
              </p>
            </div>
            {!hasNoAreas && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowAreaForm((open) => !open)}
                aria-expanded={isCreatingArea}
              >
                {isCreatingArea ? (
                  <>
                    <LuArrowLeft aria-hidden="true" />
                    <span>Elegir un área existente</span>
                  </>
                ) : (
                  <>
                    <LuPlus aria-hidden="true" />
                    <span>Crear un área de estudio</span>
                  </>
                )}
              </Button>
            )}
          </div>

          <Notice error={areas.error} />

          {isCreatingArea ? (
            <div className="fg-inline-creator">
              <AreaForm
                onCancel={hasNoAreas ? undefined : () => setShowAreaForm(false)}
                onCreated={(item) => {
                  areas.reload();
                  setArea(String(item.id));
                  setSelectionState({ count: 0, hasDuplicateDates: false });
                  setShowAreaForm(false);
                  setActiveStep(2);
                }}
              />
            </div>
          ) : (
            <>
              <div className="fg-area-selector-grid">
                <Field label="Área de estudio">
                  <Select
                    value={area}
                    onChange={(e) => {
                      setArea(e.target.value);
                      setSelectionState({ count: 0, hasDuplicateDates: false });
                    }}
                  >
                    <option value="">Selecciona un área</option>
                    {areas.data?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                {selectedArea ? (
                  <div className="fg-area-summary-card">
                    <div className="fg-area-summary-icon" aria-hidden="true">
                      <LuMapPin size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{selectedArea.name}</strong>
                        <span className="fg-status fg-status-completed">
                          Territorio seleccionado
                        </span>
                      </div>
                      <p>
                        {[selectedArea.department, selectedArea.municipality]
                          .filter(Boolean)
                          .join(" · ") ||
                          "Ubicación administrativa no especificada"}
                      </p>
                      {selectedArea.description && (
                        <small>{selectedArea.description}</small>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="fg-area-summary-card fg-area-summary-placeholder">
                    <div className="fg-area-summary-icon" aria-hidden="true">
                      <LuLayers size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <strong>Ningún área seleccionada</strong>
                      <p>
                        Selecciona un territorio en el desplegable o pulsa
                        «Crear un área de estudio» si deseas registrar uno
                        nuevo.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="fg-step-nav-footer">
                <span className="text-xs text-slate-400">
                  {selectedArea
                    ? `Continuarás con el territorio «${selectedArea.name}».`
                    : "Selecciona un área de estudio para habilitar el siguiente paso."}
                </span>
                <Button
                  type="button"
                  disabled={!area}
                  onClick={() => setActiveStep(2)}
                >
                  <span>Siguiente: Cargar imágenes</span>
                  <LuArrowRight aria-hidden="true" />
                </Button>
              </div>
            </>
          )}
        </Panel>
      )}

      {area && (
        <AreaAnalysis
          key={area}
          area={area}
          areaName={selectedArea?.name}
          models={models}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
          onSelectionChange={setSelectionState}
        />
      )}
    </Page>
  );
}

function AreaAnalysis({
  area,
  areaName,
  models,
  activeStep,
  setActiveStep,
  onSelectionChange,
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [imageToDelete, setImageToDelete] = useState(null);
  const [hasPendingUploads, setHasPendingUploads] = useState(false);
  const images = useResource(
    `images/?study_area=${area}&page=${page}&ordering=-acquisition_date`,
  );
  const allAreaImages = useCollection(
    `images/?study_area=${area}&ordering=-acquisition_date`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const lock = useRef(false);
  const navigate = useNavigate();

  function computeHasDuplicates(rows) {
    return new Set(rows.map((i) => i.acquisition_date)).size !== rows.length;
  }

  function updateSelected(updater) {
    setSelected((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      onSelectionChange?.({
        count: next.length,
        hasDuplicateDates: computeHasDuplicates(next),
      });
      return next;
    });
  }

  function toggle(image) {
    updateSelected((rows) =>
      rows.some((row) => row.id === image.id)
        ? rows.filter((row) => row.id !== image.id)
        : [...rows, image],
    );
  }

  const sortedScenes = [...selected].sort((a, b) =>
    a.acquisition_date.localeCompare(b.acquisition_date),
  );
  const sortedDates = sortedScenes.map((i) => i.acquisition_date);
  const dateCounts = selected.reduce((acc, item) => {
    acc[item.acquisition_date] = (acc[item.acquisition_date] || 0) + 1;
    return acc;
  }, {});
  const hasDuplicateDates = Object.values(dateCounts).some(
    (count) => count > 1,
  );
  const allHaveScl =
    selected.length > 0 && selected.every((i) => Boolean(i.scl_factor));
  const totalImagesInArea = images.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalImagesInArea / 10));
  const pageCount = images.data?.results?.length ?? 0;
  const rangeStart = pageCount > 0 ? (page - 1) * 10 + 1 : 0;
  const rangeEnd = pageCount > 0 ? (page - 1) * 10 + pageCount : 0;

  const intervals = sortedScenes.slice(0, -1).map((scene, idx) => {
    const nextScene = sortedScenes[idx + 1];
    const start = new Date(`${scene.acquisition_date}T00:00:00Z`);
    const end = new Date(`${nextScene.acquisition_date}T00:00:00Z`);
    const days = Math.round(
      Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    return {
      from: scene.acquisition_date,
      to: nextScene.acquisition_date,
      days,
    };
  });
  const activeModel =
    models.data?.find((m) => m.active) || models.data?.[0] || null;
  const existingDates = Array.from(
    new Set(
      [
        ...(allAreaImages.data || []).map((img) => img.acquisition_date),
        ...(images.data?.results || []).map((img) => img.acquisition_date),
        ...selected.map((img) => img.acquisition_date),
      ].filter(Boolean),
    ),
  );

  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (intervals.some((interval) => interval.days < 35))
        throw new Error(
          "Las comparaciones requieren al menos 35 días entre fechas consecutivas. No hay límite máximo. Puedes analizar cada imagen individualmente.",
        );
      if (
        new Set(selected.map((i) => i.acquisition_date)).size !==
        selected.length
      )
        throw new Error(
          "Selecciona una imagen por fecha. Se admiten varias fechas del mismo año.",
        );
      const analysis = await createAnalysis({
        name: values.name,
        description: values.description,
        study_area: Number(area),
        image_ids: selected.map((i) => i.id),
        ...(selected.length > 1 && allHaveScl && activeModel?.id
          ? { model_id: Number(activeModel.id) }
          : {}),
      });
      navigate(`/dashboard/results/${analysis.id}`, {
        state: { fromCreate: true },
      });
    } catch (err) {
      setError(err);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6" hidden={activeStep === 1}>
      {/* PASO 2: CARGAR IMÁGENES (AISLADO) */}
      <div hidden={activeStep !== 2}>
        <Panel>
          <div className="fg-step-header">
            <div>
              <p className="fg-eyebrow">
                <LuCloudUpload aria-hidden="true" /> Paso 02 de 04 · Ingesta de
                imágenes en {areaName || `Área #${area}`}
              </p>
              <h2 className="text-xl">2. Cargar imágenes</h2>
              <p>
                Sube nuevas escenas Sentinel-2 GeoTIFF para este territorio. Si
                las imágenes que necesitas ya están cargadas en el área (
                {totalImagesInArea}{" "}
                {totalImagesInArea === 1 ? "disponible" : "disponibles"}),
                puedes avanzar directamente al siguiente paso.
              </p>
            </div>
          </div>

          <UploadImages
            area={area}
            existingDates={existingDates}
            onPendingChange={setHasPendingUploads}
            onUploaded={(image) => {
              images.reload();
              allAreaImages.reload();
              updateSelected((rows) =>
                rows.length < 32 && !rows.some((i) => i.id === image.id)
                  ? [...rows, image]
                  : rows,
              );
            }}
            onRemoved={(removedId) => {
              images.reload();
              allAreaImages.reload();
              updateSelected((rows) => rows.filter((i) => i.id !== removedId));
            }}
            onCleared={(clearedIds) => {
              images.reload();
              allAreaImages.reload();
              if (Array.isArray(clearedIds) && clearedIds.length > 0) {
                updateSelected((rows) =>
                  rows.filter((i) => !clearedIds.includes(i.id)),
                );
              }
            }}
          />

          <div className="fg-step-nav-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setActiveStep(1)}
            >
              <LuArrowLeft aria-hidden="true" />
              <span>Anterior: Área de estudio</span>
            </Button>

            <div className="flex flex-wrap items-center gap-3">
              {hasPendingUploads ? (
                <span className="fg-pending-upload-warning" role="status">
                  <LuCircleAlert size={14} aria-hidden="true" />
                  Carga o retira las imágenes pendientes en la cola para avanzar
                </span>
              ) : (
                selected.length > 0 && (
                  <span className="fg-selection-count-pill">
                    {selected.length}{" "}
                    {selected.length === 1
                      ? "escena preseleccionada"
                      : "escenas preseleccionadas"}
                  </span>
                )
              )}
              <Button
                type="button"
                disabled={hasPendingUploads}
                onClick={() => setActiveStep(3)}
              >
                <span>
                  {selected.length > 0
                    ? "Siguiente: Revisar escenas seleccionadas"
                    : "Siguiente: Seleccionar escenas del área"}
                </span>
                <LuArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </Panel>
      </div>

      {/* PASO 3: SELECCIONAR IMÁGENES DEL ÁREA (AISLADO) */}
      <div hidden={activeStep !== 3}>
        <Panel>
          <div className="fg-step-header">
            <div>
              <p className="fg-eyebrow">
                <LuSatellite aria-hidden="true" /> Paso 03 de 04 · Catálogo de{" "}
                {areaName || `Área #${area}`}
              </p>
              <h2 className="text-xl">3. Seleccionar imágenes del área</h2>
              <p>
                Seleccionadas: {selected.length} / 32. Una fecha genera índices;
                varias fechas generan comparaciones. La cobertura válida exacta
                aparece en los resultados.
              </p>
            </div>
            <div className="fg-step3-header-actions">
              {images.data?.results?.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy || selected.length >= 32}
                  onClick={() => {
                    const pageItems = images.data?.results || [];
                    updateSelected((current) => {
                      const next = [...current];
                      const usedDates = new Set(
                        next.map((item) => item.acquisition_date),
                      );
                      for (const img of pageItems) {
                        if (next.length >= 32) break;
                        if (
                          !next.some((row) => row.id === img.id) &&
                          !usedDates.has(img.acquisition_date)
                        ) {
                          next.push(img);
                          usedDates.add(img.acquisition_date);
                        }
                      }
                      return next;
                    });
                  }}
                >
                  <LuCheck aria-hidden="true" />
                  <span>Seleccionar página</span>
                </Button>
              )}
              {selected.length > 0 && (
                <Button
                  type="button"
                  variant="clear"
                  onClick={() => updateSelected([])}
                  disabled={busy}
                >
                  <LuRotateCcw aria-hidden="true" />
                  <span>Limpiar selección</span>
                </Button>
              )}
            </div>
          </div>

          <div className="fg-step3-overview-grid">
            <div className="fg-step3-stat-card">
              <span>Territorio activo</span>
              <strong>{areaName || `Área #${area}`}</strong>
              <small>
                {totalImagesInArea}{" "}
                {totalImagesInArea === 1
                  ? "escena disponible en catálogo"
                  : "escenas disponibles en catálogo"}
              </small>
            </div>
            <div className="fg-step3-stat-card">
              <span>Selección activa</span>
              <strong>{selected.length} / 32 escenas</strong>
              <small>
                {selected.length === 0
                  ? "Marca al menos 1 escena para continuar"
                  : allHaveScl
                    ? "Todas incluyen banda SCL"
                    : "Alguna escena no incluye banda SCL"}
              </small>
            </div>
            <div className="fg-step3-stat-card is-accent">
              <span>Modalidad de procesamiento</span>
              <strong>
                {selected.length === 0
                  ? "Pendiente de selección"
                  : selected.length === 1
                    ? "Análisis descriptivo (1 fecha)"
                    : `Serie multitemporal (${selected.length - 1} ${selected.length - 1 === 1 ? "intervalo" : "intervalos"})`}
              </strong>
              <small>
                {selected.length === 0
                  ? "1 fecha = índices · 2+ fechas = comparaciones"
                  : selected.length === 1
                    ? "Cálculo de NDVI, NDMI, NBR y NDRE"
                    : allHaveScl
                      ? "Compatible con el modelo de ML activo"
                      : "Diferencias espectrales multitemporales"}
              </small>
            </div>
          </div>

          <Notice error={images.error}>
            {images.loading ? "Cargando imágenes…" : null}
          </Notice>

          {images.data?.count === 0 && (
            <EmptyState title="Aún no hay imágenes en esta área.">
              Regresa al paso anterior para cargar tu primer archivo Sentinel-2
              GeoTIFF en este territorio.
            </EmptyState>
          )}

          {images.data?.results?.length > 0 && (
            <div className="fg-scene-catalog-box">
              <div className="fg-scene-catalog-header">
                <div>
                  <strong>Escenas registradas en el área</strong>
                  <small>
                    Haz clic sobre cualquier tarjeta para incluir o quitar la
                    escena del análisis
                  </small>
                </div>
                <span className="fg-selection-count-pill">
                  Mostrando {images.data.results.length} de {totalImagesInArea}
                </span>
              </div>

              <div className="fg-scene-list">
                {images.data.results.map((image) => {
                  const isChecked = selected.some((i) => i.id === image.id);
                  const isDuplicateDate =
                    isChecked && dateCounts[image.acquisition_date] > 1;
                  const sizeLabel = image.size_bytes
                    ? image.size_bytes < 1024 * 1024
                      ? `${Math.max(1, Math.round(image.size_bytes / 1024))} KB`
                      : `${(image.size_bytes / (1024 * 1024)).toFixed(1)} MB`
                    : null;
                  const bands = Array.isArray(image.band_descriptions)
                    ? image.band_descriptions.filter(Boolean)
                    : [];

                  return (
                    <label
                      key={image.id}
                      data-selected={isChecked}
                      className={`fg-scene-card ${isChecked ? "is-selected" : ""} ${isDuplicateDate ? "is-duplicate" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={busy || (selected.length >= 32 && !isChecked)}
                        onChange={() => toggle(image)}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="fg-scene-card-header">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="fg-scene-date">
                              <LuCalendarDays aria-hidden="true" />
                              {image.acquisition_date}
                            </span>
                            {isChecked && (
                              <span className="fg-scene-selected-pill">
                                <LuCheck size={12} aria-hidden="true" />
                                Seleccionada
                              </span>
                            )}
                          </div>
                          <div className="fg-scene-card-actions">
                            <span
                              className={`fg-scene-scl ${image.scl_factor ? "has-scl" : "no-scl"}`}
                            >
                              {image.scl_factor ? "SCL disponible" : "Sin SCL"}
                            </span>
                            <button
                              type="button"
                              disabled={busy}
                              className="fg-upload-remove"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setImageToDelete(image);
                              }}
                            >
                              <LuTrash2 aria-hidden="true" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>

                        <span className="fg-scene-title break-all">
                          {image.name}
                        </span>

                        <div className="fg-upload-meta">
                          <span>
                            Dimensiones: {image.width} × {image.height} px
                          </span>
                          <span>CRS: {image.crs}</span>
                          {image.reflectance_scale && (
                            <span>Escala: {image.reflectance_scale}</span>
                          )}
                          {sizeLabel && <span>Tamaño: {sizeLabel}</span>}
                          {isDuplicateDate && (
                            <span className="fg-scene-dup-chip">
                              Fecha repetida en la selección
                            </span>
                          )}
                        </div>

                        {bands.length > 0 && (
                          <div className="fg-upload-bands pt-1">
                            <span className="fg-upload-bands-label">
                              Bandas ({bands.length}):
                            </span>
                            <div className="fg-upload-bands-list">
                              {bands.map((band, idx) => (
                                <span
                                  key={`${band}-${idx}`}
                                  className={`fg-upload-band-pill ${band === "SCL" ? "is-scl" : ""}`}
                                >
                                  {band}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Paginación sutil y clara */}
              <div className="fg-subtle-pagination">
                <span className="fg-subtle-pagination-range">
                  Mostrando{" "}
                  <strong>
                    {rangeStart}–{rangeEnd}
                  </strong>{" "}
                  de <strong>{totalImagesInArea}</strong>{" "}
                  {totalImagesInArea === 1
                    ? "imagen en el área"
                    : "imágenes en el área"}
                </span>
                <div className="fg-subtle-pagination-controls">
                  <button
                    type="button"
                    className="fg-subtle-page-btn"
                    disabled={!images.data?.previous}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <LuArrowLeft size={14} aria-hidden="true" />
                    <span>Anterior</span>
                  </button>
                  <span className="fg-subtle-page-indicator">
                    Página <strong>{page}</strong> de{" "}
                    <strong>{totalPages}</strong>
                  </span>
                  <button
                    type="button"
                    className="fg-subtle-page-btn"
                    disabled={!images.data?.next}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <span>Siguiente</span>
                    <LuArrowRight size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cronología visual rediseñada */}
          <div className="fg-chronology-panel">
            <div className="fg-chronology-header">
              <div className="fg-chronology-title">
                <span className="fg-chronology-icon" aria-hidden="true">
                  <LuCalendarDays size={16} />
                </span>
                <div>
                  <strong>Línea de tiempo del estudio</strong>
                  <small>
                    {sortedScenes.length === 0
                      ? "Selecciona escenas del catálogo para construir la secuencia temporal"
                      : sortedScenes.length === 1
                        ? "1 fecha seleccionada · Cálculo de índices espectrales descriptivos"
                        : `${sortedScenes.length} fechas ordenadas · ${intervals.length} ${intervals.length === 1 ? "intervalo de comparación" : "intervalos de comparación"}`}
                  </small>
                </div>
              </div>
              {sortedScenes.length > 0 && (
                <span className="fg-selection-count-pill">
                  {sortedScenes.length === 1
                    ? sortedScenes[0].acquisition_date
                    : `${sortedScenes[0].acquisition_date} → ${sortedScenes[sortedScenes.length - 1].acquisition_date}`}
                </span>
              )}
            </div>

            {sortedScenes.length > 0 ? (
              <div className="fg-chronology-track">
                {sortedScenes.map((scene, idx) => {
                  const interval = intervals[idx];
                  return (
                    <div
                      key={`${scene.id}-${idx}`}
                      className="fg-chronology-step"
                    >
                      <div className="fg-chronology-node">
                        <div className="fg-chronology-node-top">
                          <span className="fg-chronology-badge">
                            T{idx + 1}
                          </span>
                          <span
                            className={`fg-chronology-scl ${scene.scl_factor ? "has-scl" : "no-scl"}`}
                          >
                            {scene.scl_factor ? "SCL" : "Sin SCL"}
                          </span>
                        </div>
                        <strong className="fg-chronology-date">
                          {scene.acquisition_date}
                        </strong>
                        <span className="fg-chronology-name" title={scene.name}>
                          {scene.name}
                        </span>
                      </div>

                      {interval && (
                        <div className="fg-chronology-connector">
                          <div className="fg-chronology-line" />
                          <span className="fg-chronology-delta is-v9">
                            +{interval.days} d
                          </span>
                          <div className="fg-chronology-line" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="fg-chronology-empty">
                Marca una o varias casillas arriba para visualizar aquí los
                nodos temporales y los días transcurridos entre cada toma
                satelital.
              </div>
            )}

            {hasDuplicateDates && (
              <p role="alert" className="fg-duplicate-warning">
                <LuCircleAlert aria-hidden="true" />
                Hay más de una escena con la misma fecha de adquisición. Deja
                solo una imagen por fecha para continuar.
              </p>
            )}
          </div>

          <div className="fg-step-nav-footer">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setActiveStep(2)}
            >
              <LuArrowLeft aria-hidden="true" />
              <span>Anterior: Cargar imágenes</span>
            </Button>

            <Button
              type="button"
              disabled={
                selected.length === 0 ||
                selected.length > 32 ||
                hasDuplicateDates ||
                intervals.some((interval) => interval.days < 35)
              }
              onClick={() => setActiveStep(4)}
            >
              <span>Siguiente: Configurar análisis</span>
              <LuArrowRight aria-hidden="true" />
            </Button>
          </div>
          {intervals.some((interval) => interval.days < 35) && (
            <Notice error="Selecciona fechas separadas al menos 35 días. No hay límite máximo para la comparación." />
          )}
        </Panel>

        {imageToDelete && (
          <DeleteConfirmation
            name="imagen"
            explanation={`Se eliminará «${imageToDelete.name}» (${imageToDelete.acquisition_date}). Las imágenes asociadas a análisis no pueden eliminarse. Esta acción no se puede deshacer.`}
            onClose={() => setImageToDelete(null)}
            onDelete={async () => {
              await deleteImage(imageToDelete.id);
              updateSelected((rows) =>
                rows.filter((i) => i.id !== imageToDelete.id),
              );
              setImageToDelete(null);
              allAreaImages.reload();
              if (images.data?.results?.length === 1 && page > 1) {
                setPage((p) => p - 1);
              } else {
                images.reload();
              }
            }}
          />
        )}
      </div>

      {/* PASO 4: CONFIGURAR Y SOLICITAR ANÁLISIS (AISLADO) */}
      <div hidden={activeStep !== 4}>
        <Panel>
          <div className="fg-step-header">
            <div>
              <p className="fg-eyebrow">
                <LuFileCheck2 aria-hidden="true" /> Paso 04 de 04 · Ejecución
                del estudio
              </p>
              <h2 className="text-xl">4. Solicitar análisis</h2>
              <p>
                Revisa el resumen del estudio, asigna un nombre identificativo y
                ejecuta el procesamiento con el modelo de Machine Learning
                activo.
              </p>
            </div>
          </div>

          {/* Resumen ejecutivo en 4 tarjetas */}
          <dl className="fg-step4-summary-cards">
            <div className="fg-step4-summary-item">
              <dt>Territorio de estudio</dt>
              <dd>{areaName || `Área #${area}`}</dd>
              <small>Área vinculada al análisis</small>
            </div>
            <div className="fg-step4-summary-item">
              <dt>Escenas seleccionadas</dt>
              <dd>
                {selected.length === 0
                  ? "Sin seleccionar"
                  : `${selected.length} ${selected.length === 1 ? "escena" : "escenas"}`}
              </dd>
              <small>
                {allHaveScl
                  ? "Todas incluyen máscara SCL"
                  : "Cobertura espectral estándar"}
              </small>
            </div>
            <div className="fg-step4-summary-item">
              <dt>Cobertura temporal</dt>
              <dd>
                {sortedDates.length === 0
                  ? "—"
                  : sortedDates.length === 1
                    ? sortedDates[0]
                    : `${sortedDates[0]} → ${sortedDates[sortedDates.length - 1]}`}
              </dd>
              <small>
                {intervals.length === 0
                  ? "Fecha individual"
                  : `${intervals.length} ${intervals.length === 1 ? "intervalo" : "intervalos"} de cambio`}
              </small>
            </div>
            <div className="fg-step4-summary-item is-highlight">
              <dt>Modelo de Machine Learning</dt>
              <dd>
                {activeModel
                  ? `${activeModel.name} · ${activeModel.version}`
                  : "Modelo ML activo"}
              </dd>
              <small>
                {selected.length <= 1
                  ? "Índices NDVI · NDMI · NBR · NDRE"
                  : "Clasificación multitemporal activa"}
              </small>
            </div>
          </dl>

          <form onSubmit={submit} className="space-y-6">
            <div className="fg-step4-grid">
              {/* Columna izquierda: Identificación y escenas */}
              <div className="fg-step4-card">
                <div className="fg-step4-card-header">
                  <div className="fg-step4-card-icon" aria-hidden="true">
                    <LuFileCheck2 size={18} />
                  </div>
                  <div>
                    <p className="fg-eyebrow">Datos del registro</p>
                    <h3>Identificación del análisis</h3>
                  </div>
                </div>

                <Field
                  label="Nombre del análisis"
                  name="name"
                  placeholder="Ej. Seguimiento multitemporal sector norte"
                  required
                  maxLength={160}
                />
                <Field label="Descripción">
                  <textarea
                    name="description"
                    rows={4}
                    className="fg-step4-description-textarea"
                    placeholder="Notas opcionales sobre el periodo, sector o propósito del estudio"
                  />
                </Field>

                <div className="fg-step4-scenes-preview">
                  <div className="fg-step4-scenes-preview-top">
                    <span>Escenas confirmadas para el análisis</span>
                    <small>{sortedScenes.length} en secuencia</small>
                  </div>
                  <div className="fg-step4-scenes-tags">
                    {sortedScenes.map((scene, idx) => (
                      <span key={scene.id} className="fg-step4-scene-tag">
                        <strong>T{idx + 1}</strong>
                        <span>{scene.acquisition_date}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Columna derecha: Información sencilla del modelo ML activo (solo lectura) */}
              <div className="fg-step4-card">
                <div className="fg-step4-card-header">
                  <div className="fg-step4-card-icon" aria-hidden="true">
                    <LuBrainCircuit size={18} />
                  </div>
                  <div>
                    <p className="fg-eyebrow">Motor inteligente del sistema</p>
                    <h3>Modelo de Machine Learning</h3>
                  </div>
                </div>

                <div className="fg-active-model-banner">
                  <div className="fg-active-model-top">
                    <div className="fg-active-model-title">
                      <span
                        className="fg-active-model-dot"
                        aria-hidden="true"
                      />
                      <div>
                        <strong>
                          {activeModel
                            ? `${activeModel.name} (${activeModel.version})`
                            : "ForestGuard · Modelo ML v9"}
                        </strong>
                        <span>
                          {activeModel?.algorithm
                            ? `Algoritmo ${activeModel.algorithm} · Selección automática`
                            : "Clasificador Random Forest · Selección automática"}
                        </span>
                      </div>
                    </div>
                    <span className="fg-active-model-badge">
                      <LuCheck size={13} aria-hidden="true" />
                      Modelo activo
                    </span>
                  </div>

                  <p className="fg-active-model-desc">
                    El sistema emplea automáticamente el modelo de Machine
                    Learning activo para procesar tus imágenes satelitales, sin
                    que tengas que configurar parámetros manuales.
                  </p>

                  <ul className="fg-active-model-points">
                    <li>
                      <LuCheck size={14} aria-hidden="true" />
                      <span>
                        <strong>Índices de vegetación:</strong> calcula
                        automáticamente NDVI, NDMI, NBR y NDRE en cada escena.
                      </span>
                    </li>
                    <li>
                      <LuCheck size={14} aria-hidden="true" />
                      <span>
                        <strong>
                          {selected.length > 1
                            ? "Comparación con modelo ML activo:"
                            : "Evaluación de escena individual:"}
                        </strong>{" "}
                        {selected.length > 1
                          ? "analiza los cambios de cobertura entre las fechas seleccionadas mediante el modelo activo."
                          : "genera el diagnóstico espectral completo para la fecha seleccionada."}
                      </span>
                    </li>
                    <li>
                      <LuCheck size={14} aria-hidden="true" />
                      <span>
                        <strong>Resultados listos para consulta:</strong> genera
                        mapas comparativos en PNG, métricas de superficie y
                        reporte en PDF.
                      </span>
                    </li>
                  </ul>
                </div>

                <Notice error={models.error} />
              </div>
            </div>

            {/* Pantalla / barra de carga profesional del procesamiento satelital (solo al ejecutar Crear análisis) */}
            {busy && (
              <SatelliteProcessingCard
                status="submitting"
                scenesCount={selected.length || 1}
              />
            )}

            <Notice error={error} />

            <div className="fg-step-nav-footer">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setActiveStep(3)}
              >
                <LuArrowLeft aria-hidden="true" />
                <span>Anterior: Seleccionar escenas</span>
              </Button>

              <Button
                disabled={
                  busy ||
                  !selected.length ||
                  selected.length > 32 ||
                  hasDuplicateDates
                }
              >
                <span>{busy ? "Solicitando…" : "Crear análisis"}</span>
                {!busy && <LuArrowRight aria-hidden="true" />}
              </Button>
            </div>
          </form>

          <p className="fg-worker-footnote">
            El worker debe estar activo. Puedes consultar el trabajo después
            desde el historial. Los índices y clasificaciones son exploratorios
            y no confirman por sí solos deforestación ni riesgo futuro.
          </p>
        </Panel>
      </div>
    </div>
  );
}

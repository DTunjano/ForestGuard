import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  LuArrowLeft,
  LuArrowRight,
  LuBrainCircuit,
  LuCalendarDays,
  LuCheck,
  LuCloudUpload,
  LuFileImage,
  LuMapPin,
  LuPlay,
  LuTrash2,
} from "react-icons/lu";
import { toast } from "sonner";
import { MainLayout } from "../../components/layout/MainLayout";

const steps = ["Información", "Imágenes", "Periodos", "Procesar"];
const initialImages = [
  {
    id: "initial-2020",
    date: "2020-01-01",
    year: "2020",
    name: "img_guamo_2020.tif",
    size: "18.4 MB",
  },
];

const activeModels = [
  {
    id: 1,
    name: "ForestGuard Vision",
    version: "v2.4.1",
  },
  {
    id: 2,
    name: "NDVI Degradation",
    version: "v1.8.0",
  },
];

const imageDatePattern = /__(\d{4})_(\d{2})_(\d{2})__/;

const extractImageDate = (fileName) => {
  const match = fileName.match(imageDatePattern);

  if (!match) return null;

  const [, year, month, day] = match;
  return {
    date: `${year}-${month}-${day}`,
    year,
  };
};

const inputClass =
  "mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-[#b9e75c]/70";

export const NewAnalysis = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("Análisis Guamo");
  const [location, setLocation] = useState("Guamo, Tolima");
  const [description, setDescription] = useState("");
  const [images, setImages] = useState(initialImages);
  const [mode, setMode] = useState("complete");
  const [specificStartId, setSpecificStartId] = useState(initialImages[0].id);
  const [specificEndId, setSpecificEndId] = useState(
    initialImages[initialImages.length - 1].id,
  );
  const [manualImageIds, setManualImageIds] = useState([]);
  const [selectedModelId, setSelectedModelId] = useState(activeModels[0]?.id);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(
      () => setProgress((value) => Math.min(value + 12, 100)),
      260,
    );
    return () => clearInterval(timer);
  }, [processing]);

  useEffect(() => {
    if (progress === 100) setProcessing(false);
  }, [progress]);

  const handleFiles = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    const invalidFiles = [];
    const duplicateYearFiles = [];
    const yearsInUse = new Set(images.map((image) => image.year));
    const nextFiles = [];
    let limitReached = false;

    selectedFiles.forEach((file) => {
      const imageDate = extractImageDate(file.name);

      if (!imageDate) {
        invalidFiles.push(file.name);
        return;
      }

      if (yearsInUse.has(imageDate.year)) {
        duplicateYearFiles.push(file.name);
        return;
      }

      if (images.length + nextFiles.length >= 10) {
        limitReached = true;
        return;
      }

      yearsInUse.add(imageDate.year);
      nextFiles.push({
        id: `${file.name}-${file.lastModified}`,
        ...imageDate,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      });
    });

    const uploadErrors = [];
    if (invalidFiles.length) {
      uploadErrors.push(
        `${invalidFiles.length} archivo(s) no tienen una fecha con formato YYYY_MM_DD.`,
      );
    }
    if (duplicateYearFiles.length) {
      uploadErrors.push(
        `${duplicateYearFiles.length} archivo(s) fueron rechazados porque ya existe una imagen de ese año.`,
      );
    }
    if (limitReached) {
      uploadErrors.push("Solo puedes cargar un máximo de 10 imágenes.");
    }

    if (uploadErrors.length) {
      toast.warning("No todas las imágenes fueron agregadas", {
        description: uploadErrors.join(" "),
      });
    }
    if (nextFiles.length) {
      toast.success(
        `${nextFiles.length} imagen${nextFiles.length === 1 ? "" : "es"} agregada${nextFiles.length === 1 ? "" : "s"}.`,
      );
    }
    setImages((current) =>
      [...current, ...nextFiles].sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
    );
    event.target.value = "";
  };

  const handleRemoveAllImages = () => {
    if (!images.length) {
      toast.info("No hay imágenes cargadas para eliminar.");
      return;
    }

    setImages([]);
    setMode("complete");
    setManualImageIds([]);
    setSpecificStartId("");
    setSpecificEndId("");
    toast.success("Todas las imágenes fueron eliminadas.");
  };

  const handleRemoveImage = (imageId) => {
    const nextImages = images.filter((image) => image.id !== imageId);
    setImages(nextImages);

    if (nextImages.length < 2 && mode !== "complete") {
      setMode("complete");
      setManualImageIds([]);
    }
  };

  const selectedStartImage = images.find(
    (image) => image.id === specificStartId,
  );
  const selectedEndImage = images.find((image) => image.id === specificEndId);
  const manualSelectedImages = images
    .filter((image) => manualImageIds.includes(image.id))
    .sort((left, right) => left.date.localeCompare(right.date));
  const specificSelectedImages =
    selectedStartImage && selectedEndImage
      ? images.filter(
          (image) =>
            image.date >= selectedStartImage.date &&
            image.date <= selectedEndImage.date,
        )
      : [];

  const handleContinue = () => {
    if (step === 2 && mode === "specific") {
      if (!selectedStartImage || !selectedEndImage) {
        toast.warning("Selecciona un periodo inicial y uno final.");
        return;
      }

      if (specificStartId === specificEndId) {
        toast.warning("El periodo inicial y el final deben ser diferentes.");
        return;
      }

      if (
        selectedStartImage &&
        selectedEndImage &&
        selectedStartImage.date >= selectedEndImage.date
      ) {
        toast.warning("El periodo inicial debe ser anterior al periodo final.");
        return;
      }
    }

    if (step === 2 && mode === "manual" && manualSelectedImages.length !== 2) {
      toast.warning("Selecciona exactamente 2 imágenes para comparar.");
      return;
    }

    setStep((current) => current + 1);
  };

  const highlightedImageIds = new Set(
    mode === "complete"
      ? images.map((image) => image.id)
      : mode === "specific"
        ? specificSelectedImages.map((image) => image.id)
        : manualImageIds,
  );

  const selectedAnalysisImages =
    mode === "complete"
      ? images
      : mode === "specific"
        ? specificSelectedImages
        : manualSelectedImages;
  const selectedModel = activeModels.find(
    (model) => model.id === selectedModelId,
  );

  const analysisModeLabel =
    mode === "complete"
      ? "Análisis completo"
      : mode === "specific"
        ? "Comparación específica"
        : "Selección manual";
  const analysisPeriodLabel =
    mode === "specific" && selectedStartImage && selectedEndImage
      ? `${selectedStartImage.date} → ${selectedEndImage.date}`
      : mode === "manual" && manualSelectedImages.length
        ? manualSelectedImages.map((image) => image.date).join(" → ")
        : selectedAnalysisImages.length
          ? selectedAnalysisImages.length === 1
            ? selectedAnalysisImages[0].date
            : `${selectedAnalysisImages[0].date} → ${selectedAnalysisImages[selectedAnalysisImages.length - 1].date}`
          : "Sin periodos seleccionados";
  const completeModeSummary =
    images.length === 0
      ? "No hay imágenes listas para analizar."
      : `${images.length} ${images.length === 1 ? "imagen lista" : "imágenes listas"} para analizar.`;

  const handleStartAnalysis = () => {
    if (!selectedModel) {
      toast.warning("Selecciona un modelo ML activo para continuar.");
      return;
    }

    setProcessing(true);
    setProgress(0);
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-white/10 pb-7">
          <Link
            to="/dashboard"
            className="mb-5 flex w-fit items-center gap-2 text-xs text-white/40 transition hover:text-white"
          >
            <LuArrowLeft size={15} />
            Volver al dashboard
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">
            Crear análisis / {String(step + 1).padStart(2, "0")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">
            Nuevo análisis forestal
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Carga tus imágenes satelitales y compara los cambios en el tiempo.
          </p>
        </header>

        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={index >= step}
                onClick={() => {
                  if (index < step) setStep(index);
                }}
                aria-label={`Volver al paso ${index + 1}: ${label}`}
                className={`flex shrink-0 items-center gap-2 rounded-lg text-left ${index < step ? "cursor-pointer hover:text-white" : "cursor-default"}`}
              >
                <span
                  className={`grid size-8 place-items-center rounded-full text-xs font-bold ${index < step ? "bg-[#b9e75c] text-[#10261d]" : index === step ? "border border-[#b9e75c] text-[#b9e75c]" : "border border-white/15 text-white/35"}`}
                >
                  {index < step ? <LuCheck size={15} /> : index + 1}
                </span>
                <span
                  className={`hidden text-xs sm:block ${index === step ? "font-semibold text-white" : index < step ? "text-white/60" : "text-white/35"}`}
                >
                  {label}
                </span>
              </button>
              {index < steps.length - 1 && (
                <span className="h-px flex-1 bg-white/10" />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1728] p-6">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Información del análisis
              </h2>
              <p className="mt-2 text-sm text-white/45">
                Identifica el área y el objetivo de este monitoreo.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="text-sm text-white/75">
                Nombre del análisis
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="text-sm text-white/75">
                Zona o ubicación
                <div className="relative">
                  <LuMapPin
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                    size={17}
                  />
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    className={`${inputClass} pl-11`}
                  />
                </div>
              </label>
            </div>
            <label className="block text-sm text-white/75">
              Descripción <span className="text-white/25">(opcional)</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe brevemente el objetivo del análisis"
                rows="4"
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#b9e75c]/70"
              />
            </label>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1728] p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Carga tus imágenes
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  Puedes cargar varias escenas .TIF de diferentes años.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRemoveAllImages}
                disabled={!images.length}
                className="flex h-10 items-center justify-center gap-2 rounded-xl border border-red-300/20 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <LuTrash2 size={15} />
                Eliminar todas
              </button>
            </div>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.025] text-center transition hover:border-[#b9e75c]/60">
              <LuCloudUpload className="mb-3 text-[#b9e75c]" size={28} />
              <span className="text-sm font-medium text-white">
                Arrastra tus imágenes .TIF aquí
              </span>
              <span className="mt-2 text-xs text-white/35">
                o selecciona varios archivos
              </span>
              <input
                type="file"
                multiple
                accept=".tif,.tiff"
                onChange={handleFiles}
                className="sr-only"
              />
            </label>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">
                {images.length} imágenes cargadas
              </span>
              <span className="text-white/40">
                Periodo: {images[0]?.year} – {images[images.length - 1]?.year}
              </span>
            </div>
            <div className="divide-y divide-white/10 rounded-xl border border-white/10">
              {images.map((image) => (
                <div key={image.id} className="flex items-center gap-3 p-4">
                  <div className="grid size-9 place-items-center rounded-lg bg-[#b9e75c]/10 text-[#b9e75c]">
                    <LuFileImage size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white">
                      {image.name}
                    </p>
                    <p className="mt-1 text-xs text-white/35">
                      {image.size} · {image.date}
                    </p>
                  </div>
                  <span className="text-xs text-[#b9e75c]">
                    Lista para analizar
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(image.id)}
                    className="ml-2 text-white/25 transition hover:text-red-300"
                    aria-label={`Eliminar imagen ${image.year}`}
                  >
                    <LuTrash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-6 rounded-2xl border border-white/10 bg-[#0b1728] p-6">
            <div>
              <h2 className="text-xl font-semibold text-white">
                Configura los periodos
              </h2>
              <p className="mt-2 text-sm text-white/45">
                Elige cómo quieres comparar la evolución de tu zona.
              </p>
            </div>
            <div className="overflow-x-auto pb-2">
              <div className="flex min-w-[560px] items-center">
                {images.map((image, index) => {
                  const isHighlighted = highlightedImageIds.has(image.id);
                  const nextImage = images[index + 1];
                  const isConnectingHighlighted =
                    isHighlighted &&
                    nextImage &&
                    highlightedImageIds.has(nextImage.id);

                  return (
                    <div key={image.id} className="flex flex-1 items-center">
                      <div
                        className={`grid size-10 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors ${isHighlighted ? "border-[#b9e75c]/60 bg-[#b9e75c]/10 text-[#b9e75c]" : "border-white/10 bg-white/[0.03] text-white/25"}`}
                      >
                        {image.year}
                      </div>
                      {index < images.length - 1 && (
                        <div
                          className={`h-px flex-1 transition-colors ${isConnectingHighlighted ? "bg-[#b9e75c]/30" : "bg-white/10"}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                [
                  "complete",
                  "Análisis completo",
                  "Analizar automáticamente todos los periodos disponibles.",
                ],
                [
                  "specific",
                  "Comparación específica",
                  "Analizar todos los periodos entre una imagen inicial y una final.",
                ],
                [
                  "manual",
                  "Selección manual",
                  "Elegir hasta 2 imágenes concretas para comparar.",
                ],
              ].map(([value, title, copy]) => {
                const isComparisonMode = value !== "complete";
                const isDisabled = isComparisonMode && images.length < 2;

                return (
                  <button
                    key={value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setMode(value)}
                    className={`rounded-xl border p-5 text-left transition ${mode === value ? "border-[#b9e75c] bg-[#b9e75c]/[0.06]" : "border-white/10 bg-white/[0.02]"} ${isDisabled ? "cursor-not-allowed opacity-40" : "hover:border-[#b9e75c]/60"}`}
                  >
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-2 text-xs leading-5 text-white/45">
                      {isDisabled
                        ? "Necesitas al menos 2 imágenes cargadas."
                        : copy}
                    </p>
                  </button>
                );
              })}
            </div>
            {mode === "specific" && (
              <div className="grid gap-4 rounded-xl border border-[#b9e75c]/20 bg-[#b9e75c]/[0.04] p-4 md:grid-cols-2">
                <label className="text-sm text-white/65">
                  Periodo inicial
                  <select
                    value={specificStartId}
                    onChange={(event) => {
                      setSpecificStartId(event.target.value);
                    }}
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b1728] px-3 text-sm text-white outline-none focus:border-[#b9e75c]/70"
                  >
                    <option value="">Selecciona una imagen</option>
                    {images.map((image) => (
                      <option key={image.id} value={image.id}>
                        {image.date} · {image.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-white/65">
                  Periodo final
                  <select
                    value={specificEndId}
                    onChange={(event) => {
                      setSpecificEndId(event.target.value);
                    }}
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#0b1728] px-3 text-sm text-white outline-none focus:border-[#b9e75c]/70"
                  >
                    <option value="">Selecciona una imagen</option>
                    {images.map((image) => (
                      <option key={image.id} value={image.id}>
                        {image.date} · {image.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {mode === "manual" && (
              <div className="space-y-4 rounded-xl border border-[#b9e75c]/20 bg-[#b9e75c]/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      Selecciona las imágenes a comparar
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Puedes seleccionar máximo 2 imágenes.
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[#b9e75c]">
                    {manualSelectedImages.length}/2 seleccionadas
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {images.map((image) => {
                    const isSelected = manualImageIds.includes(image.id);
                    const isDisabled =
                      !isSelected && manualSelectedImages.length >= 2;

                    return (
                      <label
                        key={image.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${isSelected ? "border-[#b9e75c] bg-[#b9e75c]/[0.08]" : "border-white/10 bg-white/[0.02]"} ${isDisabled ? "cursor-not-allowed opacity-40" : "hover:border-[#b9e75c]/60"}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isDisabled}
                          onChange={() => {
                            setManualImageIds((current) =>
                              isSelected
                                ? current.filter((id) => id !== image.id)
                                : [...current, image.id],
                            );
                          }}
                          className="size-4 accent-[#b9e75c]"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-white">
                            {image.name}
                          </span>
                          <span className="mt-1 block text-xs text-white/40">
                            {image.date}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-white/35">
              <LuCalendarDays size={15} />
              {mode === "complete"
                ? completeModeSummary
                : mode === "specific" && selectedStartImage && selectedEndImage
                  ? `Comparación: ${selectedStartImage.date} → ${selectedEndImage.date} · ${specificSelectedImages.length} imágenes`
                  : mode === "manual" && manualSelectedImages.length
                    ? `Comparación: ${manualSelectedImages.map((image) => image.date).join(" → ")}`
                    : "Selecciona los periodos que deseas comparar"}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-7 rounded-2xl border border-white/10 bg-[#0b1728] p-6 sm:p-7">
            <header className="border-b border-white/10 pb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b9e75c]">
                Revisión final
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                Todo listo para procesar
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
                Verifica la información del análisis y los periodos que serán
                procesados antes de comenzar.
              </p>
            </header>

            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="space-y-5 lg:border-r lg:border-white/10 lg:pr-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                    Información general
                  </p>
                  <dl className="mt-4 divide-y divide-white/10">
                    <div className="flex items-start justify-between gap-5 py-3 first:pt-0">
                      <dt className="text-sm text-white/40">Nombre</dt>
                      <dd className="max-w-[65%] text-right text-sm font-medium text-white">
                        {name || "Sin nombre"}
                      </dd>
                    </div>
                    <div className="flex items-start justify-between gap-5 py-3 last:pb-0">
                      <dt className="flex items-center gap-2 text-sm text-white/40">
                        <LuMapPin size={14} />
                        Ubicación
                      </dt>
                      <dd className="max-w-[65%] text-right text-sm font-medium text-white">
                        {location || "Sin ubicación"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                  Configuración del procesamiento
                </p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="border-l-2 border-[#b9e75c] pl-4">
                    <p className="text-xs text-white/40">Imágenes a analizar</p>
                    <p className="mt-1 text-3xl font-semibold text-white">
                      {selectedAnalysisImages.length}
                    </p>
                    <p className="mt-1 text-xs text-white/35">
                      {selectedAnalysisImages.length === 1
                        ? "imagen seleccionada"
                        : "imágenes seleccionadas"}
                    </p>
                  </div>
                  <div className="border-l-2 border-white/20 pl-4">
                    <p className="text-xs text-white/40">Modo seleccionado</p>
                    <p className="mt-2 text-sm font-semibold text-[#b9e75c]">
                      {analysisModeLabel}
                    </p>
                  </div>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">
                    <LuCalendarDays size={14} />
                    Periodos a analizar
                  </div>
                  <p className="mt-2 text-base font-semibold text-white">
                    {analysisPeriodLabel}
                  </p>
                </div>
                <div className="border-t border-white/10 pt-4">
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/35">
                    <LuBrainCircuit size={14} />
                    Modelo ML activo
                  </label>
                  <select
                    value={selectedModelId ?? ""}
                    onChange={(event) =>
                      setSelectedModelId(Number(event.target.value))
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-white outline-none transition focus:border-[#b9e75c]/70"
                  >
                    <option value="">Selecciona un modelo</option>
                    {activeModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.name} · {model.version}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {processing || progress === 100 ? (
              <div className="mt-8 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-white">
                    {progress === 100
                      ? "Análisis completado"
                      : "Analizando imágenes satelitales..."}
                  </span>
                  <span className="text-[#b9e75c]">{progress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#b9e75c] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="grid gap-3 text-xs text-white/45 sm:grid-cols-2">
                  <span className={progress > 20 ? "text-[#b9e75c]" : ""}>
                    ✓ Cargando imágenes
                  </span>
                  <span className={progress > 45 ? "text-[#b9e75c]" : ""}>
                    ✓ Procesando bandas espectrales
                  </span>
                  <span className={progress > 65 ? "text-[#b9e75c]" : ""}>
                    ● Calculando índices
                  </span>
                  <span className={progress > 85 ? "text-[#b9e75c]" : ""}>
                    ○ Identificando cambios
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleStartAnalysis}
                className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b9e75c] text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"
              >
                <LuPlay size={16} />
                Ejecutar análisis con {selectedModel?.name || "modelo ML"}
              </button>
            )}
          </section>
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(current - 1, 0))}
            disabled={step === 0}
            className="flex items-center gap-2 text-sm text-white/40 transition hover:text-white disabled:invisible"
          >
            <LuArrowLeft size={16} />
            Anterior
          </button>
          {step < 3 && (
            <button
              type="button"
              onClick={handleContinue}
              className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.14]"
            >
              Continuar <LuArrowRight size={16} />
            </button>
          )}
          {step === 3 && progress === 100 && (
            <button
              type="button"
              onClick={() => navigate("/dashboard/results")}
              className="flex items-center gap-2 rounded-xl bg-[#b9e75c] px-4 py-2.5 text-sm font-bold text-[#10261d]"
            >
              Ver resultados <LuArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

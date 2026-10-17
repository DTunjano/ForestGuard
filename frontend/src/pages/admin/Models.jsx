import { useMemo, useState } from "react";
import {
  LuBrainCircuit,
  LuCheck,
  LuChevronDown,
  LuCpu,
  LuPencil,
  LuPlus,
  LuSearch,
  LuTrash2,
  LuUpload,
  LuX,
} from "react-icons/lu";
import { MainLayout } from "../../components/layout/MainLayout";

const initialModels = [
  {
    id: 1,
    name: "ForestGuard Vision",
    version: "v2.4.1",
    type: "Deforestación",
    fileName: "forestguard-vision-v2.4.1.onnx",
    description: "Detecta cambios de cobertura forestal en escenas Sentinel-2.",
    status: "Activo",
    updatedAt: "Actualizado hace 2 días",
  },
  {
    id: 2,
    name: "NDVI Degradation",
    version: "v1.8.0",
    type: "Degradación",
    fileName: "ndvi-degradation-v1.8.0.pt",
    description: "Clasifica señales de degradación a partir de índices NDVI.",
    status: "Activo",
    updatedAt: "Actualizado hace 8 días",
  },
  {
    id: 3,
    name: "Fire Risk Classifier",
    version: "v1.2.3",
    type: "Incendios",
    fileName: "fire-risk-classifier-v1.2.3.h5",
    description: "Estima zonas con posibles señales de incendio forestal.",
    status: "Inactivo",
    updatedAt: "Actualizado hace 3 semanas",
  },
];

const emptyForm = {
  name: "",
  version: "",
  type: "Deforestación",
  description: "",
  fileName: "",
};

const typeStyles = {
  Deforestación: "bg-red-300/10 text-red-200",
  Degradación: "bg-orange-300/10 text-orange-200",
  Incendios: "bg-rose-300/10 text-rose-200",
};

export const Models = () => {
  const [models, setModels] = useState(initialModels);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [typeFilter, setTypeFilter] = useState("Todos");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const visibleModels = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return models.filter((model) => {
      const matchesSearch =
        !query ||
        model.name.toLowerCase().includes(query) ||
        model.fileName.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "Todos" || model.status === statusFilter;
      const matchesType = typeFilter === "Todos" || model.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [models, searchTerm, statusFilter, typeFilter]);

  const activeModels = models.filter(
    (model) => model.status === "Activo",
  ).length;

  const openCreateForm = () => {
    setEditingModel(null);
    setFormData(emptyForm);
    setIsFormOpen(true);
  };

  const openEditForm = (model) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      version: model.version,
      type: model.type,
      description: model.description,
      fileName: model.fileName,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingModel(null);
    setFormData(emptyForm);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setFormData((current) => ({ ...current, fileName: file.name }));
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (editingModel) {
      setModels((current) =>
        current.map((model) =>
          model.id === editingModel.id ? { ...model, ...formData } : model,
        ),
      );
    } else {
      setModels((current) => [
        {
          ...formData,
          id: Date.now(),
          status: "Activo",
          updatedAt: "Cargado ahora",
        },
        ...current,
      ]);
    }

    closeForm();
  };

  const toggleStatus = (modelId) => {
    setModels((current) =>
      current.map((model) =>
        model.id === modelId
          ? {
              ...model,
              status: model.status === "Activo" ? "Inactivo" : "Activo",
            }
          : model,
      ),
    );
  };

  const deleteModel = (modelId) => {
    setModels((current) => current.filter((model) => model.id !== modelId));
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-400 space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">
              Administración / machine learning
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Modelos de machine learning
            </h1>
            <p className="mt-2 text-sm text-white/45">
              Administra los modelos que procesan y clasifican las imágenes.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#b9e75c] px-4 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"
          >
            <LuPlus size={17} />
            Agregar modelo
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            [String(models.length), "Modelos registrados", LuBrainCircuit],
            [String(activeModels), "Modelos activos", LuCheck],
            ["ONNX · PT · H5", "Formatos compatibles", LuCpu],
          ].map(([value, label, Icon]) => (
            <div
              key={label}
              className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0b1728] p-4"
            >
              <div className="grid size-10 place-items-center rounded-xl bg-[#b9e75c]/10 text-[#b9e75c]">
                <Icon size={19} />
              </div>
              <div>
                <p className="text-2xl font-semibold text-white">{value}</p>
                <p className="mt-1 text-xs text-white/45">{label}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <LuSearch
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                size={17}
              />
              <input
                type="search"
                placeholder="Buscar por nombre o archivo"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#b9e75c]/70"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-[#0b1728] px-3 text-sm text-white/65 outline-none focus:border-[#b9e75c]/70"
              aria-label="Filtrar por tipo de modelo"
            >
              <option>Todos</option>
              <option>Deforestación</option>
              <option>Degradación</option>
              <option>Incendios</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-[#0b1728] px-3 text-sm text-white/65 outline-none focus:border-[#b9e75c]/70"
              aria-label="Filtrar por estado del modelo"
            >
              <option>Todos</option>
              <option>Activo</option>
              <option>Inactivo</option>
            </select>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {visibleModels.length ? (
            visibleModels.map((model) => (
              <article
                key={model.id}
                className="rounded-2xl border border-white/10 bg-[#0b1728] p-5 transition hover:border-white/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#b9e75c]/10 text-[#b9e75c]">
                      <LuBrainCircuit size={20} />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-white">
                        {model.name}
                      </h2>
                      <p className="mt-1 text-xs text-white/35">
                        {model.version} · {model.updatedAt}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 text-xs ${model.status === "Activo" ? "text-[#b9e75c]" : "text-white/35"}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${model.status === "Activo" ? "bg-[#b9e75c]" : "bg-white/25"}`}
                    />
                    {model.status}
                  </span>
                </div>

                <p className="mt-5 text-sm leading-6 text-white/55">
                  {model.description}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${typeStyles[model.type]}`}
                  >
                    {model.type}
                  </span>
                  <span className="truncate rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/45">
                    {model.fileName}
                  </span>
                </div>

                <div className="mt-5 flex justify-end gap-1 border-t border-white/10 pt-4">
                  <button
                    type="button"
                    title="Editar modelo"
                    aria-label={`Editar ${model.name}`}
                    onClick={() => openEditForm(model)}
                    className="grid size-9 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-[#b9e75c]"
                  >
                    <LuPencil size={16} />
                  </button>
                  <button
                    type="button"
                    title={
                      model.status === "Activo"
                        ? "Desactivar modelo"
                        : "Activar modelo"
                    }
                    aria-label={`${model.status === "Activo" ? "Desactivar" : "Activar"} ${model.name}`}
                    onClick={() => toggleStatus(model.id)}
                    className="grid size-9 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-yellow-200"
                  >
                    {model.status === "Activo" ? (
                      <LuX size={16} />
                    ) : (
                      <LuCheck size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    title="Eliminar modelo"
                    aria-label={`Eliminar ${model.name}`}
                    onClick={() => deleteModel(model.id)}
                    className="grid size-9 place-items-center rounded-lg text-white/35 transition hover:bg-red-400/10 hover:text-red-300"
                  >
                    <LuTrash2 size={16} />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="xl:col-span-2 rounded-2xl border border-white/10 bg-[#0b1728] px-5 py-12 text-center text-sm text-white/40">
              No hay modelos que coincidan con los filtros.
            </div>
          )}
        </section>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-60 grid place-items-center bg-[#020812]/80 p-5 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1728] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">
                  Administración
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {editingModel ? "Editar modelo" : "Agregar modelo"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Cerrar formulario"
                className="grid size-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-white"
              >
                <LuX size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-sm text-white/65">
                Nombre del modelo
                <input
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="Ej. ForestGuard Vision"
                  className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#b9e75c]/70"
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-white/65">
                  Versión
                  <input
                    required
                    name="version"
                    value={formData.version}
                    onChange={handleFormChange}
                    placeholder="Ej. v1.0.0"
                    className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#b9e75c]/70"
                  />
                </label>
                <label className="block text-sm text-white/65">
                  Tipo de detección
                  <div className="relative">
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleFormChange}
                      className="mt-2 h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3 pr-10 text-sm text-white outline-none transition focus:border-[#b9e75c]/70"
                    >
                      <option>Deforestación</option>
                      <option>Degradación</option>
                      <option>Incendios</option>
                    </select>
                    <LuChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 mt-1 text-white/40"
                      size={16}
                    />
                  </div>
                </label>
              </div>

              <label className="block text-sm text-white/65">
                Archivo del modelo
                <div className="relative mt-2 flex h-12 items-center gap-3 rounded-xl border border-dashed border-white/20 bg-white/[0.025] px-3 text-sm text-white/45 transition hover:border-[#b9e75c]/60">
                  <LuUpload className="text-[#b9e75c]" size={17} />
                  <span className="truncate">
                    {formData.fileName ||
                      "Selecciona un archivo .onnx, .pt o .h5"}
                  </span>
                  <input
                    type="file"
                    accept=".onnx,.pt,.pth,.h5"
                    onChange={handleFileChange}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    required={!editingModel}
                  />
                </div>
              </label>

              <label className="block text-sm text-white/65">
                Descripción
                <textarea
                  required
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  placeholder="Describe qué analiza este modelo"
                  rows="3"
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none transition placeholder:text-white/20 focus:border-[#b9e75c]/70"
                />
              </label>

              <div className="flex justify-end gap-2 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/60 transition hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#b9e75c] px-4 py-2.5 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"
                >
                  {editingModel ? "Guardar cambios" : "Agregar modelo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

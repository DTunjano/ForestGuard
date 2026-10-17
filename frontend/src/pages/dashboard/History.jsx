import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  LuCalendarDays,
  LuChevronLeft,
  LuChevronRight,
  LuDownload,
  LuEye,
  LuFileImage,
  LuFilter,
  LuSearch,
  LuTrash2,
} from "react-icons/lu";
import { MainLayout } from "../../components/layout/MainLayout";

const analyses = [
  {
    id: 1,
    filename: "sentinel_2024_06.tif",
    size: "24.5 MB",
    images: 4,
    date: "15 Jun 2024, 14:30",
    type: "Deforestación",
    area: "2,121 ha",
    percent: "17.0%",
  },
  {
    id: 2,
    filename: "landsat_2024_05.tif",
    size: "18.7 MB",
    images: 2,
    date: "26 May 2024, 09:15",
    type: "Degradación",
    area: "1,645 ha",
    percent: "14.3%",
  },
  {
    id: 3,
    filename: "sentinel_2024_04.tif",
    size: "21.1 MB",
    images: 6,
    date: "15 Apr 2024, 16:45",
    type: "Deforestación",
    area: "2,756 ha",
    percent: "22.1%",
  },
  {
    id: 4,
    filename: "landsat_2024_03.tif",
    size: "19.2 MB",
    images: 3,
    date: "30 Mar 2024, 11:20",
    type: "Degradación",
    area: "1,234 ha",
    percent: "9.8%",
  },
];

const typeStyles = {
  Deforestación: "bg-red-400/10 text-red-300",
  Degradación: "bg-orange-300/10 text-orange-200",
};

export const History = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("todos");
  const [filterDate, setFilterDate] = useState("todos");
  const [currentPage, setCurrentPage] = useState(1);

  const visibleAnalyses = useMemo(
    () =>
      analyses.filter((item) => {
        const query = searchTerm.toLowerCase();
        const matchesSearch =
          item.filename.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query);
        const matchesType =
          filterType === "todos" || item.type.toLowerCase() === filterType;
        return matchesSearch && matchesType;
      }),
    [filterType, searchTerm],
  );

  const clearFilters = () => {
    setSearchTerm("");
    setFilterType("todos");
    setFilterDate("todos");
  };

  return (
    <MainLayout>
      <div className="mx-auto max-w-400 space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">
              ForestGuard / actividad
            </p>
            <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Historial de análisis
            </h1>
            <p className="mt-2 text-sm text-white/45">
              Revisa tus escenas procesadas y vuelve a consultar sus resultados.
            </p>
          </div>
          <Link
            to="/dashboard/new"
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#b9e75c] px-4 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"
          >
            <LuFileImage size={17} />
            Nuevo análisis
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ["4", "Análisis registrados"],
            ["100%", "Procesamientos completados"],
            ["7,756 ha", "Área total en riesgo"],
          ].map(([value, label]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-[#0b1728] p-4"
            >
              <p className="text-2xl font-semibold text-white">{value}</p>
              <p className="mt-2 text-xs text-white/45">{label}</p>
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
                placeholder="Buscar por archivo o clasificación"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#b9e75c]/70"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-white/30">
              <LuFilter size={15} />
              Filtrar
            </div>
            <select
              value={filterType}
              onChange={(event) => setFilterType(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-[#0b1728] px-3 text-sm text-white/65 outline-none focus:border-[#b9e75c]/70"
            >
              <option value="todos">Todos los tipos</option>
              <option value="deforestación">Deforestación</option>
              <option value="degradación">Degradación</option>
            </select>
            <select
              value={filterDate}
              onChange={(event) => setFilterDate(event.target.value)}
              className="h-11 rounded-xl border border-white/10 bg-[#0b1728] px-3 text-sm text-white/65 outline-none focus:border-[#b9e75c]/70"
            >
              <option value="todos">Todas las fechas</option>
              <option value="ultimo-mes">Último mes</option>
              <option value="ultimo-trimestre">Último trimestre</option>
            </select>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1728]">
          <div className="hidden grid-cols-[minmax(230px,1.5fr)_1fr_1fr_1fr_auto] gap-4 border-b border-white/10 bg-white/[0.03] px-5 py-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35 lg:grid">
            <span>Escena</span>
            <span>Fecha</span>
            <span>Clasificación</span>
            <span>Área en riesgo</span>
            <span>Acciones</span>
          </div>

          <div className="divide-y divide-white/10">
            {visibleAnalyses.length ? (
              visibleAnalyses.map((item) => (
                <article
                  key={item.id}
                  className="grid gap-4 px-5 py-5 transition hover:bg-white/[0.025] lg:grid-cols-[minmax(260px,1.8fr)_minmax(120px,1fr)_minmax(100px,0.8fr)_minmax(120px,1fr)_minmax(120px,1fr)_auto] lg:items-center"
                >
                  {/* Archivo */}
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#b9e75c]/10 text-[#b9e75c]">
                      <LuFileImage size={19} />
                    </div>

                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-white"
                        title={item.filename}
                      >
                        {item.filename}
                      </p>

                      <p className="mt-1 text-xs text-white/35">
                        {item.size} · Sentinel-2
                      </p>
                    </div>
                  </div>

                  {/* Fecha */}
                  <div className="min-w-0">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/30 lg:hidden">
                      Fecha
                    </span>

                    <p className="flex items-center gap-2 whitespace-nowrap text-sm text-white/65">
                      <LuCalendarDays
                        className="shrink-0 text-white/30"
                        size={14}
                      />
                      {item.date}
                    </p>
                  </div>

                  {/* Número de imágenes */}
                  <div className="min-w-0">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/30 lg:hidden">
                      Número de imágenes
                    </span>

                    <p className="whitespace-nowrap text-sm font-medium text-white">
                      {item.images}
                    </p>
                  </div>

                  {/* Clasificación */}
                  <div className="min-w-0">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/30 lg:hidden">
                      Clasificación
                    </span>

                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${typeStyles[item.type]}`}
                    >
                      {item.type}
                    </span>
                  </div>

                  {/* Área en riesgo */}
                  <div className="min-w-0">
                    <span className="mb-1 block text-[10px] uppercase tracking-wide text-white/30 lg:hidden">
                      Área en riesgo
                    </span>

                    <p className="whitespace-nowrap text-sm font-medium text-white">
                      {item.area}
                      <span className="ml-1 text-xs text-white/35">
                        ({item.percent})
                      </span>
                    </p>

                    <span className="mt-1 block text-[11px] text-[#b9e75c]">
                      Completado
                    </span>
                  </div>

                  {/* Acciones */}
                  <div className="flex shrink-0 gap-1 lg:justify-end">
                    <button
                      title="Ver resultados"
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-[#b9e75c]"
                    >
                      <LuEye size={16} />
                    </button>

                    <button
                      title="Descargar"
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-white/35 transition hover:bg-white/[0.06] hover:text-[#b9e75c]"
                    >
                      <LuDownload size={16} />
                    </button>

                    <button
                      title="Eliminar"
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-white/35 transition hover:bg-red-400/10 hover:text-red-300"
                    >
                      <LuTrash2 size={16} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-12 text-center">
                <LuSearch className="mx-auto text-white/20" size={28} />
                <p className="mt-3 text-sm text-white/55">
                  No encontramos análisis con esos filtros.
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs font-semibold text-[#b9e75c]"
                >
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        </section>

        <footer className="flex flex-col gap-4 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Mostrando {visibleAnalyses.length} de {analyses.length} resultados
          </p>
          <div className="flex items-center gap-1">
            <button className="grid size-9 place-items-center rounded-lg border border-white/10 transition hover:text-white">
              <LuChevronLeft size={15} />
            </button>
            {[1, 2, 3].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`grid size-9 place-items-center rounded-lg text-xs transition ${currentPage === page ? "bg-[#b9e75c] font-bold text-[#10261d]" : "border border-white/10 hover:bg-white/[0.06] hover:text-white"}`}
              >
                {page}
              </button>
            ))}
            <button className="grid size-9 place-items-center rounded-lg border border-white/10 transition hover:text-white">
              <LuChevronRight size={15} />
            </button>
          </div>
        </footer>
      </div>
    </MainLayout>
  );
};

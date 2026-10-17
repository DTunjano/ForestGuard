import { Link } from "react-router";
import {
  LuArrowUpRight,
  LuCircleHelp,
  LuFileImage,
  LuMap,
  LuPlay,
} from "react-icons/lu";
import { MainLayout } from "../../components/layout/MainLayout";

const topics = [
  [
    "01",
    "Crear un análisis",
    "Define el área, carga las escenas .TIF y configura los periodos que quieres comparar.",
    LuFileImage,
    "/dashboard/new",
  ],
  [
    "02",
    "Leer el mapa",
    "Activa la leyenda para distinguir deforestación, degradación, posible incendio y zonas sin cambio.",
    LuMap,
    "/dashboard/results",
  ],
  [
    "03",
    "Procesar resultados",
    "El modelo clasifica los cambios detectados y presenta una lectura resumida del territorio.",
    LuPlay,
    "/dashboard/results",
  ],
];

export const Help = () => (
  <MainLayout>
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="border-b border-white/10 pb-7">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">
          Centro de ayuda
        </p>
        <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
          Aprende a usar ForestGuard
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/45">
          Una guía rápida para pasar de tus imágenes satelitales a una lectura
          clara de los cambios forestales.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        {topics.map(([number, title, copy, Icon, route]) => (
          <Link
            key={number}
            to={route}
            className="rounded-2xl border border-white/10 bg-[#0b1728] p-5 transition hover:-translate-y-0.5 hover:border-[#b9e75c]/40"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-[0.16em] text-[#b9e75c]">
                {number}
              </span>
              <Icon className="text-white/35" size={20} />
            </div>
            <h2 className="mt-8 text-base font-semibold text-white">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-white/45">{copy}</p>
            <span className="mt-6 flex items-center gap-1 text-xs font-semibold text-[#b9e75c]">
              Abrir sección <LuArrowUpRight size={14} />
            </span>
          </Link>
        ))}
      </section>
      <section className="flex items-start gap-4 rounded-2xl border border-[#b9e75c]/20 bg-[#b9e75c]/[0.05] p-5">
        <LuCircleHelp className="mt-0.5 shrink-0 text-[#b9e75c]" size={21} />
        <div>
          <h2 className="text-sm font-semibold text-white">
            Sobre las clasificaciones
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/50">
            ForestGuard ofrece una clasificación asistida por Machine Learning.
            “Posible incendio” describe una señal detectada y no confirma por sí
            sola un incendio.
          </p>
        </div>
      </section>
    </div>
  </MainLayout>
);

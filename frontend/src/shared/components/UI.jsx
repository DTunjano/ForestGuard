import { cloneElement, useId } from "react";
import { LuCircleAlert, LuInfo, LuTrees, LuArrowUpRight } from "react-icons/lu";
export { Select } from "./Select";
const descriptions = {
  "Nuevo análisis":
    "De una escena a una nueva perspectiva del territorio. Selecciona el área, carga tus imágenes y compara fechas.",
  "Historial de análisis":
    "Tu archivo de observación. Consulta, compara y retoma cada estudio.",
  "Mi perfil": "Gestiona tu identidad y la seguridad de tu cuenta.",
  Usuarios: "Administra el acceso y los permisos de tu equipo.",
  "Áreas de estudio": "Organiza los territorios que quieres observar.",
  "Modelos disponibles":
    "Conoce las herramientas de clasificación disponibles para tus estudios.",
  Ayuda: "Todo lo que necesitas para empezar a observar el territorio.",
};
export function Page({ title, children }) {
  return (
    <div data-page={title} className="fg-page mx-auto max-w-6xl space-y-6">
      <header className="fg-page-header">
        <p className="fg-eyebrow">
          <LuTrees aria-hidden="true" /> ForestGuard / Observación territorial
        </p>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p>
          {descriptions[title] ||
            "Explora tus imágenes y resultados de Sentinel-2 en un solo espacio."}
        </p>
      </header>
      {children}
    </div>
  );
}
export function Panel({ children }) {
  return (
    <section className="fg-panel space-y-4 rounded-2xl border border-white/10 bg-[#0b1728] p-5">
      {children}
    </section>
  );
}
export function Button({ children, variant = "primary", ...props }) {
  return (
    <button
      className={`fg-button fg-button-${variant} rounded-lg px-4 py-2 font-semibold disabled:opacity-50`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label id={`${id}-label`} className="block" htmlFor={id}>
        {label}
      </label>
      {children ? (
        cloneElement(children, { id })
      ) : (
        <input
          id={id}
          className="w-full rounded-lg border border-white/25 bg-[#08111f] p-2"
          {...props}
        />
      )}
    </div>
  );
}
export function Notice({ error, children }) {
  return error ? (
    <p role="alert" className="fg-notice fg-notice-error">
      <LuCircleAlert aria-hidden="true" />
      <span>{error.message || error}</span>
    </p>
  ) : children ? (
    <p role="status" className="fg-notice text-slate-300">
      <LuInfo aria-hidden="true" />
      <span>{children}</span>
    </p>
  ) : null;
}
export function StatusBadge({ status, children }) {
  return (
    <span className={`fg-status fg-status-${status}`}>
      <span aria-hidden="true" />
      {children}
    </span>
  );
}
export function EmptyState({ title, children }) {
  return (
    <div className="fg-empty">
      <LuTrees size={32} aria-hidden="true" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function SectionHeading({ eyebrow, title, children }) {
  return (
    <div className="fg-section-heading">
      <div>
        <p className="fg-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {children && (
        <span>
          {children}
          <LuArrowUpRight aria-hidden="true" />
        </span>
      )}
    </div>
  );
}

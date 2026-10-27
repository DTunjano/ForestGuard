import { useId, useState } from "react";
import { LuChevronDown, LuInfo, LuSlidersHorizontal } from "react-icons/lu";

export function MapDetailsToggle({ open, controls, onToggle }) {
  const hintId = useId();
  const [hintOpen, setHintOpen] = useState(false);
  return (
    <div
      className="fg-map-details-hint"
      onMouseEnter={() => setHintOpen(true)}
      onMouseLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement))
          setHintOpen(false);
      }}
      onFocus={() => setHintOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setHintOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") setHintOpen(false);
      }}
    >
      <button
        type="button"
        className="fg-map-details-toggle"
        aria-expanded={open}
        aria-controls={controls}
        aria-describedby={hintId}
        onClick={() => {
          setHintOpen(false);
          onToggle();
        }}
      >
        <LuSlidersHorizontal
          className="fg-map-details-leading"
          aria-hidden="true"
        />
        <span>{open ? "Ocultar detalles" : "Ver más detalles"}</span>
        <LuInfo className="fg-map-details-info" aria-hidden="true" />
        <LuChevronDown className="fg-map-details-chevron" aria-hidden="true" />
      </button>
      <div
        id={hintId}
        role="tooltip"
        className="fg-map-details-tooltip"
        hidden={!hintOpen}
      >
        Explora los índices de vegetación y humedad para ver más detalles del
        mapa.
      </div>
    </div>
  );
}

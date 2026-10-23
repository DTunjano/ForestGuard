import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { LuX } from "react-icons/lu";

export function Modal({ title, children, onClose, busy = false }) {
  const id = useId();
  const content = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const root = document.getElementById("root");
    const overflow = document.body.style.overflow;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    content.current.focus();
    return () => {
      if (root) root.inert = false;
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  function keyboard(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      if (!busy) onClose();
    }
    if (event.key !== "Tab") return;
    const controls = [
      ...content.current.querySelectorAll(
        'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
      ),
    ].filter(
      (node) =>
        node.getAttribute("aria-hidden") !== "true" &&
        node.getClientRects().length,
    );
    if (!controls.length) {
      event.preventDefault();
      return;
    }
    const first = controls[0],
      last = controls.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === content.current)
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last ||
        document.activeElement === content.current)
    ) {
      event.preventDefault();
      first.focus();
    }
  }
  return createPortal(
    <div
      className="fg-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        className="fg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        aria-busy={busy}
        ref={content}
        tabIndex={-1}
        onKeyDown={keyboard}
      >
        <header>
          <h2 id={id}>{title}</h2>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            aria-label="Cerrar ventana"
          >
            <LuX aria-hidden="true" />
          </button>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}

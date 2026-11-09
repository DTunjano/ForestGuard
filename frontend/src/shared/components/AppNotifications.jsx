import { useEffect } from "react";
import { createPortal } from "react-dom";
import { toast, Toaster } from "sonner";
import { useTheme } from "../theme/ThemeContext";

const validationToast = "form-validation";

function validationMessage(control) {
  const custom =
    control.validity.valueMissing && control.dataset.requiredMessage;
  if (custom) return custom;

  const label = control.labels?.[0]?.textContent.trim();
  if (label && control.validity.valueMissing) {
    if (control.type === "file")
      return `Selecciona un archivo para «${label}».`;
    if (control.type === "checkbox") return `Marca la casilla «${label}».`;
    return `Completa el campo «${label}».`;
  }
  if (control.validity.typeMismatch && control.type === "email")
    return "Escribe una dirección de correo válida.";
  return control.validationMessage;
}

export function AppNotifications() {
  const { theme } = useTheme();

  useEffect(() => {
    function notifyInvalid(event) {
      const control = event.target;
      event.preventDefault();
      const firstInvalid = control.form
        ? Array.from(control.form.elements).find(
            (field) => field.willValidate && !field.validity.valid,
          )
        : control;
      if (control !== firstInvalid) return;

      control.focus();
      toast.warning("Revisa el formulario", {
        id: validationToast,
        description: validationMessage(control),
      });
    }

    const dismissValidation = () => toast.dismiss(validationToast);
    // Invalid events reach the document during capture, including forms in modals.
    document.addEventListener("invalid", notifyInvalid, true);
    document.addEventListener("submit", dismissValidation, true);
    return () => {
      document.removeEventListener("invalid", notifyInvalid, true);
      document.removeEventListener("submit", dismissValidation, true);
    };
  }, []);

  return createPortal(
    <Toaster
      position="top-right"
      theme={theme}
      containerAriaLabel="Notificaciones"
      closeButton
      duration={6500}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Cerrar notificación",
        classNames: {
          toast:
            "relative flex w-full items-start gap-3 rounded-xl border border-[var(--fg-stroke,#496077)] bg-[var(--fg-surface,#122032)] px-4 py-3 pr-12 text-[var(--fg-ink,#e7edf5)] shadow-lg",
          warning: "border-l-4 border-l-[var(--fg-amber-ink,#e9b949)]",
          icon: "mt-0.5 shrink-0 text-[var(--fg-amber-ink,#f0c766)]",
          title: "text-sm font-semibold",
          description:
            "mt-1 break-words text-sm leading-snug text-[var(--fg-muted-ink,#c2d0de)]",
          closeButton:
            "absolute right-2 top-2 grid size-9 place-items-center rounded-md hover:bg-[var(--fg-surface-raised,#223347)]",
        },
      }}
    />,
    document.body,
  );
}

import { LuMoon, LuSun } from "react-icons/lu";
import { useTheme } from "../theme/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const Icon = isLight ? LuSun : LuMoon;
  return (
    <button
      type="button"
      className="fg-theme-toggle"
      onClick={toggleTheme}
      aria-label="Modo claro"
      aria-pressed={isLight}
      title={`Cambiar a modo ${isLight ? "oscuro" : "claro"}`}
    >
      <Icon aria-hidden="true" size={18} />
      <span>Modo {isLight ? "claro" : "oscuro"}</span>
    </button>
  );
}

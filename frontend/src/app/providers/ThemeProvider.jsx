import { useEffect, useState } from "react";
import { ThemeContext } from "../../shared/theme/ThemeContext";
import {
  readTheme,
  saveTheme,
  THEME_KEY,
  validTheme,
} from "../../shared/theme/theme";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => readTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f3f6f4" : "#0b1728");
  }, [theme]);

  useEffect(() => {
    function sync(event) {
      if (event.key === THEME_KEY || event.key === null) {
        setTheme(validTheme(event.newValue) ? event.newValue : "dark");
      }
    }
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    saveTheme(next);
    setTheme(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

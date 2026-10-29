import { AppRoutes } from "./app/routes/AppRoutes";
import { AuthProvider } from "./app/providers/AuthProvider";
import { Toaster } from "sonner";
import { ThemeProvider } from "./app/providers/ThemeProvider";
import { useTheme } from "./shared/theme/ThemeContext";

function ThemedApp() {
  const { theme } = useTheme();
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        theme={theme}
        richColors
        closeButton
        duration={3000}
      />
    </AuthProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

export default App;

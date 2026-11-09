import { AppRoutes } from "./app/routes/AppRoutes";
import { AuthProvider } from "./app/providers/AuthProvider";
import { ThemeProvider } from "./app/providers/ThemeProvider";
import { AppNotifications } from "./shared/components/AppNotifications";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
        <AppNotifications />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

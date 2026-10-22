import { AppRoutes } from "./app/routes/AppRoutes";
import { AuthProvider } from "./app/providers/AuthProvider";
import { Toaster } from "sonner";

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        closeButton
        duration={3000}
      />
    </AuthProvider>
  );
}

export default App;

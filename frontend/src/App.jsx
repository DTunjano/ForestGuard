import { AppRoutes } from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
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

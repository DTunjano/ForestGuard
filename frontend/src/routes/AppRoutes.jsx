import { Route, Routes } from "react-router"
import { Analysis } from "../pages/dashboard/Analysis"

export const AppRoutes = () => {
  return (
    <Routes>

      {/* PUBLICAS */}
      {/* <Route path="/login" element={<Login />} /> */}

      {/* PRIVADAS */}
      <Route path="/" element={<Analysis />} />

      {/* 404 */}
      {/* <Route path="*" element={<NotFound />} /> */}

    </Routes>
  )
}
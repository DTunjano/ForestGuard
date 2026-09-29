import { Route, Routes } from "react-router"
import { Analysis } from "../pages/dashboard/Analysis"
import { Dashboard } from "../pages/dashboard/Dashboard"
import { Login } from "../pages/auth/Login"
import { NewAnalysis } from "../pages/dashboard/NewAnalysis"
import { Register } from "../pages/auth/Register"
import { Results } from "../pages/dashboard/Results"
import { History } from "../pages/dashboard/History"
import { Help } from "../pages/dashboard/Help"
import { Profile } from "../pages/profile/Profile"

export const AppRoutes = () => {
  return (
    <Routes>

      
      <Route path="/auth/login" element={<Login />} /> 
      <Route path="/auth/register" element={<Register />} />
      
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/new" element={<NewAnalysis />} />
      <Route path="/dashboard/analysis" element={<Analysis />} />
      <Route path="/dashboard/history" element={<History />} />
      <Route path="/dashboard/results" element={<Results />} />
      <Route path="/help" element={<Help />} />

      <Route path="/profile" element={<Profile />} />

      
      {/* <Route path="*" element={<NotFound />} /> */}

    </Routes>
  )
}
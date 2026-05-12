import { NavBar } from "./Navbar"

export const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <NavBar />
      <main className="p-4">
        {children}
      </main>

    </div>
  )
}
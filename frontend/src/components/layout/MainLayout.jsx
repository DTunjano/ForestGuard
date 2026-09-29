import { NavBar } from "./NavBar"

export const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <NavBar />
      <main className="min-h-screen px-5 py-6 pl-25 lg:pr-8">
        {children}
      </main>

    </div>
  )
}
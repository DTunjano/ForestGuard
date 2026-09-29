import { NavLink } from "react-router";
import {
  LuCircleHelp,
  LuClock3,
  LuLayoutDashboard,
  LuPlus,
  LuScanLine,
  LuTrees,
} from "react-icons/lu";
import { ProfileDropdown } from "./ProfileDropdown";

export const NavBar = () => {
  const navigation = [
    { to: "/dashboard", label: "Dashboard", icon: LuLayoutDashboard },
    { to: "/dashboard/new", label: "Nuevo análisis", icon: LuPlus },
    { to: "/dashboard/history", label: "Mis análisis", icon: LuClock3 },
    { to: "/dashboard/results", label: "Resultados", icon: LuScanLine },
    { to: "/help", label: "Ayuda", icon: LuCircleHelp },
  ];

  return (
    <aside className="group fixed inset-y-0 left-0 z-50 flex w-19 flex-col overflow-hidden border-r border-white/10 bg-[#0b1728] px-3 py-5 transition-[width] duration-300 ease-out hover:w-64">
      <div className="flex shrink-0 items-center gap-3 overflow-hidden px-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#b9e75c] text-[#10261d] shadow-[0_0_26px_rgba(185,231,92,0.2)]">
          <LuTrees size={22} strokeWidth={2.2} />
        </span>
        <div className="min-w-0 whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <h1 className="text-base font-bold tracking-tight text-white">ForestGuard</h1>
          <p className="text-[10px] uppercase tracking-[0.13em] text-white/40">Inteligencia forestal</p>
        </div>
      </div>

      <div className="my-8 h-px bg-white/10" />

      <nav className="flex flex-1 flex-col gap-2" aria-label="Navegación principal">
        {navigation.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/dashboard"}
            title={label}
            className={({ isActive }) =>
              `flex h-12 shrink-0 items-center justify-center overflow-hidden rounded-xl px-3 text-sm transition group-hover:justify-start ${
                isActive
                  ? "bg-[#b9e75c] text-[#10261d] shadow-[0_8px_24px_rgba(185,231,92,0.12)]"
                  : "text-white/45 hover:bg-white/6 hover:text-white"
              }`
            }
          >
            <Icon className="size-5 shrink-0" />
            <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,margin,opacity] duration-200 group-hover:ml-4 group-hover:max-w-32 group-hover:opacity-100">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 pt-4">
        <ProfileDropdown sidebar />
      </div>
    </aside>
  )
}
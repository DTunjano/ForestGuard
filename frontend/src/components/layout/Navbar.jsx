import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavLink } from "react-router";
import {
  LuCircleHelp,
  LuClock3,
  LuChevronDown,
  LuBrainCircuit,
  LuLayoutDashboard,
  LuPlus,
  LuScanLine,
  LuTrees,
  LuUserRound,
} from "react-icons/lu";
import { ProfileDropdown } from "./ProfileDropdown";
import { useAuth } from "../../features/auth/hooks/useAuth";

const SIDEBAR_EXPANDED_STORAGE_KEY = "forestguard-sidebar-expanded";
const SIDEBAR_SCROLL_STORAGE_KEY = "forestguard-sidebar-scroll";

export const NavBar = () => {
  const [isExpanded, setIsExpanded] = useState(
    () => sessionStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY) === "true",
  );
  const [isNavScrolling, setIsNavScrolling] = useState(false);
  const navRef = useRef(null);
  const navScrollTimeoutRef = useRef(null);
  const [openSections, setOpenSections] = useState(() => ({
    catalogs:
      sessionStorage.getItem("forestguard-section-catalogs") !== "false",
    images: sessionStorage.getItem("forestguard-section-images") !== "false",
    support: sessionStorage.getItem("forestguard-section-support") === "true",
    admin: sessionStorage.getItem("forestguard-section-admin") !== "false",
  }));
  const { isAdmin } = useAuth();

  const setSidebarExpanded = (expanded) => {
    setIsExpanded(expanded);
    sessionStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, String(expanded));
  };

  const expandSidebar = () => {
    setSidebarExpanded(true);
  };

  const collapseSidebar = () => {
    setSidebarExpanded(false);
  };

  useLayoutEffect(() => {
    const savedScrollTop = Number(
      sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY) || 0,
    );
    if (
      navRef.current &&
      Number.isFinite(savedScrollTop) &&
      savedScrollTop > 0
    ) {
      navRef.current.scrollTop = savedScrollTop;
    }
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => setSidebarExpanded(false);
    desktop.addEventListener("change", onResize);
    return () => {
      desktop.removeEventListener("change", onResize);
      window.clearTimeout(navScrollTimeoutRef.current);
    };
  }, []);

  const handleNavScroll = (event) => {
    if (isExpanded) {
      sessionStorage.setItem(
        SIDEBAR_SCROLL_STORAGE_KEY,
        String(event.currentTarget.scrollTop),
      );
    }
    setIsNavScrolling(true);
    window.clearTimeout(navScrollTimeoutRef.current);
    navScrollTimeoutRef.current = window.setTimeout(() => {
      setIsNavScrolling(false);
    }, 700);
  };

  const navigationSections = [
    {
      id: "images",
      label: "Análisis",
      icon: LuScanLine,
      items: [
        { to: "/dashboard", label: "Dashboard", icon: LuLayoutDashboard },
        { to: "/dashboard/new", label: "Nuevo análisis", icon: LuPlus },
        { to: "/dashboard/history", label: "Historial", icon: LuClock3 },
      ],
    },
    {
      id: "catalogs",
      label: "Datos y recursos",
      icon: LuTrees,
      items: [
        { to: "/images", label: "Colección de imágenes", icon: LuScanLine },
        { to: "/study-areas", label: "Áreas de estudio", icon: LuTrees },
        { to: "/models", label: "Modelos", icon: LuBrainCircuit },
      ],
    },
    {
      id: "support",
      label: "Soporte",
      icon: LuCircleHelp,
      items: [{ to: "/help", label: "Ayuda", icon: LuCircleHelp }],
    },
    ...(isAdmin
      ? [
          {
            id: "admin",
            label: "Administración",
            icon: LuUserRound,
            items: [
              { to: "/admin/users", label: "Usuarios", icon: LuUserRound },
              {
                to: "/admin/models",
                label: "Modelos ML",
                icon: LuBrainCircuit,
              },
            ],
          },
        ]
      : []),
  ];

  const toggleSection = (sectionId) => {
    expandSidebar();
    setOpenSections((current) => {
      const nextValue = !current[sectionId];
      sessionStorage.setItem(
        `forestguard-section-${sectionId}`,
        String(nextValue),
      );

      return {
        ...current,
        [sectionId]: nextValue,
      };
    });
  };

  const sectionIsOpen = (sectionId) => isExpanded && openSections[sectionId];

  const sectionClass = (isOpen) =>
    `flex shrink-0 items-center overflow-hidden rounded-xl text-left text-xs font-semibold uppercase tracking-[0.12em] transition ${isExpanded ? "h-11 w-full justify-between px-3" : "mx-auto size-11 justify-center px-0"} ${isOpen ? "text-[#b9e75c]" : "text-slate-400 hover:bg-white/6 hover:text-white"}`;

  const linkClass = (isActive) =>
    `flex h-10 shrink-0 items-center overflow-hidden rounded-lg text-sm transition ${isExpanded ? "justify-start px-3" : "mx-auto size-11 justify-center px-0"} ${isActive ? "bg-[#b9e75c] text-[#10261d] shadow-[0_8px_24px_rgba(185,231,92,0.12)]" : "text-slate-300 hover:bg-white/6 hover:text-white"}`;

  const subtitleClass = (isActive) =>
    `${linkClass(isActive)} ${isExpanded ? "ml-3 w-[calc(100%-0.75rem)] border-l border-white/10 pl-4" : ""}`;

  return (
    <aside
      data-forestguard-sidebar
      data-expanded={isExpanded}
      className={`peer fixed inset-y-0 left-0 z-50 flex flex-col overflow-visible border-r border-white/10 bg-[#0b1728] px-3 py-5 transition-[width] duration-300 ease-out ${isExpanded ? "w-64" : "w-19"}`}
      onMouseEnter={expandSidebar}
      onMouseLeave={collapseSidebar}
    >
      <div
        className={`fg-sidebar-brand flex shrink-0 items-center overflow-hidden ${isExpanded ? "gap-3 px-[5px]" : "justify-center px-0"}`}
      >
        <button
          type="button"
          aria-label={isExpanded ? "Navegación abierta" : "Abrir navegación"}
          aria-expanded={isExpanded}
          onClick={expandSidebar}
          className="fg-brand-button grid size-10 shrink-0 place-items-center rounded-xl bg-[#b9e75c] text-[#10261d]"
        >
          <LuTrees size={22} strokeWidth={2.2} />
        </button>
        <div
          className={`min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-200 ${isExpanded ? "max-w-44 opacity-100" : "max-w-0 opacity-0"}`}
        >
          <h1 className="text-base font-bold tracking-tight text-white">
            ForestGuard
          </h1>
          <p className="text-[10px] uppercase tracking-[0.13em] text-slate-400">
            Inteligencia forestal
          </p>
        </div>
      </div>

      <div className="my-8 h-px bg-white/10" />

      <nav
        ref={navRef}
        className={`fg-sidebar-nav flex flex-1 flex-col gap-4 overflow-y-auto ${isNavScrolling ? "is-scrolling" : ""}`}
        aria-label="Navegación principal"
        onScroll={handleNavScroll}
      >
        {navigationSections.map(({ id, label, icon: SectionIcon, items }) => {
          const isOpen = sectionIsOpen(id);

          return (
            <div key={id} className="shrink-0">
              <button
                type="button"
                title={label}
                aria-expanded={isOpen}
                onClick={() => toggleSection(id)}
                className={sectionClass(isOpen)}
              >
                <span
                  className={`flex min-w-0 items-center ${isExpanded ? "gap-3" : "justify-center gap-0"}`}
                >
                  <SectionIcon className="size-5 shrink-0" />
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-[max-width,margin,opacity] duration-200 ${isExpanded ? "ml-1 max-w-40 opacity-100" : "ml-0 max-w-0 opacity-0"}`}
                  >
                    {label}
                  </span>
                </span>
                {isExpanded && (
                  <LuChevronDown
                    size={15}
                    className={`shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>

              <div
                className="fg-nav-items"
                data-open={isOpen}
                inert={!isOpen}
                aria-hidden={!isOpen}
              >
                <div className="overflow-hidden">
                  <div className="mt-2 flex flex-col gap-1">
                    {items.map(({ to, label: itemLabel, icon: ItemIcon }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={to === "/dashboard"}
                        title={itemLabel}
                        className={({ isActive }) => subtitleClass(isActive)}
                      >
                        <ItemIcon className="size-4 shrink-0" />
                        <span
                          className={`overflow-hidden whitespace-nowrap transition-[max-width,margin,opacity] duration-200 ${isExpanded ? "ml-3 max-w-36 opacity-100" : "ml-0 max-w-0 opacity-0"}`}
                        >
                          {itemLabel}
                        </span>
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 pt-4">
        <ProfileDropdown
          sidebar
          expanded={isExpanded}
          onActivate={expandSidebar}
        />
      </div>
    </aside>
  );
};

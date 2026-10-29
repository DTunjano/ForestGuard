import { NavBar } from "./Navbar";
import { ThemeToggle } from "../../shared/components/ThemeToggle";

export const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[var(--fg-page,#08111f)] text-white">
      <a className="fg-skip" href="#fg-main">
        Saltar al contenido
      </a>
      <NavBar />
      <main
        id="fg-main"
        tabIndex={-1}
        className="fg-main min-h-screen px-5 py-6 pl-25 lg:pr-8 lg:peer-data-[expanded=true]:pl-72"
      >
        <div className="fg-appearance-bar">
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  );
};

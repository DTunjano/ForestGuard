import { NavBar } from "./Navbar";

export const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#08111f] text-white">
      <a className="fg-skip" href="#fg-main">
        Saltar al contenido
      </a>
      <NavBar />
      <main
        id="fg-main"
        tabIndex={-1}
        className="min-h-screen px-5 py-6 pl-25 lg:pr-8 lg:peer-data-[expanded=true]:pl-72"
      >
        {children}
      </main>
    </div>
  );
};

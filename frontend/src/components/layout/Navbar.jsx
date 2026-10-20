import { PiPlantLight } from "react-icons/pi";
export const NavBar = () => {
  return (
    <header className="h-16 border-b border-[#1e293b] bg-[#0b1728] flex items-center px-6">
      
      <div className="flex items-center gap-3 min-w-max">
        <PiPlantLight className="text-5xl text-green-400" />
        <div className="flex flex-col leading-tight">
          <h1 className="text-xl font-bold text-green-400">
            ForestGuard
          </h1>

          <p className="text-sm text-gray-400">
            Análisis de Imágenes Satelitales
          </p>
        </div>
      </div>

      <nav className="flex gap-8 text-sm flex-1 justify-center">
        <button className="text-gray-400">Análisis</button>
        <button className="text-gray-400">Historial</button>
        <button className="text-gray-400">Modelos</button>
        <button className="text-gray-400">Reportes</button>
      </nav>

      <div className="flex items-center gap-3 min-w-max">
        <div className="w-10 h-10 rounded-full bg-gray-600"></div>

        <div>
          <p className="text-sm font-semibold">Usuario</p>
          <p className="text-xs text-gray-400">Analista</p>
        </div>
      </div>

    </header>
  )
}
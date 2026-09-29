import { useState } from 'react'
import { MainLayout } from '../../components/layout/MainLayout'

export const History = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('todos')
  const [filterDate, setFilterDate] = useState('todos')
  const [currentPage, setCurrentPage] = useState(1)

  // Datos mock
  const mockData = [
    {
      id: 1,
      image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=100&h=100&fit=crop',
      filename: 'sentinel_2024_06.tif',
      fileSize: '24.5 MB',
      date: '15 Jun 2024, 14:30',
      type: 'Deforestación',
      result: 'Completado',
      area: '2,121 ha (17.0%)',
    },
    {
      id: 2,
      image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=100&h=100&fit=crop',
      filename: 'landsat_2024_05.tif',
      fileSize: '18.7 MB',
      date: '26 May 2024, 09:15',
      type: 'Degradación',
      result: 'Completado',
      area: '1,645 ha (14.3%)',
    },
    {
      id: 3,
      image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=100&h=100&fit=crop',
      filename: 'sentinel_2024_04.tif',
      fileSize: '21.1 MB',
      date: '15 Apr 2024, 16:45',
      type: 'Deforestación',
      result: 'Completado',
      area: '2,756 ha (22.1%)',
    },
    {
      id: 4,
      image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=100&h=100&fit=crop',
      filename: 'landsat_2024_03.tif',
      fileSize: '19.2 MB',
      date: '30 Mar 2024, 11:20',
      type: 'Degradación',
      result: 'Completado',
      area: '1,234 ha (9.8%)',
    },
  ]

  const itemsPerPage = 10

  return (
    <MainLayout>
      <div className="space-y-6">

        {/* ENCABEZADO */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Historial de análisis</h1>
          <p className="text-gray-400">Consulta y revela a ver tus análisis anteriores</p>
        </div>

        {/* FILTROS Y BÚSQUEDA */}
        <div className="flex flex-col sm:flex-row gap-4">
          
          {/* Búsqueda */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar análisis..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-3 pl-12 bg-[#0b1728] border border-[#1e293b] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                🔍
              </span>
            </div>
          </div>

          {/* Filtro Tipo */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-3 bg-[#0b1728] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition cursor-pointer"
          >
            <option value="todos">Todos los tipos</option>
            <option value="deforestacion">Deforestación</option>
            <option value="degradacion">Degradación</option>
          </select>

          {/* Filtro Fecha */}
          <select
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-4 py-3 bg-[#0b1728] border border-[#1e293b] rounded-xl text-white focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 transition cursor-pointer"
          >
            <option value="todos">Todas las fechas</option>
            <option value="ultima-semana">Última semana</option>
            <option value="ultimo-mes">Último mes</option>
            <option value="ultimo-trimestre">Último trimestre</option>
          </select>

        </div>

        {/* TABLA */}
        <div className="bg-[#0b1728] rounded-2xl border border-[#1e293b] overflow-hidden">
          
          {/* Header Tabla */}
          <div className="hidden lg:grid lg:grid-cols-12 gap-4 p-4 bg-[#1a2332] border-b border-[#1e293b]">
            <div className="col-span-3 text-sm font-semibold text-gray-300 uppercase tracking-wider">Imagen</div>
            <div className="col-span-2 text-sm font-semibold text-gray-300 uppercase tracking-wider">Fecha</div>
            <div className="col-span-2 text-sm font-semibold text-gray-300 uppercase tracking-wider">Tipo de análisis</div>
            <div className="col-span-1 text-sm font-semibold text-gray-300 uppercase tracking-wider">Resultado</div>
            <div className="col-span-2 text-sm font-semibold text-gray-300 uppercase tracking-wider">Área en riesgo</div>
            <div className="col-span-2 text-sm font-semibold text-gray-300 uppercase tracking-wider">Acciones</div>
          </div>

          {/* Rows Tabla */}
          <div className="divide-y divide-[#1e293b]">
            {mockData.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 hover:bg-[#1a2332]/50 transition items-center"
              >
                {/* IMAGEN Y ARCHIVO */}
                <div className="col-span-1 lg:col-span-3">
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0 w-16 h-16 lg:w-14 lg:h-14">
                      <img
                        src={item.image}
                        alt={item.filename}
                        className="w-full h-full object-cover rounded-lg border border-[#1e293b]"
                      />
                      <div className="absolute inset-0 rounded-lg bg-black/0 hover:bg-black/20 transition flex items-center justify-center">
                        <span className="text-xl opacity-0 hover:opacity-100 transition">🔍</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {item.filename}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {item.fileSize}
                      </p>
                    </div>
                  </div>
                </div>

                {/* FECHA */}
                <div className="col-span-1 lg:col-span-2">
                  <label className="lg:hidden text-xs text-gray-400 font-medium">Fecha:</label>
                  <p className="text-sm text-white mt-1 lg:mt-0">
                    {item.date}
                  </p>
                </div>

                {/* TIPO DE ANÁLISIS */}
                <div className="col-span-1 lg:col-span-2">
                  <label className="lg:hidden text-xs text-gray-400 font-medium">Tipo:</label>
                  <p className="text-sm text-white mt-1 lg:mt-0">
                    {item.type}
                  </p>
                </div>

                {/* RESULTADO */}
                <div className="col-span-1 lg:col-span-1">
                  <label className="lg:hidden text-xs text-gray-400 font-medium">Resultado:</label>
                  <div className="mt-1 lg:mt-0">
                    <span className="inline-block px-3 py-1 bg-green-500/20 text-green-400 text-xs font-semibold rounded-full">
                      {item.result}
                    </span>
                  </div>
                </div>

                {/* ÁREA EN RIESGO */}
                <div className="col-span-1 lg:col-span-2">
                  <label className="lg:hidden text-xs text-gray-400 font-medium">Área:</label>
                  <p className="text-sm text-white mt-1 lg:mt-0">
                    {item.area}
                  </p>
                </div>

                {/* ACCIONES */}
                <div className="col-span-1 lg:col-span-2">
                  <label className="lg:hidden text-xs text-gray-400 font-medium">Acciones:</label>
                  <div className="flex gap-2 mt-3 lg:mt-0">
                    {/* Visualizar */}
                    <button
                      className="p-2 hover:bg-[#1e293b] rounded-lg transition text-gray-400 hover:text-green-400"
                      title="Visualizar"
                    >
                      👁️
                    </button>

                    {/* Descargar */}
                    <button
                      className="p-2 hover:bg-[#1e293b] rounded-lg transition text-gray-400 hover:text-green-400"
                      title="Descargar reporte"
                    >
                      ⬇️
                    </button>

                    {/* Copiar */}
                    <button
                      className="p-2 hover:bg-[#1e293b] rounded-lg transition text-gray-400 hover:text-green-400"
                      title="Copiar"
                    >
                      📋
                    </button>

                    {/* Eliminar */}
                    <button
                      className="p-2 hover:bg-red-500/20 rounded-lg transition text-gray-400 hover:text-red-400"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* PAGINACIÓN */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            Mostrando 1-{Math.min(itemsPerPage, mockData.length)} de {mockData.length} resultados
          </p>
          
          <div className="flex gap-2">
            <button className="px-3 py-2 bg-[#1a2332] hover:bg-[#1e293b] text-gray-400 hover:text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
              ←
            </button>
            
            {[1, 2, 3].map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-2 rounded-lg transition ${
                  currentPage === page
                    ? 'bg-green-600 text-white'
                    : 'bg-[#1a2332] hover:bg-[#1e293b] text-gray-400 hover:text-white'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button className="px-3 py-2 bg-[#1a2332] hover:bg-[#1e293b] text-gray-400 hover:text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">
              →
            </button>
          </div>
        </div>

      </div>
    </MainLayout>
  )
}

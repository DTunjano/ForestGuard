import { MainLayout } from "../../components/layout/MainLayout"

export const Analysis = () => {
  return (
    <MainLayout>
      <div className="space-y-4">

        {/* SECCIÓN SUPERIOR */}
        <div className="grid grid-cols-12 gap-4">

          {/* CARGA DE IMAGEN */}
          <section className="col-span-3 bg-[#0b1728] rounded-2xl p-4 border border-[#1e293b]">

            <h2 className="font-semibold text-lg mb-6">
              1. CARGAR IMAGEN
            </h2>

            {/* DROPZONE */}
            <div className="border-2 border-dashed border-[#334155] rounded-2xl h-52 flex items-center justify-center text-gray-400 text-sm cursor-pointer hover:border-green-500 transition">
              Arrastra una imagen .tif
            </div>

            {/* PREVIEW */}
            <div className="mt-6">

              <p className="text-sm text-gray-400 mb-2">
                Vista previa
              </p>

              <div className="rounded-xl overflow-hidden border border-[#1e293b]">
                <img
                  src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e"
                  className="w-full h-52 object-cover"
                />
              </div>

            </div>

            {/* BOTÓN */}
            <button className="mt-6 w-full bg-green-600 hover:bg-green-500 transition p-3 rounded-xl font-semibold">
              Procesar imagen
            </button>

          </section>

          {/* VISUALIZACIÓN */}
          <section className="col-span-9 bg-[#0b1728] rounded-2xl p-4 border border-[#1e293b]">

            <h2 className="font-semibold text-lg mb-4">
              2. VISUALIZACIÓN
            </h2>

            <div className="grid grid-cols-2 gap-4">

              <div className="bg-black rounded-xl overflow-hidden border border-[#1e293b]">
                <img
                  src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e"
                  className="w-full h-125 object-cover"
                />
              </div>

              <div className="bg-black rounded-xl overflow-hidden border border-[#1e293b]">
                <img
                  src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e"
                  className="w-full h-125 object-cover opacity-70"
                />
              </div>

            </div>

          </section>

        </div>

        {/* RESULTADOS */}
        <section className="grid grid-cols-5 gap-4">

          <div className="bg-[#0b1728] p-4 rounded-2xl border border-[#1e293b]">
            <p className="text-sm text-gray-400">
              Área total
            </p>

            <h3 className="text-2xl font-bold mt-2">
              12,456 ha
            </h3>
          </div>

          <div className="bg-[#0b1728] p-4 rounded-2xl border border-[#1e293b]">
            <p className="text-sm text-green-400">
              Bosque saludable
            </p>

            <h3 className="text-2xl font-bold mt-2">
              7,215 ha
            </h3>
          </div>

          <div className="bg-[#0b1728] p-4 rounded-2xl border border-[#1e293b]">
            <p className="text-sm text-yellow-400">
              Degradación
            </p>

            <h3 className="text-2xl font-bold mt-2">
              3,120 ha
            </h3>
          </div>

          <div className="bg-[#0b1728] p-4 rounded-2xl border border-[#1e293b]">
            <p className="text-sm text-red-400">
              Alto riesgo
            </p>

            <h3 className="text-2xl font-bold mt-2">
              2,121 ha
            </h3>
          </div>

          <div className="bg-[#0b1728] p-4 rounded-2xl border border-[#1e293b]">
            <p className="text-sm text-gray-400">
              Confianza
            </p>

            <h3 className="text-2xl font-bold mt-2">
              87.3%
            </h3>
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

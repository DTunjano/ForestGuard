import { LuArrowUpRight, LuCloudUpload, LuFileImage, LuInfo, LuPlay, LuScanLine } from "react-icons/lu"
import { MainLayout } from "../../components/layout/MainLayout"

export const Analysis = () => {
  return (
    <MainLayout>
      <div className="mx-auto max-w-400 space-y-7">
        <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-6 md:flex-row md:items-end">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">Centro de monitoreo / 01</p>
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Nuevo análisis</h1>
            <p className="mt-2 max-w-xl text-sm text-white/45">Carga una escena satelital para identificar cambios en la cobertura forestal.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/45"><span className="size-2 rounded-full bg-[#b9e75c] shadow-[0_0_12px_#b9e75c]" />Modelo NDVI activo <span className="text-white/20">·</span> v2.4</div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(250px,0.3fr)_minmax(0,0.7fr)]">
          <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-5">
            <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">Paso 01</p><h2 className="mt-2 text-xl font-semibold text-white">Fuente de datos</h2></div><LuFileImage className="text-white/30" size={22} /></div>
            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/2.5 px-5 text-center transition hover:border-[#b9e75c]/70 hover:bg-[#b9e75c]/4">
              <LuCloudUpload className="mb-3 text-[#b9e75c]" size={28} />
              <span className="text-sm font-medium text-white">Arrastra tu imagen aquí</span>
              <span className="mt-2 text-xs text-white/35">o selecciona un archivo GeoTIFF</span>
              <input type="file" accept=".tif,.tiff" className="sr-only" />
            </label>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-white/4 p-3"><div className="grid size-9 place-items-center rounded-lg bg-[#b9e75c]/10 text-[#b9e75c]"><LuFileImage size={17} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-white">bosque_amazonas_042.tif</p><p className="mt-1 text-[11px] text-white/35">12.8 MB · Sentinel-2</p></div><span className="text-xs text-[#b9e75c]">Listo</span></div>
            <button className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b9e75c] text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d] focus:outline-none focus:ring-4 focus:ring-[#b9e75c]/20"><LuPlay size={16} />Procesar imagen</button>
          </section>

          <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0b1728] p-5">
            <div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">Paso 02</p><h2 className="mt-2 text-xl font-semibold text-white">Comparar escenas</h2></div><button className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-white/55 transition hover:border-white/25 hover:text-white"><LuScanLine size={15} />Ajustar vista</button></div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black"><img src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1000&h=720&fit=crop" alt="Imagen satelital de referencia" className="h-64 w-full object-cover opacity-80 md:h-88" /><span className="absolute left-3 top-3 rounded-md bg-[#07131c]/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Original</span></div>
              <div className="relative overflow-hidden rounded-xl border border-[#b9e75c]/30 bg-black"><img src="https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1000&h=720&fit=crop" alt="Mapa de cambios detectados" className="h-64 w-full object-cover opacity-55 grayscale md:h-88" /><div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_30%,rgba(185,231,92,0.18)_70%,rgba(239,68,68,0.22))]" /><span className="absolute left-3 top-3 rounded-md bg-[#b9e75c] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#10261d]">Clasificación ML</span></div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45"><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-[#b9e75c]" />Bosque saludable</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-yellow-400" />Degradación</span><span className="flex items-center gap-2"><i className="size-2 rounded-full bg-red-400" />Alto riesgo</span><span className="ml-auto flex items-center gap-1 text-white/30"><LuInfo size={13} />Resolución 10 m</span></div>
          </section>
        </div>

        <section>
          <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">Paso 03</p><h2 className="mt-2 text-xl font-semibold text-white">Resumen de detección</h2></div><button className="hidden items-center gap-1 text-xs font-medium text-[#b9e75c] hover:text-[#d0f47d] sm:flex">Ver informe completo <LuArrowUpRight size={15} /></button></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Área analizada", value: "12,456 ha", note: "Extensión total", tone: "text-white" },
              { label: "Bosque saludable", value: "7,215 ha", note: "57.9% del área", tone: "text-[#b9e75c]" },
              { label: "Degradación", value: "3,120 ha", note: "25.1% del área", tone: "text-yellow-300" },
              { label: "Alto riesgo", value: "2,121 ha", note: "16.9% del área", tone: "text-red-300" },
              { label: "Confianza del modelo", value: "87.3%", note: "Resultado confiable", tone: "text-sky-300" },
            ].map((metric) => <div key={metric.label} className="rounded-2xl border border-white/10 bg-[#0b1728] p-4"><p className="text-xs text-white/45">{metric.label}</p><p className={`mt-3 text-2xl font-semibold tracking-tight ${metric.tone}`}>{metric.value}</p><p className="mt-2 text-[11px] text-white/30">{metric.note}</p></div>)}
          </div>
        </section>
      </div>
    </MainLayout>
  )
}

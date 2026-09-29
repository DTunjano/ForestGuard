import { Link } from 'react-router'
import { LuArrowUpRight, LuCalendarDays, LuChevronRight, LuMapPin, LuPlus, LuScanLine } from 'react-icons/lu'
import { MainLayout } from '../../components/layout/MainLayout'

const analyses = [
  { name: 'Análisis Guamo', period: '2020 – 2026', images: '7 imágenes', date: '29 sep 2026', area: '12,456 ha', status: 'Completado', tags: ['Deforestación', 'Degradación'] },
  { name: 'Reserva La Macarena', period: '2022 – 2026', images: '5 imágenes', date: '18 sep 2026', area: '8,920 ha', status: 'Completado', tags: ['Sin cambio'] },
  { name: 'Corredor Orinoquía', period: '2021 – 2025', images: '4 imágenes', date: '04 ago 2026', area: '6,240 ha', status: 'En revisión', tags: ['Posible incendio'] },
]

export const Dashboard = () => (
  <MainLayout>
    <div className="mx-auto max-w-400 space-y-8">
      <header className="flex flex-col justify-between gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">ForestGuard / Dashboard</p>
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Buenos días, Juan</h1>
          <p className="mt-2 text-sm text-white/45">Continúa monitoreando los cambios de tu territorio.</p>
        </div>
        <Link to="/dashboard/new" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#b9e75c] px-4 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"><LuPlus size={17} />Nuevo análisis</Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[['12', 'Análisis realizados', 'en los últimos 12 meses'], ['84,320', 'Hectáreas analizadas', 'en 4 regiones'], ['87.3%', 'Confianza promedio', 'del modelo ML']].map(([value, label, note]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-[#0b1728] p-5"><p className="text-3xl font-semibold tracking-tight text-white">{value}</p><p className="mt-2 text-sm font-medium text-[#b9e75c]">{label}</p><p className="mt-1 text-xs text-white/35">{note}</p></div>
        ))}
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b9e75c]">Actividad reciente</p><h2 className="mt-2 text-xl font-semibold text-white">Mis análisis</h2></div><Link to="/dashboard/history" className="flex items-center gap-1 text-xs text-white/45 transition hover:text-[#b9e75c]">Ver todos <LuArrowUpRight size={14} /></Link></div>
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1728]">
          {analyses.map((analysis, index) => <div key={analysis.name} className={`flex flex-col gap-4 p-5 transition hover:bg-white/[0.025] md:flex-row md:items-center md:justify-between ${index ? 'border-t border-white/10' : ''}`}>
            <div className="flex min-w-0 items-center gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#b9e75c]/10 text-[#b9e75c]"><LuScanLine size={20} /></div><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-white">{analysis.name}</h3><div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/35"><span className="flex items-center gap-1"><LuCalendarDays size={13} />{analysis.period}</span><span>{analysis.images}</span><span className="flex items-center gap-1"><LuMapPin size={13} />{analysis.area}</span></div></div></div>
            <div className="flex items-center justify-between gap-5 md:justify-end"><div className="flex flex-wrap gap-2">{analysis.tags.map((tag) => <span key={tag} className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[10px] text-white/55">{tag}</span>)}</div><span className={`whitespace-nowrap text-xs ${analysis.status === 'Completado' ? 'text-[#b9e75c]' : 'text-yellow-300'}`}>{analysis.status}</span><Link to="/dashboard/results" aria-label={`Abrir ${analysis.name}`} className="text-white/30 transition hover:text-[#b9e75c]"><LuChevronRight size={18} /></Link></div>
          </div>)}
        </div>
      </section>
    </div>
  </MainLayout>
)

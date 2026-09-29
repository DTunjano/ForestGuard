import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  LuArrowLeft,
  LuArrowRight,
  LuCalendarDays,
  LuCheck,
  LuCloudUpload,
  LuFileImage,
  LuMapPin,
  LuPlay,
  LuTrash2,
} from 'react-icons/lu'
import { MainLayout } from '../../components/layout/MainLayout'

const steps = ['Información', 'Imágenes', 'Periodos', 'Procesar']
const initialImages = [
  { year: '2020', name: 'img_guamo_2020.tif', size: '18.4 MB' },
  { year: '2021', name: 'img_guamo_2021.tif', size: '21.1 MB' },
  { year: '2022', name: 'img_guamo_2022.tif', size: '20.7 MB' },
  { year: '2024', name: 'img_guamo_2024.tif', size: '22.8 MB' },
  { year: '2026', name: 'img_guamo_2026.tif', size: '24.3 MB' },
]

const inputClass = 'mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-[#b9e75c]/70'

export const NewAnalysis = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('Análisis Guamo')
  const [location, setLocation] = useState('Guamo, Tolima')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState(initialImages)
  const [mode, setMode] = useState('complete')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!processing) return undefined
    const timer = setInterval(() => setProgress((value) => Math.min(value + 12, 100)), 260)
    return () => clearInterval(timer)
  }, [processing])

  useEffect(() => {
    if (progress === 100) setProcessing(false)
  }, [progress])

  const handleFiles = (event) => {
    const nextFiles = Array.from(event.target.files || []).map((file, index) => ({
      year: `202${7 + index}`,
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
    }))
    setImages((current) => [...current, ...nextFiles])
  }

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="border-b border-white/10 pb-7">
          <Link to="/dashboard" className="mb-5 flex w-fit items-center gap-2 text-xs text-white/40 transition hover:text-white"><LuArrowLeft size={15} />Volver al dashboard</Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">Crear análisis / {String(step + 1).padStart(2, '0')}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">Nuevo análisis forestal</h1>
          <p className="mt-2 text-sm text-white/45">Carga tus imágenes satelitales y compara los cambios en el tiempo.</p>
        </header>

        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {steps.map((label, index) => <div key={label} className="flex items-center gap-2">
            <div className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${index < step ? 'bg-[#b9e75c] text-[#10261d]' : index === step ? 'border border-[#b9e75c] text-[#b9e75c]' : 'border border-white/15 text-white/35'}`}>{index < step ? <LuCheck size={15} /> : index + 1}</div>
            <span className={`hidden text-xs sm:block ${index === step ? 'font-semibold text-white' : 'text-white/35'}`}>{label}</span>
            {index < steps.length - 1 && <span className="h-px flex-1 bg-white/10" />}
          </div>)}
        </div>

        {step === 0 && <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1728] p-6">
          <div><h2 className="text-xl font-semibold text-white">Información del análisis</h2><p className="mt-2 text-sm text-white/45">Identifica el área y el objetivo de este monitoreo.</p></div>
          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-sm text-white/75">Nombre del análisis<input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} /></label>
            <label className="text-sm text-white/75">Zona o ubicación<div className="relative"><LuMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={17} /><input value={location} onChange={(event) => setLocation(event.target.value)} className={`${inputClass} pl-11`} /></div></label>
          </div>
          <label className="block text-sm text-white/75">Descripción <span className="text-white/25">(opcional)</span><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe brevemente el objetivo del análisis" rows="4" className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-[#b9e75c]/70" /></label>
        </section>}

        {step === 1 && <section className="space-y-5 rounded-2xl border border-white/10 bg-[#0b1728] p-6">
          <div><h2 className="text-xl font-semibold text-white">Carga tus imágenes</h2><p className="mt-2 text-sm text-white/45">Puedes cargar varias escenas .TIF de diferentes años.</p></div>
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.025] text-center transition hover:border-[#b9e75c]/60"><LuCloudUpload className="mb-3 text-[#b9e75c]" size={28} /><span className="text-sm font-medium text-white">Arrastra tus imágenes .TIF aquí</span><span className="mt-2 text-xs text-white/35">o selecciona varios archivos</span><input type="file" multiple accept=".tif,.tiff" onChange={handleFiles} className="sr-only" /></label>
          <div className="flex items-center justify-between text-sm"><span className="font-medium text-white">{images.length} imágenes cargadas</span><span className="text-white/40">Periodo: {images[0]?.year} – {images[images.length - 1]?.year}</span></div>
          <div className="divide-y divide-white/10 rounded-xl border border-white/10">{images.map((image) => <div key={image.year} className="flex items-center gap-3 p-4"><div className="grid size-9 place-items-center rounded-lg bg-[#b9e75c]/10 text-[#b9e75c]"><LuFileImage size={17} /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-white">{image.name}</p><p className="mt-1 text-xs text-white/35">{image.size} · {image.year}</p></div><span className="text-xs text-[#b9e75c]">Lista para analizar</span><button type="button" onClick={() => setImages((current) => current.filter((item) => item.year !== image.year))} className="ml-2 text-white/25 transition hover:text-red-300" aria-label={`Eliminar imagen ${image.year}`}><LuTrash2 size={16} /></button></div>)}</div>
        </section>}

        {step === 2 && <section className="space-y-6 rounded-2xl border border-white/10 bg-[#0b1728] p-6">
          <div><h2 className="text-xl font-semibold text-white">Configura los periodos</h2><p className="mt-2 text-sm text-white/45">Elige cómo quieres comparar la evolución de tu zona.</p></div>
          <div className="overflow-x-auto pb-2"><div className="flex min-w-[560px] items-center">{images.map((image, index) => <div key={image.year} className="flex flex-1 items-center"><div className="grid size-10 shrink-0 place-items-center rounded-full border border-[#b9e75c]/60 bg-[#b9e75c]/10 text-xs font-semibold text-[#b9e75c]">{image.year}</div>{index < images.length - 1 && <div className="h-px flex-1 bg-[#b9e75c]/30" />}</div>)}</div></div>
          <div className="grid gap-3 md:grid-cols-2">{[['complete', 'Análisis completo', 'Analizar automáticamente todos los periodos disponibles.'], ['specific', 'Comparación específica', 'Comparar una imagen inicial con una imagen final.']].map(([value, title, copy]) => <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-xl border p-5 text-left transition ${mode === value ? 'border-[#b9e75c] bg-[#b9e75c]/[0.06]' : 'border-white/10 bg-white/[0.02]'}`}><p className="text-sm font-semibold text-white">{title}</p><p className="mt-2 text-xs leading-5 text-white/45">{copy}</p></button>)}</div>
          <div className="flex items-center gap-2 text-xs text-white/35"><LuCalendarDays size={15} />{mode === 'complete' ? `Se analizarán ${Math.max(images.length - 1, 0)} periodos consecutivos` : 'Selecciona 2 fechas en el siguiente paso'}</div>
        </section>}

        {step === 3 && <section className="rounded-2xl border border-white/10 bg-[#0b1728] p-6"><h2 className="text-xl font-semibold text-white">Procesar análisis</h2><p className="mt-2 text-sm text-white/45">Revisa tu configuración y ejecuta el análisis.</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{[['Análisis', name], ['Ubicación', location], ['Escenas', `${images.length} imágenes · ${mode === 'complete' ? 'completo' : 'específico'}`]].map(([label, value]) => <div key={label} className="rounded-xl bg-white/[0.04] p-4"><p className="text-xs text-white/35">{label}</p><p className="mt-2 text-sm font-semibold text-white">{value}</p></div>)}</div>{processing || progress === 100 ? <div className="mt-8 space-y-4"><div className="flex justify-between text-sm"><span className="text-white">{progress === 100 ? 'Análisis completado' : 'Analizando imágenes satelitales...'}</span><span className="text-[#b9e75c]">{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[#b9e75c] transition-all duration-300" style={{ width: `${progress}%` }} /></div><div className="grid gap-3 text-xs text-white/45 sm:grid-cols-2"><span className={progress > 20 ? 'text-[#b9e75c]' : ''}>✓ Cargando imágenes</span><span className={progress > 45 ? 'text-[#b9e75c]' : ''}>✓ Procesando bandas espectrales</span><span className={progress > 65 ? 'text-[#b9e75c]' : ''}>● Calculando índices</span><span className={progress > 85 ? 'text-[#b9e75c]' : ''}>○ Identificando cambios</span></div></div> : <button type="button" onClick={() => { setProcessing(true); setProgress(0) }} className="mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#b9e75c] text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d]"><LuPlay size={16} />Ejecutar análisis</button>}</section>}

        <div className="flex justify-between"><button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0} className="flex items-center gap-2 text-sm text-white/40 transition hover:text-white disabled:invisible"><LuArrowLeft size={16} />Anterior</button>{step < 3 && <button type="button" onClick={() => setStep((current) => current + 1)} className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.14]">Continuar <LuArrowRight size={16} /></button>}{step === 3 && progress === 100 && <button type="button" onClick={() => navigate('/dashboard/results')} className="flex items-center gap-2 rounded-xl bg-[#b9e75c] px-4 py-2.5 text-sm font-bold text-[#10261d]">Ver resultados <LuArrowRight size={16} /></button>}</div>
      </div>
    </MainLayout>
  )
}

import { useState } from "react";
import {
  LuActivity,
  LuArrowUpRight,
  LuEye,
  LuEyeOff,
  LuLockKeyhole,
  LuScanLine,
  LuSatellite,
  LuShieldCheck,
  LuTrees,
  LuUserRound,
} from "react-icons/lu";
import { Link } from "react-router";

export const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="min-h-screen bg-[#07131c] text-white lg:grid lg:grid-cols-[1.08fr_0.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden border-r border-white/10 bg-[#0d281f] lg:block">
        <img
          src="https://images.unsplash.com/photo-1511497584788-876760111969?w=1600&h=1200&fit=crop"
          alt="Vista aérea de un bosque"
          className="absolute inset-0 h-full w-full object-cover opacity-55 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(4,20,18,0.94)_4%,rgba(4,20,18,0.48)_54%,rgba(7,19,28,0.96)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(185,231,92,0.16),transparent_28%)]" />

        <div className="relative flex min-h-screen flex-col justify-between p-8 xl:p-12">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-3 text-lg font-semibold tracking-tight"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[#b9e75c] text-[#10261d] shadow-[0_0_30px_rgba(185,231,92,0.25)]">
                <LuTrees size={22} strokeWidth={2.2} />
              </span>
              ForestGuard
            </Link>
            <span className="rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
              FG / 01
            </span>
          </div>

          <div className="max-w-xl py-16">
            <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#b9e75c]">
              <span className="h-px w-8 bg-[#b9e75c]" />
              Inteligencia territorial
            </div>
            <h1 className="max-w-lg text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-white xl:text-7xl">
              Cada pixel cuenta para proteger el bosque.
            </h1>
            <p className="mt-7 max-w-md text-base leading-7 text-white/65">
              Detecta cambios, entiende el territorio y convierte imágenes
              satelitales en decisiones accionables.
            </p>
          </div>

          <div className="grid max-w-xl grid-cols-3 gap-3 border-t border-white/15 pt-5 text-xs text-white/65">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[#b9e75c]">
                <LuScanLine size={14} />
                Cobertura
              </div>
              <strong className="text-lg font-medium text-white">94.8%</strong>
              <p className="mt-1">área procesada</p>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-[#b9e75c]">
                <LuActivity size={14} />
                Modelo
              </div>
              <strong className="text-lg font-medium text-white">Activo</strong>
              <p className="mt-1">detección continua</p>
            </div>
            <div>
              <div className="mb-2 flex items-center gap-2 text-[#b9e75c]">
                <LuSatellite size={14} />
                Datos
              </div>
              <strong className="text-lg font-medium text-white">
                Sentinel-2
              </strong>
              <p className="mt-1">última actualización</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen flex-col justify-center bg-[#07131c] px-6 py-10 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <Link
              to="/"
              className="flex items-center gap-3 text-lg font-semibold tracking-tight"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[#b9e75c] text-[#10261d]">
                <LuTrees size={22} />
              </span>
              ForestGuard
            </Link>
          </div>

          <div className="mb-9">
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b9e75c]">
              <LuShieldCheck size={16} />
              Acceso seguro
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              Bienvenido de nuevo
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/50">
              Ingresa para continuar con tu monitoreo forestal.
            </p>
          </div>

          <form className="space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-medium text-white/80"
              >
                Usuario
              </label>
              <div className="group relative">
                <LuUserRound
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-[#b9e75c]"
                  size={18}
                />
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="nombre de usuario"
                  className="h-14 w-full rounded-xl border border-white/10 bg-white/5.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-[#b9e75c]/70 focus:bg-white/8 focus:ring-4 focus:ring-[#b9e75c]/10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-white/80"
              >
                Contraseña
              </label>
              <div className="group relative">
                <LuLockKeyhole
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35 transition-colors group-focus-within:text-[#b9e75c]"
                  size={18}
                />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-14 w-full rounded-xl border border-white/10 bg-white/5.5 pl-12 pr-12 text-sm text-white outline-none transition placeholder:text-white/25 hover:border-white/20 focus:border-[#b9e75c]/70 focus:bg-white/8 focus:ring-4 focus:ring-[#b9e75c]/10"
                />
                <button
                  type="button"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-white"
                >
                  {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="group mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#b9e75c] px-4 text-sm font-bold text-[#10261d] transition hover:bg-[#d0f47d] focus:outline-none focus:ring-4 focus:ring-[#b9e75c]/20 active:scale-[0.99]"
            >
              Iniciar sesión
              <LuArrowUpRight
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                size={18}
              />
            </button>
          </form>

          <div className="mt-9 border-t border-white/10 pt-7 text-center">
            <p className="text-sm text-white/45">
              ¿Aún no tienes una cuenta?{" "}
              <Link
                to="/auth/register"
                className="font-semibold text-[#b9e75c] transition hover:text-[#d0f47d]"
              >
                Regístrate aquí
              </Link>
            </p>
          </div>
          <p className="mt-16 text-center text-[11px] text-white/25">
            ForestGuard © 2026 · Análisis que protege
          </p>
        </div>
      </section>
    </main>
  );
};

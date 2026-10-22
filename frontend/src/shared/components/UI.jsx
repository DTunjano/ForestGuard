import { MainLayout } from "../../components/layout/MainLayout";
import { cloneElement, useId } from "react";
export function Page({ title, children }) {
  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-3xl font-semibold">{title}</h1>
        {children}
      </div>
    </MainLayout>
  );
}
export function Panel({ children }) {
  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-[#0b1728] p-5">
      {children}
    </section>
  );
}
export function Button({ children, ...props }) {
  return (
    <button
      className="rounded-lg bg-[#b9e75c] px-4 py-2 font-semibold text-[#10261d] disabled:cursor-wait disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}
export function Field({ label, children, ...props }) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label className="block" htmlFor={id}>
        {label}
      </label>
      {children ? (
        cloneElement(children, { id })
      ) : (
        <input
          id={id}
          className="w-full rounded-lg border border-white/25 bg-[#08111f] p-2"
          {...props}
        />
      )}
    </div>
  );
}
export function Notice({ error, children }) {
  return error ? (
    <p
      role="alert"
      className="rounded-lg border border-red-400/40 p-3 text-red-200"
    >
      {error.message || error}
    </p>
  ) : children ? (
    <p role="status" className="text-slate-300">
      {children}
    </p>
  ) : null;
}
export function Select(props) {
  return (
    <select
      className="w-full rounded-lg border border-white/25 bg-[#08111f] p-2"
      {...props}
    />
  );
}

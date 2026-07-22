"use client"

import { useActionState } from "react"
import { provisionTenantAction, type ProvisionState } from "./actions"

const initial: ProvisionState = {}

const TIPOS = ["ALCALDIA", "PERSONERIA", "GOBERNACION", "MINISTERIO"]

export function ProvisionForm() {
  const [state, action, pending] = useActionState(provisionTenantAction, initial)

  return (
    <form action={action} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-700">Provisionar nuevo tenant</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Slug</span>
          <input
            name="slug"
            required
            placeholder="armenia"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Nombre</span>
          <input
            name="nombre"
            required
            placeholder="Alcaldía de Armenia"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Tipo de entidad</span>
          <select
            name="tipoEntidad"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>
      <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400">Admin inicial del tenant</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Nombre</span>
          <input name="adminNombre" required placeholder="Nombre" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Apellido</span>
          <input name="adminApellido" required placeholder="Apellido" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Correo</span>
          <input name="adminEmail" type="email" required placeholder="admin@entidad.gov.co" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Dominio gestionado: <code>&lt;slug&gt;.ossgovernmentone.lat</code>. Crea una BD Neon dedicada
        (puede tardar unos segundos), siembra la estructura base (dependencias/cargos) según el tipo
        de entidad, y crea el admin SIN contraseña — se fija aparte con
        <code> scripts/seed-usuario-tenant.ts</code> (nunca por este formulario).
      </p>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Provisionando…" : "Provisionar tenant"}
      </button>
      {state.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.ok && (
        <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          ✅ {state.mensaje}
        </p>
      )}
    </form>
  )
}

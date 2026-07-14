"use client"

import { useActionState, useState } from "react"
import { guardarBloqueAction, type GuardarState } from "../actions"
import type { HeroContenido } from "@/lib/cms"

const inicial: GuardarState = {}

export function HeroEditor({ slug, valor }: { slug: string; valor: HeroContenido }) {
  const [state, action, pending] = useActionState(guardarBloqueAction, inicial)
  const [hero, setHero] = useState<HeroContenido>(valor)

  const campo = (k: keyof HeroContenido) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setHero({ ...hero, [k]: e.target.value })

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="clave" value="hero" />
      <input type="hidden" name="contenido" value={JSON.stringify(hero)} />

      <Campo label="Badge" value={hero.badge} onChange={campo("badge")} />
      <Campo label="Título" value={hero.titulo} onChange={campo("titulo")} />
      <CampoArea label="Subtítulo" value={hero.subtitulo} onChange={campo("subtitulo")} />
      <Campo label="Texto del botón (CTA)" value={hero.ctaTexto} onChange={campo("ctaTexto")} />

      <Guardar pending={pending} state={state} />
    </form>
  )
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input value={value} onChange={onChange} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
  )
}

function CampoArea({ label, value, onChange }: { label: string; value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <textarea value={value} onChange={onChange} rows={3} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
    </label>
  )
}

export function Guardar({ pending, state }: { pending: boolean; state: GuardarState }) {
  return (
    <div className="mt-1 flex items-center gap-3">
      <button type="submit" disabled={pending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar"}
      </button>
      {state.ok && <span className="text-sm text-emerald-700">{state.mensaje}</span>}
      {state.error && <span className="text-sm text-red-700">{state.error}</span>}
    </div>
  )
}

"use client"

import { useActionState, useState } from "react"
import { guardarBloqueAction, type GuardarState } from "../actions"
import type { Valor } from "@/lib/cms"
import { Guardar } from "./hero-editor"

const inicial: GuardarState = {}

export function ValoresEditor({ slug, valor }: { slug: string; valor: Valor[] }) {
  const [state, action, pending] = useActionState(guardarBloqueAction, inicial)
  const [items, setItems] = useState<Valor[]>(valor)

  const set = (i: number, k: keyof Valor, v: string) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)))
  const add = () => setItems([...items, { titulo: "", texto: "" }])
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="clave" value="valores" />
      <input type="hidden" name="contenido" value={JSON.stringify({ items })} />

      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Valor {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-xs font-medium text-red-600 hover:underline">
              Quitar
            </button>
          </div>
          <input
            value={it.titulo}
            onChange={(e) => set(i, "titulo", e.target.value)}
            placeholder="Título"
            className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <textarea
            value={it.texto}
            onChange={(e) => set(i, "texto", e.target.value)}
            placeholder="Texto"
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      ))}

      <button type="button" onClick={add} className="self-start rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        + Agregar valor
      </button>

      <Guardar pending={pending} state={state} />
    </form>
  )
}

"use client"

import { useActionState, useState } from "react"
import { guardarBloqueAction, type GuardarState } from "../actions"
import type { Modulo } from "@/lib/cms"
import { Guardar } from "./hero-editor"

const inicial: GuardarState = {}

export function ModulosEditor({ slug, valor }: { slug: string; valor: Modulo[] }) {
  const [state, action, pending] = useActionState(guardarBloqueAction, inicial)
  const [items, setItems] = useState<Modulo[]>(valor)

  const set = (i: number, k: keyof Modulo, v: string | string[]) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)))
  const add = () => setItems([...items, { nombre: "", resumen: "", estado: "Planeado", capturas: [] }])
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="clave" value="modulos" />
      <input type="hidden" name="contenido" value={JSON.stringify({ items })} />

      {items.map((it, i) => (
        <div key={i} className="rounded-lg border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Módulo {i + 1}</span>
            <button type="button" onClick={() => remove(i)} className="text-xs font-medium text-red-600 hover:underline">
              Quitar
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              value={it.nombre}
              onChange={(e) => set(i, "nombre", e.target.value)}
              placeholder="Nombre del módulo"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <select
              value={it.estado}
              onChange={(e) => set(i, "estado", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option>Fundación</option>
              <option>En construcción</option>
              <option>Disponible</option>
              <option>Planeado</option>
            </select>
          </div>
          <textarea
            value={it.resumen}
            onChange={(e) => set(i, "resumen", e.target.value)}
            placeholder="Resumen"
            rows={2}
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
          <input
            value={(it.capturas ?? []).join(", ")}
            onChange={(e) => set(i, "capturas", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
            placeholder="URLs de pantallas separadas por coma (opcional)"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-500 outline-none focus:border-blue-500"
          />
        </div>
      ))}

      <button type="button" onClick={add} className="self-start rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
        + Agregar módulo
      </button>

      <Guardar pending={pending} state={state} />
    </form>
  )
}

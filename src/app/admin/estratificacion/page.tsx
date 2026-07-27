import Link from "next/link"
import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { EstratificacionAcciones } from "./estratificacion-acciones"

export const dynamic = "force-dynamic"

export default async function EstratificacionPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeActualizar] = await Promise.all([
    funcionarioPuede(ctx, "estratificacion", "consultar"),
    funcionarioPuede(ctx, "estratificacion", "actualizar"),
  ])
  if (!puedeConsultar && !puedeActualizar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Estratificación</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">estratificacion</span>.
        </p>
      </main>
    )
  }

  const predios = await db.rentaPredio.findMany({
    where: { activo: true },
    orderBy: { numeroPredial: "asc" },
    include: { contribuyente: true, cambiosEstrato: { orderBy: { createdAt: "desc" } } },
  })

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Estratificación</h1>
        <p className="text-sm text-slate-500">{predios.length} predio(s) registrado(s).</p>
        <p className="mt-1 text-xs text-slate-400">Estrato socioeconómico por predio (Ley 142/1994) — reusa el registro de predios de Rentas.</p>
      </header>

      <EstratificacionAcciones
        puedeActualizar={puedeActualizar}
        predios={predios.map((p) => ({ id: p.id, etiqueta: `${p.numeroPredial} — ${p.direccion} (hoy: ${p.estrato ?? "sin estrato"})` }))}
      />

      <section className="mt-8 grid gap-3">
        {predios.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay predios registrados.</p>
        )}
        {predios.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-mono text-sm text-slate-700">{p.numeroPredial}</span>{" "}
                <span className="text-sm text-slate-800">{p.direccion}</span>
                <span className="ml-2 text-xs text-slate-400">{p.contribuyente.razonSocial}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Estrato {p.estrato ?? "—"}
                </span>
                <Link href={`/admin/estratificacion/certificado?predioId=${p.id}`} className="text-xs font-medium text-blue-600 hover:underline">Certificado</Link>
              </div>
            </div>
            {p.cambiosEstrato.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-slate-500">Historial de cambios ({p.cambiosEstrato.length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {p.cambiosEstrato.map((c) => (
                    <li key={c.id}>
                      <span className="font-mono text-slate-400">{c.fecha.toISOString().slice(0, 10)}</span>{" "}
                      {c.estratoAnterior ?? "—"} → {c.estratoNuevo} — {c.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </section>
    </main>
  )
}

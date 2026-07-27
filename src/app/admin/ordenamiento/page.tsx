import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { diasHabilesRestantes } from "@/lib/dias-habiles"
import { OrdenamientoAcciones } from "./ordenamiento-acciones"

export const dynamic = "force-dynamic"

const ESTADO_COLOR: Record<string, string> = {
  RADICADA: "bg-slate-100 text-slate-700",
  EN_REVISION: "bg-amber-100 text-amber-800",
  REQUIERE_AJUSTES: "bg-orange-100 text-orange-800",
  APROBADA: "bg-emerald-100 text-emerald-800",
  NEGADA: "bg-red-100 text-red-800",
}

const TIPO_ETIQUETA: Record<string, string> = {
  CONCEPTO_USO_SUELO: "Concepto de uso de suelo",
  LINEA_PARAMENTO: "Línea de paramento",
  LICENCIA_CONSTRUCCION: "Licencia de construcción",
  LICENCIA_URBANIZACION: "Licencia de urbanización",
  LICENCIA_SUBDIVISION: "Licencia de subdivisión",
}

export default async function OrdenamientoPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeTramitar] = await Promise.all([
    funcionarioPuede(ctx, "ordenamiento_territorial", "consultar"),
    funcionarioPuede(ctx, "ordenamiento_territorial", "tramitar"),
  ])
  if (!puedeConsultar && !puedeTramitar) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Ordenamiento Territorial</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">ordenamiento_territorial</span>.
        </p>
      </main>
    )
  }

  const [solicitudes, terceros, predios] = await Promise.all([
    db.solicitudUrbanistica.findMany({ orderBy: { createdAt: "desc" }, include: { solicitante: true, predio: true, respondidoPor: true, actuaciones: { orderBy: { createdAt: "desc" } } } }),
    db.tercero.findMany({ where: { activo: true }, orderBy: { razonSocial: "asc" } }),
    db.rentaPredio.findMany({ where: { activo: true }, orderBy: { numeroPredial: "asc" } }),
  ])

  const abiertas = solicitudes.filter((s) => s.estado !== "APROBADA" && s.estado !== "NEGADA")

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Ordenamiento Territorial</h1>
        <p className="text-sm text-slate-500">{solicitudes.length} solicitud(es) · {abiertas.length} en trámite.</p>
        <p className="mt-1 text-xs text-slate-400">Conceptos de uso de suelo, línea de paramento y licencias urbanísticas (Ley 388/1997, Decreto 1077/2015).</p>
      </header>

      <OrdenamientoAcciones
        puedeTramitar={puedeTramitar}
        terceros={terceros.map((t) => ({ id: t.id, etiqueta: `${t.razonSocial} (${t.documento})` }))}
        predios={predios.map((p) => ({ id: p.id, etiqueta: `${p.numeroPredial} — ${p.direccion}` }))}
        solicitudesAbiertas={abiertas.map((s) => ({ id: s.id, etiqueta: `${s.numero} · ${TIPO_ETIQUETA[s.tipo]} (${s.estado})` }))}
      />

      <section className="mt-8 grid gap-3">
        {solicitudes.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay solicitudes.</p>
        )}
        {solicitudes.map((s) => {
          const restantes = s.estado === "APROBADA" || s.estado === "NEGADA" ? null : diasHabilesRestantes(s.fechaVencimiento)
          return (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-sm text-slate-700">{s.numero}</span>{" "}
                  <span className="text-sm text-slate-800">{TIPO_ETIQUETA[s.tipo]} — {s.solicitante.razonSocial}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[s.estado]}`}>{s.estado}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{s.direccion} · {s.descripcion}</p>
              {s.predio && <p className="mt-1 text-xs text-slate-400">Predio: {s.predio.numeroPredial}</p>}
              {restantes !== null && (
                <p className={`mt-1 text-xs ${restantes < 0 ? "text-red-600" : restantes <= 3 ? "text-amber-600" : "text-slate-400"}`}>
                  {restantes < 0 ? `Vencido hace ${Math.abs(restantes)} día(s) hábil(es)` : `${restantes} día(s) hábil(es) restante(s)`} (vence {s.fechaVencimiento.toISOString().slice(0, 10)})
                </p>
              )}
              {s.concepto && (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-medium">Concepto de respuesta:</span> {s.concepto}
                  {s.respondidoPor && <span className="text-slate-400"> — {s.respondidoPor.nombre} {s.respondidoPor.apellido}, {s.fechaRespuesta?.toISOString().slice(0, 10)}</span>}
                </p>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-500">Historial de actuaciones ({s.actuaciones.length})</summary>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {s.actuaciones.map((a) => (
                    <li key={a.id}><span className="font-mono text-slate-400">{a.fecha.toISOString().slice(0, 10)}</span> — {a.descripcion}</li>
                  ))}
                </ul>
              </details>
            </div>
          )
        })}
      </section>
    </main>
  )
}

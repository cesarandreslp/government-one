import { requerirRolTenant } from "@/lib/dal-tenant"
import { capacidadesEfectivas, quienEjerce } from "@/lib/dominio/acceso"
import { hayPlantilla } from "@/lib/dominio/plantillas-cargo"
import type { Grants } from "@/lib/dominio/capacidades"
import { EstructuraAcciones } from "./estructura-acciones"

export const dynamic = "force-dynamic"

const VIA_LABEL: Record<string, string> = { TITULAR: "titular", ENCARGADO: "encargado (E)", PROVISIONAL: "provisional" }

function chips(grants: Grants): string[] {
  return Object.entries(grants).flatMap(([modulo, caps]) => caps.map((c) => `${modulo}:${c}`))
}

export default async function EstructuraPage() {
  const { tenant, db } = await requerirRolTenant(["ADMIN", "SUPER_ADMIN"])

  const [dependencias, usuarios] = await Promise.all([
    db.dependencia.findMany({ orderBy: { codigo: "asc" }, include: { cargos: { orderBy: { nombre: "asc" } } } }),
    db.usuario.findMany({ orderBy: { apellido: "asc" }, include: { vinculaciones: { include: { cargo: true } } } }),
  ])

  const nombrePorUsuario = new Map(usuarios.map((u) => [u.id, `${u.nombre} ${u.apellido}`]))

  // Quién ejerce cada cargo (resuelve encargo→titular sin ausencia).
  const cargosPlanos = dependencias.flatMap((d) => d.cargos)
  const ejercientes = new Map(
    await Promise.all(
      cargosPlanos.map(async (c) => [c.id, await quienEjerce(db, c.id)] as const),
    ),
  )

  // Capacidades efectivas por funcionario (unión de cargos vigentes).
  const capsPorUsuario = new Map(
    await Promise.all(
      usuarios.map(async (u) => [u.id, chips(await capacidadesEfectivas(db, u.id))] as const),
    ),
  )

  // Orden jerárquico para el árbol (padres antes que hijas) + profundidad para indentar.
  const porId = new Map(dependencias.map((d) => [d.id, d]))
  const profundidad = (id: string): number => {
    let n = 0
    let cur = porId.get(id)
    while (cur?.padreId) { n++; cur = porId.get(cur.padreId) }
    return n
  }
  const arbol = [...dependencias].sort((a, b) => profundidad(a.id) - profundidad(b.id) || a.codigo.localeCompare(b.codigo))

  const estructuraVacia = dependencias.length === 0

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Estructura organizacional</h1>
        <p className="text-sm text-slate-500">
          {tenant.nombre} · tipo <span className="font-medium">{tenant.tipoEntidad}</span> ·{" "}
          {dependencias.length} dependencia(s), {cargosPlanos.length} cargo(s), {usuarios.length} funcionario(s).
        </p>
      </header>

      {estructuraVacia && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          Esta entidad aún no tiene estructura.{" "}
          {hayPlantilla(tenant.tipoEntidad)
            ? `Siembra la plantilla del tipo "${tenant.tipoEntidad}" para empezar (luego la ajustas).`
            : `No hay plantilla para el tipo "${tenant.tipoEntidad}"; créala manualmente abajo.`}
        </div>
      )}

      <EstructuraAcciones
        tipoEntidad={tenant.tipoEntidad}
        hayPlantilla={hayPlantilla(tenant.tipoEntidad)}
        dependencias={dependencias.map((d) => ({ id: d.id, codigo: d.codigo, nombre: d.nombre }))}
        cargos={cargosPlanos.map((c) => ({ id: c.id, nombre: c.nombre, depCodigo: porId.get(c.dependenciaId)?.codigo ?? "?" }))}
        funcionarios={usuarios.map((u) => ({ id: u.id, nombre: `${u.nombre} ${u.apellido}` }))}
      />

      {/* Árbol de dependencias + cargos */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Dependencias y cargos</h2>
        <div className="space-y-3">
          {arbol.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              style={{ marginLeft: profundidad(d.id) * 20 }}
            >
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{d.codigo}</span>
                <span className="font-medium text-slate-800">{d.nombre}</span>
                <span className="text-xs text-slate-400">{d.tipo}</span>
                {d.esServicioCompartido && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">servicio compartido</span>
                )}
              </div>
              {d.cargos.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {d.cargos.map((c) => {
                    const ej = ejercientes.get(c.id)
                    return (
                      <li key={c.id} className="flex flex-wrap items-center gap-2 border-l-2 border-slate-100 pl-3 text-sm">
                        <span className="text-slate-700">{c.nombre}</span>
                        {c.esJefatura && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700">jefatura</span>}
                        {chips((c.grants ?? {}) as Grants).map((g) => (
                          <span key={g} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">{g}</span>
                        ))}
                        <span className="ml-auto text-xs text-slate-400">
                          {ej ? `ejerce: ${nombrePorUsuario.get(ej.usuarioId) ?? ej.usuarioId} · ${VIA_LABEL[ej.via]}` : "sin ocupante"}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Funcionarios + capacidades efectivas */}
      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Funcionarios y acceso efectivo</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Funcionario</th>
                <th className="px-4 py-3">Rol (identidad)</th>
                <th className="px-4 py-3">Cargos vigentes</th>
                <th className="px-4 py-3">Capacidades efectivas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuarios.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Aún no hay funcionarios.</td></tr>
              )}
              {usuarios.map((u) => {
                const caps = capsPorUsuario.get(u.id) ?? []
                return (
                  <tr key={u.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{u.nombre} {u.apellido}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.rol}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.vinculaciones.length === 0
                        ? <span className="text-slate-400">—</span>
                        : u.vinculaciones.map((v) => (
                            <div key={v.id} className="text-xs">
                              {v.cargo.nombre} <span className="text-slate-400">({VIA_LABEL[v.tipo] ?? v.tipo})</span>
                            </div>
                          ))}
                    </td>
                    <td className="px-4 py-3">
                      {caps.length === 0
                        ? <span className="text-slate-400">sin acceso</span>
                        : <div className="flex flex-wrap gap-1">{caps.map((g) => (
                            <span key={g} className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono text-xs text-emerald-700">{g}</span>
                          ))}</div>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

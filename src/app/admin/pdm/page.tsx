import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"
import { ejecucionFisicaProyecto } from "@/lib/proyectos/ejecucion"
import { PdmAcciones } from "./pdm-acciones"

export const dynamic = "force-dynamic"

const TIPO_ETIQUETA: Record<string, string> = { PRODUCTO: "Producto", RESULTADO: "Resultado" }

export default async function PdmPage() {
  const ctx = await requerirFuncionario()
  const { db } = ctx

  const [puedeConsultar, puedeAdministrar, puedeReportarAvance] = await Promise.all([
    funcionarioPuede(ctx, "pdm", "consultar"),
    funcionarioPuede(ctx, "pdm", "administrar"),
    funcionarioPuede(ctx, "pdm", "reportar_avance"),
  ])
  const sinAcceso = !puedeConsultar && !puedeAdministrar && !puedeReportarAvance
  if (sinAcceso) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-slate-800">Plan de Desarrollo Municipal</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes la capacidad <span className="font-mono">pdm</span>.
        </p>
      </main>
    )
  }

  const [periodos, dependencias] = await Promise.all([
    db.pdmPeriodo.findMany({
      orderBy: { vigenciaInicio: "desc" },
      include: {
        ejes: {
          orderBy: { orden: "asc" },
          include: {
            programas: {
              include: {
                dependencia: true,
                metas: {
                  include: {
                    seguimientos: { orderBy: { vigencia: "desc" }, take: 1 },
                    proyectos: { select: { id: true, codigo: true, nombre: true, valorTotal: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    db.dependencia.findMany({ where: { activa: true }, orderBy: { codigo: "asc" } }),
  ])

  const ejesOpciones = periodos.flatMap((p) => p.ejes.map((e) => ({ id: e.id, etiqueta: `${p.nombre} · ${e.nombre}` })))
  const programasOpciones = periodos.flatMap((p) => p.ejes.flatMap((e) => e.programas.map((pr) => ({ id: pr.id, etiqueta: `${e.nombre} · ${pr.nombre}` }))))
  const metasOpciones = periodos.flatMap((p) => p.ejes.flatMap((e) => e.programas.flatMap((pr) => pr.metas.map((m) => ({ id: m.id, etiqueta: `${pr.nombre} · ${m.indicador}` })))))

  const totalMetas = metasOpciones.length

  // Avance% de cada proyecto vinculado (física, ver ejecucion.ts) — solo referencia cruzada, no se suma a la meta.
  const proyectoIds = periodos.flatMap((p) => p.ejes.flatMap((e) => e.programas.flatMap((pr) => pr.metas.flatMap((m) => m.proyectos.map((py) => py.id)))))
  const fisicaPorProyecto = new Map<string, number>()
  for (const id of proyectoIds) {
    const fis = await ejecucionFisicaProyecto(db, id)
    fisicaPorProyecto.set(id, fis.porcentaje)
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Plan de Desarrollo Municipal</h1>
        <p className="text-sm text-slate-500">{periodos.length} plan(es) · {totalMetas} meta(s).</p>
        <p className="mt-1 text-xs text-slate-400">
          Ejes→programas→metas (Ley 152/1994). El avance de cada meta se reporta manualmente por vigencia; si tiene
          proyectos del Banco de Proyectos vinculados, su avance físico se muestra como referencia (no se suma —
          unidades distintas por proyecto).
        </p>
      </header>

      {sinAcceso === false && (puedeAdministrar || puedeReportarAvance) && (
        <PdmAcciones
          puedeAdministrar={puedeAdministrar}
          puedeReportarAvance={puedeReportarAvance}
          periodos={periodos.map((p) => ({ id: p.id, etiqueta: `${p.nombre} (${p.vigenciaInicio}-${p.vigenciaFin})` }))}
          ejes={ejesOpciones}
          programas={programasOpciones}
          dependencias={dependencias.map((d) => ({ id: d.id, etiqueta: `${d.codigo} · ${d.nombre}` }))}
          metas={metasOpciones}
        />
      )}

      <section className="mt-8 grid gap-4">
        {periodos.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">Aún no hay un Plan de Desarrollo registrado.</p>
        )}
        {periodos.map((periodo) => (
          <div key={periodo.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-800">{periodo.nombre} <span className="text-xs font-normal text-slate-400">({periodo.vigenciaInicio}-{periodo.vigenciaFin})</span></h2>
            <div className="mt-3 space-y-4">
              {periodo.ejes.length === 0 && <p className="text-sm text-slate-400">Sin ejes aún.</p>}
              {periodo.ejes.map((eje) => (
                <div key={eje.id} className="border-l-2 border-indigo-200 pl-4">
                  <h3 className="text-sm font-semibold text-indigo-700">{eje.nombre}</h3>
                  {eje.programas.map((programa) => (
                    <div key={programa.id} className="mt-2 border-l-2 border-slate-100 pl-4">
                      <div className="text-sm font-medium text-slate-700">
                        {programa.nombre}
                        {programa.dependencia && <span className="ml-2 text-xs text-slate-400">{programa.dependencia.codigo}</span>}
                      </div>
                      {programa.metas.length === 0 ? (
                        <p className="text-xs text-slate-400">Sin metas aún.</p>
                      ) : (
                        <ul className="mt-1 space-y-2">
                          {programa.metas.map((meta) => {
                            const ultimo = meta.seguimientos[0]
                            const avance = ultimo ? Math.min(100, Math.round((Number(ultimo.valorAcumulado) / Number(meta.metaCuatrienio)) * 10000) / 100) : null
                            return (
                              <li key={meta.id} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-slate-700">
                                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{TIPO_ETIQUETA[meta.tipo]}</span>
                                    {" "}{meta.indicador}
                                  </span>
                                  <span className="font-mono text-slate-500">
                                    {ultimo ? `${Number(ultimo.valorAcumulado)} / ${Number(meta.metaCuatrienio)} ${meta.unidadMedida} (${avance}%)` : `meta: ${Number(meta.metaCuatrienio)} ${meta.unidadMedida} — sin seguimiento`}
                                  </span>
                                </div>
                                {meta.proyectos.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-indigo-500">
                                    {meta.proyectos.map((py) => (
                                      <span key={py.id}>← {py.codigo} ({fisicaPorProyecto.get(py.id) ?? 0}% físico)</span>
                                    ))}
                                  </div>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  )
}

import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

export const dynamic = "force-dynamic"

function money(n: unknown): string {
  return `$${Number(n).toLocaleString("es-CO")}`
}

export default async function CertificadoRetencionesPage({
  searchParams,
}: {
  searchParams: Promise<{ usuarioId?: string; anio?: string }>
}) {
  const { usuarioId, anio: anioRaw } = await searchParams
  const ctx = await requerirFuncionario()
  const { db, tenant } = ctx

  if (!(await funcionarioPuede(ctx, "nomina", "consultar"))) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidad de Nómina para consultar certificados.
        </p>
      </main>
    )
  }

  if (!usuarioId || !anioRaw) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-slate-500">Falta el funcionario o el año. Vuelve a Nómina y usa el formulario de certificado.</p>
      </main>
    )
  }
  const anio = Number(anioRaw)

  const [usuario, liquidaciones] = await Promise.all([
    db.usuario.findUnique({ where: { id: usuarioId } }),
    db.liquidacionNomina.findMany({
      where: { usuarioId, periodo: { anio } },
      include: { periodo: true, detalles: { include: { concepto: true } } },
      orderBy: { periodo: { mes: "asc" } },
    }),
  ])
  if (!usuario) {
    return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-red-600">Funcionario no encontrado.</p></main>
  }

  let totalIngresos = 0
  let totalRetencion = 0
  for (const l of liquidaciones) {
    totalIngresos += Number(l.totalDevengado)
    for (const d of l.detalles) {
      if (d.concepto.formula === "RETENCION_FUENTE") totalRetencion += Number(d.valor)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 print:py-0">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-slate-200 pb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800">{tenant.nombre}</h1>
          <p className="text-sm text-slate-500">Certificado de Ingresos y Retenciones — Año Gravable {anio}</p>
          <p className="text-xs text-slate-400">Expedido de conformidad con el Artículo 378 del Estatuto Tributario</p>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-slate-500">Funcionario:</span>{" "}
            <span className="font-medium text-slate-800">{usuario.nombre} {usuario.apellido}</span>
          </div>
          <div>
            <span className="text-slate-500">Documento:</span>{" "}
            <span className="font-medium text-slate-800">{usuario.tipoDocumento ?? "—"} {usuario.documento ?? "sin registrar"}</span>
          </div>
        </section>

        {liquidaciones.length === 0 ? (
          <p className="text-sm text-slate-400">Este funcionario no tiene liquidaciones registradas en {anio}.</p>
        ) : (
          <>
            <table className="mb-6 w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Periodo</th>
                  <th className="py-2 text-right">Ingresos (devengado)</th>
                  <th className="py-2 text-right">Retención en la fuente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liquidaciones.map((l) => {
                  const retencion = l.detalles.filter((d) => d.concepto.formula === "RETENCION_FUENTE").reduce((s, d) => s + Number(d.valor), 0)
                  return (
                    <tr key={l.id}>
                      <td className="py-2 font-mono text-xs text-slate-600">{l.periodo.codigo}</td>
                      <td className="py-2 text-right text-slate-700">{money(l.totalDevengado)}</td>
                      <td className="py-2 text-right text-slate-700">{money(retencion)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <section className="rounded-lg bg-slate-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Total ingresos laborales del año</span>
                <span className="font-semibold text-slate-800">{money(totalIngresos)}</span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="text-slate-600">Total retención en la fuente practicada</span>
                <span className="font-semibold text-slate-800">{money(totalRetencion)}</span>
              </div>
            </section>
          </>
        )}

        <p className="mt-8 text-xs text-slate-400">
          Este certificado se genera a partir de la liquidación real de nómina registrada en el sistema.
          La retención en la fuente se calculó por el procedimiento 1 del Art. 383 ET, sin deducciones
          adicionales por dependientes económicos o intereses de vivienda no capturados en este sistema.
        </p>
      </div>
    </main>
  )
}

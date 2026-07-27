import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

export const dynamic = "force-dynamic"

export default async function CertificadoEstratificacionPage({
  searchParams,
}: {
  searchParams: Promise<{ predioId?: string }>
}) {
  const { predioId } = await searchParams
  const ctx = await requerirFuncionario()
  const { db, tenant } = ctx

  if (!(await funcionarioPuede(ctx, "estratificacion", "consultar"))) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidad de Estratificación para consultar certificados.
        </p>
      </main>
    )
  }

  if (!predioId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-slate-500">Falta el predio. Vuelve a Estratificación y usa el enlace "Certificado" de la fila del predio.</p>
      </main>
    )
  }

  const predio = await db.rentaPredio.findUnique({ where: { id: predioId }, include: { contribuyente: true } })
  if (!predio) {
    return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-red-600">Predio no encontrado.</p></main>
  }
  if (predio.estrato === null) {
    return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-slate-500">Este predio no tiene estrato asignado — no se puede certificar.</p></main>
  }

  const hoy = new Date()
  const numeroCertificado = `EST-${predio.id.slice(-6).toUpperCase()}-${hoy.getUTCFullYear()}`

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 print:py-0">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-slate-200 pb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800">{tenant.nombre}</h1>
          <p className="text-sm text-slate-500">Certificado de Estratificación Socioeconómica</p>
          <p className="text-xs text-slate-400">N.° {numeroCertificado} · Expedido {hoy.toISOString().slice(0, 10)}</p>
        </header>

        <p className="mb-6 text-sm leading-relaxed text-slate-700">
          La Secretaría de Planeación de <strong>{tenant.nombre}</strong> certifica que el predio identificado con
          número predial <strong>{predio.numeroPredial}</strong>, ubicado en <strong>{predio.direccion}</strong>,
          a nombre de <strong>{predio.contribuyente.razonSocial}</strong>, se encuentra clasificado en el{" "}
          <strong>ESTRATO {predio.estrato}</strong> según la estratificación socioeconómica vigente (Ley 142/1994).
        </p>

        <section className="rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Número predial</span>
            <span className="font-mono font-semibold text-slate-800">{predio.numeroPredial}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-600">Estrato</span>
            <span className="text-lg font-semibold text-indigo-700">{predio.estrato}</span>
          </div>
        </section>

        <p className="mt-8 text-xs text-slate-400">
          Este certificado se genera a partir del registro de estratificación del sistema, actualizado mediante
          actos administrativos auditados (visitas técnicas, reclamaciones, actualización catastral).
        </p>
      </div>
    </main>
  )
}

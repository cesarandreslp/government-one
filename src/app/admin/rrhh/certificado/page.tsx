import { requerirFuncionario, funcionarioPuede } from "@/lib/dal-tenant"

export const dynamic = "force-dynamic"

const VIA_LABEL: Record<string, string> = { TITULAR: "Titular", ENCARGADO: "Encargo", PROVISIONAL: "Provisional" }

function money(n: unknown): string {
  return `$${Number(n).toLocaleString("es-CO")}`
}

function tiempoServicio(desde: Date, hasta: Date): string {
  let meses = (hasta.getUTCFullYear() - desde.getUTCFullYear()) * 12 + (hasta.getUTCMonth() - desde.getUTCMonth())
  if (hasta.getUTCDate() < desde.getUTCDate()) meses -= 1
  if (meses < 0) meses = 0
  const anios = Math.floor(meses / 12)
  const mesesRestantes = meses % 12
  const partes: string[] = []
  if (anios > 0) partes.push(`${anios} año${anios === 1 ? "" : "s"}`)
  if (mesesRestantes > 0 || anios === 0) partes.push(`${mesesRestantes} mes${mesesRestantes === 1 ? "" : "es"}`)
  return partes.join(" y ")
}

export default async function CertificadoLaboralPage({
  searchParams,
}: {
  searchParams: Promise<{ usuarioId?: string }>
}) {
  const { usuarioId } = await searchParams
  const ctx = await requerirFuncionario()
  const { db, tenant } = ctx

  if (!(await funcionarioPuede(ctx, "gestion_humana", "consultar"))) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          No tienes capacidad de Talento Humano para consultar certificados.
        </p>
      </main>
    )
  }

  if (!usuarioId) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-sm text-slate-500">Falta el funcionario. Vuelve a Talento Humano y usa el enlace "Certificado" de la fila del funcionario.</p>
      </main>
    )
  }

  const usuario = await db.usuario.findUnique({
    where: { id: usuarioId },
    include: { vinculaciones: { orderBy: { desde: "asc" }, include: { cargo: { include: { dependencia: true } } } } },
  })
  if (!usuario) {
    return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-red-600">Funcionario no encontrado.</p></main>
  }
  if (usuario.vinculaciones.length === 0) {
    return <main className="mx-auto max-w-2xl px-6 py-10"><p className="text-sm text-slate-500">Este funcionario no tiene actos administrativos registrados — no se puede certificar.</p></main>
  }

  const hoy = new Date()
  const vigente = (v: { desde: Date; hasta: Date | null }) => v.desde <= hoy && (v.hasta === null || v.hasta >= hoy)
  const vinculacionesVigentes = usuario.vinculaciones.filter(vigente)
  // Prioridad de "cargo actual": titular > encargado > provisional (misma jerarquía de quienEjerce).
  const orden: Record<string, number> = { TITULAR: 0, ENCARGADO: 1, PROVISIONAL: 2 }
  const cargoActual = vinculacionesVigentes.sort((a, b) => orden[a.tipo] - orden[b.tipo])[0]
  const activo = !!cargoActual
  // Sin cargo vigente: la última vinculación registrada (por fecha de inicio) describe el retiro.
  const referencia = cargoActual ?? usuario.vinculaciones[usuario.vinculaciones.length - 1]

  const fechaIngreso = usuario.vinculaciones[0].desde
  const fechaCorte = activo ? hoy : (referencia.hasta ?? hoy)
  const numeroCertificado = `CL-${usuario.id.slice(-6).toUpperCase()}-${hoy.getUTCFullYear()}`

  return (
    <main className="mx-auto max-w-2xl px-6 py-10 print:py-0">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-6 border-b border-slate-200 pb-4 text-center">
          <h1 className="text-lg font-semibold text-slate-800">{tenant.nombre}</h1>
          <p className="text-sm text-slate-500">Certificación Laboral</p>
          <p className="text-xs text-slate-400">N.° {numeroCertificado} · Expedido {hoy.toISOString().slice(0, 10)}</p>
        </header>

        <p className="mb-6 text-sm leading-relaxed text-slate-700">
          La Oficina de Talento Humano de <strong>{tenant.nombre}</strong> certifica que{" "}
          <strong>{usuario.nombre} {usuario.apellido}</strong>, identificado(a) con {usuario.tipoDocumento ?? "documento"}{" "}
          N.° {usuario.documento ?? "sin registrar"}, {activo ? "labora actualmente" : "laboró"} en esta entidad desde el{" "}
          <strong>{fechaIngreso.toISOString().slice(0, 10)}</strong>
          {!activo && <> hasta el <strong>{fechaCorte.toISOString().slice(0, 10)}</strong></>}, {activo ? "ocupando" : "habiendo ocupado por última vez"} el cargo de{" "}
          <strong>{referencia.cargo.nombre}</strong> ({referencia.cargo.dependencia.nombre}), bajo la modalidad de{" "}
          <strong>{VIA_LABEL[referencia.tipo] ?? referencia.tipo}</strong>
          {referencia.actoAdmin && <> según acto administrativo <strong>{referencia.actoAdmin}</strong></>}, con una asignación
          básica mensual de <strong>{referencia.salarioBasico ? money(referencia.salarioBasico) : "no registrada en el sistema"}</strong>.
        </p>

        <section className="rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Estado</span>
            <span className={`font-semibold ${activo ? "text-emerald-700" : "text-slate-500"}`}>{activo ? "ACTIVO" : "RETIRADO"}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-600">Tiempo de servicio</span>
            <span className="font-semibold text-slate-800">{tiempoServicio(fechaIngreso, fechaCorte)}</span>
          </div>
        </section>

        <p className="mt-8 text-xs text-slate-400">
          Este certificado se genera a partir de los actos administrativos (posesión, encargo, provisional)
          registrados en el sistema. El tiempo de servicio se cuenta de forma continua desde la primera
          vinculación registrada hasta {activo ? "la fecha" : "la fecha de retiro"}, sin descontar
          interrupciones que no estén registradas como acto administrativo en este sistema.
        </p>
      </div>
    </main>
  )
}

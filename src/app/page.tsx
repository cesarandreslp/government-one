import Link from "next/link"

// NOTA: contenido de plataforma (no de tenant). A futuro se administra desde el CMS del
// Superadmin (meta-DB) — este arreglo se migrará a datos sin reproceso. Cada módulo llevará
// además una descripción completa y PANTALLAS propias de la app cuando el módulo exista.
const MODULOS = [
  {
    nombre: "Portal Institucional",
    resumen:
      "Sitio web oficial Gov.co + Gestión Documental (base Orfeo) + Ventanilla Única con ruteo inteligente de PQRSD al funcionario que corresponde.",
    estado: "Fundación",
  },
  {
    nombre: "Financiero (Contabilidad pública)",
    resumen:
      "Libro mayor de doble partida (Marco CGN). La columna vertebral donde postean todos los módulos: presupuesto, contratación, nómina, inventarios.",
    estado: "Planeado",
  },
  {
    nombre: "Presupuesto público",
    resumen:
      "Cadena de ejecución del gasto: CDP → RP → Obligación → Pago, con catálogo CCPET y control de saldos en cada paso.",
    estado: "Planeado",
  },
  {
    nombre: "Banco de Proyectos",
    resumen:
      "Ejecución financiera vs. física de cada proyecto del plan de desarrollo. La brecha entre lo pagado y lo ejecutado como señal de riesgo.",
    estado: "Planeado",
  },
  {
    nombre: "Contratación (Ley 80/1150)",
    resumen:
      "Ciclo completo del contrato: estructuración con editor + IA, revisión jurídica, SECOP, RP, SST, supervisión e interventoría.",
    estado: "Planeado",
  },
  {
    nombre: "Nómina, Tesorería, Inventarios",
    resumen:
      "Talento humano y liquidación (PILA), conciliación bancaria, y almacén enlazado contablemente al financiero.",
    estado: "Planeado",
  },
]

const VALORES = [
  {
    titulo: "Aislamiento fuerte por entidad",
    texto:
      "Una base de datos dedicada por entidad. Los datos de cada tenant viven separados — pensado para información personal de gobierno (Ley 1581).",
  },
  {
    titulo: "Modular por contrato",
    texto:
      "Cada entidad activa exactamente los módulos que contrata. Empieza con el portal y súmale lo que necesites sin migraciones.",
  },
  {
    titulo: "Integración transparente",
    texto:
      "Al sumar un módulo, se enlaza solo: inventario y contratación postean al financiero; el banco de proyectos conoce su presupuesto.",
  },
  {
    titulo: "Hecho para el sector público colombiano",
    texto:
      "Catálogos nacionales (CCPET, CGC, transparencia Res. 1519) y flujos reales de alcaldías, personerías y gobernaciones.",
  },
]

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white text-slate-800">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-600 font-bold text-white">
              G1
            </span>
            <span className="text-lg font-semibold tracking-tight">Government One</span>
          </div>
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Acceso administrativo
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <p className="mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
            Plataforma SaaS · por OSS Innovation
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            El software de gestión pública, unificado y por entidad
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Government One es una plataforma multi-tenant para entidades públicas colombianas: portal,
            gestión documental, finanzas, presupuesto, contratación y más — cada entidad con su propia
            base de datos aislada, activando solo lo que contrata.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Acceso administrativo (SaaS)
            </Link>
            <a
              href="#modulos"
              className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Ver módulos
            </a>
          </div>
        </div>
      </section>

      {/* Valores */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {VALORES.map((v) => (
            <div key={v.titulo} className="rounded-xl border border-slate-200 p-6">
              <h3 className="text-sm font-semibold text-slate-900">{v.titulo}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{v.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section id="modulos" className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Módulos de la plataforma</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600">
              Cada módulo se describe a fondo y con pantallas reales de la aplicación a medida que se
              construye. <span className="text-slate-400">(Capturas y flujos: próximamente.)</span>
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULOS.map((m) => (
              <div key={m.nombre} className="flex flex-col rounded-xl border border-slate-200 bg-white p-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-base font-semibold text-slate-900">{m.nombre}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.estado === "Fundación"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.estado}
                  </span>
                </div>
                <p className="text-sm leading-6 text-slate-600">{m.resumen}</p>
                <div className="mt-4 grid h-28 place-items-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
                  Pantallas del módulo · próximamente
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Government One — OSS Innovation</span>
          <Link href="/login" className="font-medium text-blue-600 hover:underline">
            Acceso administrativo →
          </Link>
        </div>
      </footer>
    </div>
  )
}

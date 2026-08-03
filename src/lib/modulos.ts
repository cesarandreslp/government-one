// Catálogo NACIONAL de módulos de la plataforma (primitivo, no dato de entidad). Define QUÉ
// módulos existen, cuáles son BASE (siempre activos, bundle Portal Institucional) y cuáles son
// CONTRATABLES (el superadmin los habilita por tenant según el contrato). Data-driven: el código
// no conoce ninguna entidad, solo este vocabulario de módulos.
//
// Gobernanza de acceso en 3 capas (para funcionarios NO admin del tenant):
//   1. MÓDULO CONTRATADO por el tenant   (superadmin → Tenant.modulosContratados, meta-DB)
//   2. MÓDULO ASIGNADO a su dependencia  (admin del tenant → Dependencia.modulos, BD del tenant)
//   3. CAPACIDAD del cargo               (fundación de dominio → Cargo.grants)
// El admin del tenant (ADMIN/SUPER_ADMIN) omite 2 y 3 (administra la entidad).

export interface Modulo {
  id: string
  nombre: string
  categoria: string
  /** Base = siempre activo (no se contrata aparte); bundle del Portal Institucional. */
  base?: boolean
  /** Otros módulos que deben estar activos para que este opere. */
  dependeDe?: string[]
  descripcion: string
  /** Ruta del admin del tenant donde vive (para el nav). */
  ruta?: string
}

export const MODULOS: Modulo[] = [
  // ── Base (bundle Portal Institucional — siempre activo) ──────────────────────────
  { id: "gestion_documental", nombre: "Gestión Documental", categoria: "Base", base: true, ruta: "/admin/gd", descripcion: "TRD y radicación de correspondencia." },
  { id: "ventanilla_unica", nombre: "Ventanilla Única", categoria: "Base", base: true, ruta: "/admin/vu", descripcion: "PQRSD con ruteo por cargo y términos de ley." },
  { id: "gestion_humana", nombre: "Talento Humano", categoria: "Talento Humano", base: true, ruta: "/admin/rrhh", descripcion: "Funcionarios y actos administrativos (posesión, encargo, provisional, vacaciones)." },

  // ── Contratables ─────────────────────────────────────────────────────────────────
  { id: "contabilidad", nombre: "Contabilidad", categoria: "Financiero", ruta: "/admin/contabilidad", descripcion: "Libro mayor con doble partida (CGC)." },
  { id: "presupuesto", nombre: "Presupuesto", categoria: "Financiero", dependeDe: ["contabilidad"], ruta: "/admin/presupuesto", descripcion: "CCPET: apropiación y cadena CDP→RP→Obligación→Pago." },
  { id: "tesoreria", nombre: "Tesorería", categoria: "Financiero", dependeDe: ["contabilidad"], ruta: "/admin/tesoreria", descripcion: "Cuentas bancarias, movimientos y conciliación." },
  { id: "banco_proyectos", nombre: "Banco de Proyectos", categoria: "Planeación", dependeDe: ["presupuesto"], ruta: "/admin/proyectos", descripcion: "Ejecución financiera vs. física y brecha." },
  { id: "contratacion", nombre: "Contratación", categoria: "Contractual", ruta: "/admin/contratacion", descripcion: "Ley 80/1150: contratos, versiones y flujo con gating." },
  { id: "nomina", nombre: "Nómina", categoria: "Talento Humano", dependeDe: ["gestion_humana", "contabilidad"], ruta: "/admin/nomina", descripcion: "Conceptos, liquidación, PILA y posteo a Contabilidad." },
  { id: "rentas", nombre: "Rentas", categoria: "Financiero", dependeDe: ["contabilidad"], ruta: "/admin/rentas", descripcion: "Impuesto predial e ICA: liquidación, recaudo y cartera." },
  { id: "cobro_coactivo", nombre: "Cobro Coactivo", categoria: "Financiero", dependeDe: ["rentas"], ruta: "/admin/coactivo", descripcion: "Cartera vencida: mandamiento de pago, embargo y acuerdos de pago." },
  { id: "evaluacion_desempeno", nombre: "Evaluación del Desempeño", categoria: "Talento Humano", dependeDe: ["gestion_humana"], ruta: "/admin/evaluacion", descripcion: "Acuerdos de gestión y calificación anual (EDL)." },
  { id: "sst", nombre: "Seguridad y Salud en el Trabajo", categoria: "Talento Humano", dependeDe: ["gestion_humana"], ruta: "/admin/sst", descripcion: "Matriz de riesgos por cargo, exámenes médicos ocupacionales y accidentalidad." },
  { id: "capacitacion", nombre: "Capacitación", categoria: "Talento Humano", dependeDe: ["gestion_humana"], ruta: "/admin/capacitacion", descripcion: "Plan Institucional de Capacitación: cursos, inscripciones y asistencia." },
  { id: "bienestar", nombre: "Bienestar Social", categoria: "Talento Humano", dependeDe: ["gestion_humana"], ruta: "/admin/bienestar", descripcion: "Actividades de bienestar, incentivos y participación." },
  { id: "relaciones_laborales", nombre: "Relaciones Laborales", categoria: "Talento Humano", dependeDe: ["gestion_humana"], ruta: "/admin/relaciones-laborales", descripcion: "Permisos sindicales." },
  { id: "gestion_disciplinaria", nombre: "Gestión Disciplinaria", categoria: "Talento Humano", dependeDe: ["gestion_humana"], ruta: "/admin/disciplinario", descripcion: "Procesos disciplinarios internos (Ley 1952/2019)." },
  { id: "ordenamiento_territorial", nombre: "Ordenamiento Territorial", categoria: "Planeación", ruta: "/admin/ordenamiento", descripcion: "Conceptos de uso de suelo, línea de paramento y licencias urbanísticas (Ley 388/1997)." },
  { id: "pdm", nombre: "Plan de Desarrollo Municipal", categoria: "Planeación", ruta: "/admin/pdm", descripcion: "Ejes, programas, metas e indicadores del PDM (Ley 152/1994) y su seguimiento." },
  { id: "estratificacion", nombre: "Estratificación", categoria: "Planeación", dependeDe: ["rentas"], ruta: "/admin/estratificacion", descripcion: "Estrato socioeconómico por predio (Ley 142/1994): actualización auditada y certificado." },
  { id: "sisben", nombre: "SISBEN", categoria: "Planeación", ruta: "/admin/sisben", descripcion: "Registro local de clasificación socioeconómica (ficha, puntaje, grupo) y certificado." },
  { id: "participacion_ciudadana", nombre: "Participación Ciudadana", categoria: "Gobierno", ruta: "/admin/participacion-ciudadana", descripcion: "Registro de Juntas de Acción Comunal y sus dignatarios (Ley 743/2002)." },
  { id: "gestion_riesgo", nombre: "Gestión del Riesgo de Desastres", categoria: "Gobierno", ruta: "/admin/gestion-riesgo", descripcion: "CMGRD: registro de emergencias atendidas y ayudas entregadas (Ley 1523/2012)." },
]

const POR_ID = new Map(MODULOS.map((m) => [m.id, m]))

export function modulo(id: string): Modulo | undefined {
  return POR_ID.get(id)
}

/** Ids de los módulos base (siempre activos). */
export const MODULOS_BASE = MODULOS.filter((m) => m.base).map((m) => m.id)

/** Módulos que el superadmin puede contratar/habilitar (no base). */
export const MODULOS_CONTRATABLES = MODULOS.filter((m) => !m.base)

/** ¿El módulo está disponible para el tenant? (base siempre; o está en los contratados). */
export function moduloDisponible(moduloId: string, contratados: string[]): boolean {
  const m = POR_ID.get(moduloId)
  if (!m) return false
  return !!m.base || contratados.includes(moduloId)
}

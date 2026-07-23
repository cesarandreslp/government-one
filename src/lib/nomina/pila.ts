// Generación de la Planilla Integrada de Liquidación de Aportes (PILA) — archivo plano delimitado
// por ";" con los campos NÚCLEO de un registro tipo 2 (por afiliado) que exige la UGPP: tipo/número
// de documento, apellidos/nombres, tipo de cotizante, IBC, días cotizados, y los códigos de EPS/
// AFP/ARL/caja que RRHH capturó. El tipo cotizante es SIEMPRE "51" (servidor público) porque todo
// funcionario que llega aquí tiene VinculacionCargo — un contratista (identidad externa, sin
// Cargo) cotiza como independiente y queda fuera del alcance de este archivo, igual que en la
// operación real.
//
// Honestidad de alcance: la especificación completa UGPP (planilla v10.2) trae ~43 campos por
// registro tipo 2, varios de ellos administrativos (novedades de retiro, tipo de planilla,
// sub-periodos de vacaciones, etc.) que no tenemos forma de verificar contra la versión vigente
// sin acceso a la especificación oficial actualizada. Este generador produce los campos NÚCLEO
// (los que determinan aportes y afiliación) con datos reales del tenant — antes de radicar en el
// operador PILA, validar el archivo contra la versión de la planilla vigente ese año.

const SEP = ";"

export interface EmpleadoPila {
  tipoDocumento: string // CC | CE | PA | OTRO
  documento: string
  apellidos: string
  nombres: string
  ibc: number
  diasCotizados: number
  codigoEps: string | null
  codigoAfp: string | null
  codigoArl: string | null
  claseRiesgoArl: number | null
  codigoCaja: string | null
}

export interface AportantePila {
  nit: string
  razonSocial: string
  anio: number
  mes: number
}

function campo(valor: string | number | null | undefined): string {
  return (valor ?? "").toString()
}

/** Línea tipo 1 (aportante) — encabezado de la planilla. */
export function generarLineaAportante(a: AportantePila, totalEmpleados: number): string {
  return [
    "1", // tipo de registro
    a.nit,
    "N", // tipo de aportante: N = NIT (entidad pública/persona jurídica)
    `${a.anio}${String(a.mes).padStart(2, "0")}`,
    a.razonSocial,
    totalEmpleados,
  ].map(campo).join(SEP)
}

/** Línea tipo 2 (por afiliado) — campos núcleo, ver nota de alcance arriba. */
export function generarLineaAfiliado(e: EmpleadoPila): string {
  return [
    "2",
    "51", // tipo de cotizante: servidor público (VinculacionCargo siempre implica esto en este proyecto)
    e.tipoDocumento,
    e.documento,
    e.apellidos,
    e.nombres,
    Math.round(e.ibc),
    e.diasCotizados,
    e.codigoEps ?? "",
    e.codigoAfp ?? "",
    e.codigoArl ?? "",
    e.claseRiesgoArl ?? 1,
    e.codigoCaja ?? "",
  ].map(campo).join(SEP)
}

export function generarArchivoPila(aportante: AportantePila, empleados: EmpleadoPila[]): string {
  const lineas = [generarLineaAportante(aportante, empleados.length), ...empleados.map(generarLineaAfiliado)]
  return lineas.join("\r\n")
}

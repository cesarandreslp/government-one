// Estructura estándar del menú "Transparencia y acceso a la información pública" (Resolución
// MinTIC 1519/2020, Anexo 2 — Directriz de Gov.co). Es un PRIMITIVO NACIONAL (como CCPET/CGC),
// no dato de entidad: la ley fija las 12 categorías. El CONTENIDO de cada una (documentos,
// enlaces) sí es dato del tenant y se publica por entidad (pendiente: modelo de contenido del
// micrositio en la BD del tenant). Aquí vive solo la estructura obligatoria.

export interface CategoriaTransparencia {
  numero: string
  titulo: string
}

export const CATEGORIAS_TRANSPARENCIA: CategoriaTransparencia[] = [
  { numero: "1", titulo: "Mecanismos de contacto con el sujeto obligado" },
  { numero: "2", titulo: "Información de interés" },
  { numero: "3", titulo: "Estructura orgánica y talento humano" },
  { numero: "4", titulo: "Normatividad" },
  { numero: "5", titulo: "Presupuesto" },
  { numero: "6", titulo: "Planeación, presupuesto e informes" },
  { numero: "7", titulo: "Control" },
  { numero: "8", titulo: "Contratación" },
  { numero: "9", titulo: "Trámites y servicios" },
  { numero: "10", titulo: "Instrumentos de gestión de información pública" },
  { numero: "11", titulo: "Transparencia pasiva (PQRSD)" },
  { numero: "12", titulo: "Datos abiertos" },
]

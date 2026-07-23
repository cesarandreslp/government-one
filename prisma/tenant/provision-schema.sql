Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER', 'CONTRATISTA');

-- CreateEnum
CREATE TYPE "DependenciaTipo" AS ENUM ('DESPACHO', 'SECRETARIA', 'SUBSECRETARIA', 'DIRECCION', 'OFICINA');

-- CreateEnum
CREATE TYPE "VinculacionTipo" AS ENUM ('TITULAR', 'ENCARGADO', 'PROVISIONAL');

-- CreateEnum
CREATE TYPE "NivelCargo" AS ENUM ('ASISTENCIAL', 'TECNICO', 'PROFESIONAL', 'ASESOR', 'DIRECTIVO');

-- CreateEnum
CREATE TYPE "AusenciaTipo" AS ENUM ('VACACIONES', 'LICENCIA', 'COMISION', 'INCAPACIDAD');

-- CreateEnum
CREATE TYPE "GdTipoRadicado" AS ENUM ('ENTRADA', 'SALIDA', 'INTERNO');

-- CreateEnum
CREATE TYPE "GdEstadoRadicado" AS ENUM ('RADICADO', 'EN_TRAMITE', 'RESPONDIDO', 'ARCHIVADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "GdDisposicion" AS ENUM ('CONSERVACION_TOTAL', 'ELIMINACION', 'SELECCION', 'DIGITALIZACION');

-- CreateEnum
CREATE TYPE "PqrsdTipo" AS ENUM ('PETICION', 'QUEJA', 'RECLAMO', 'SUGERENCIA', 'DENUNCIA');

-- CreateEnum
CREATE TYPE "PqrsdCanal" AS ENUM ('WEB', 'PRESENCIAL', 'TELEFONICO', 'EMAIL', 'ESCRITO');

-- CreateEnum
CREATE TYPE "PqrsdEstado" AS ENUM ('RECIBIDA', 'ASIGNADA', 'EN_TRAMITE', 'RESPONDIDA', 'CERRADA');

-- CreateEnum
CREATE TYPE "Naturaleza" AS ENUM ('DEBITO', 'CREDITO');

-- CreateEnum
CREATE TYPE "TipoCuenta" AS ENUM ('BALANCE', 'RESULTADO', 'ORDEN');

-- CreateEnum
CREATE TYPE "EstadoPeriodo" AS ENUM ('ABIERTO', 'CERRADO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "TipoComprobante" AS ENUM ('CONTABLE', 'EGRESO', 'INGRESO', 'AJUSTE', 'APERTURA', 'CIERRE');

-- CreateEnum
CREATE TYPE "EstadoComprobante" AS ENUM ('REGISTRADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('NIT', 'CC', 'CE', 'PA', 'OTRO');

-- CreateEnum
CREATE TYPE "RubroTipo" AS ENUM ('INGRESO', 'GASTO');

-- CreateEnum
CREATE TYPE "EstadoDocPresupuestal" AS ENUM ('VIGENTE', 'ANULADO');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('TRANSFERENCIA', 'CHEQUE', 'EFECTIVO', 'OTRO');

-- CreateEnum
CREATE TYPE "ProyectoEstado" AS ENUM ('FORMULACION', 'EJECUCION', 'SUSPENDIDO', 'CERRADO');

-- CreateEnum
CREATE TYPE "ModalidadContratacion" AS ENUM ('LICITACION_PUBLICA', 'SELECCION_ABREVIADA', 'CONCURSO_MERITOS', 'CONTRATACION_DIRECTA', 'MINIMA_CUANTIA');

-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('BORRADOR', 'EN_REVISION_JURIDICA', 'DEVUELTO_ESTRUCTURACION', 'PERFECCIONADO', 'RP_REGISTRADO', 'SUSCRITO', 'EN_EJECUCION', 'SUSPENDIDO', 'TERMINADO', 'INCUMPLIDO', 'LIQUIDADO');

-- CreateEnum
CREATE TYPE "TipoVersionContrato" AS ENUM ('BORRADOR_ESTRUCTURACION', 'REVISION_JURIDICA');

-- CreateTable
CREATE TABLE "empleos_dafp" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "denominacion" TEXT NOT NULL,
    "nivel" "NivelCargo" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empleos_dafp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dependencias" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "DependenciaTipo" NOT NULL DEFAULT 'SECRETARIA',
    "esServicioCompartido" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "modulos" JSONB NOT NULL DEFAULT '[]',
    "padreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" TEXT NOT NULL,
    "dependenciaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "esJefatura" BOOLEAN NOT NULL DEFAULT false,
    "nivel" "NivelCargo",
    "empleoId" TEXT,
    "funciones" TEXT,
    "jefeInmediatoId" TEXT,
    "grants" JSONB NOT NULL DEFAULT '{}',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'USER',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vinculaciones_cargo" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cargoId" TEXT NOT NULL,
    "tipo" "VinculacionTipo" NOT NULL DEFAULT 'TITULAR',
    "actoAdmin" TEXT,
    "desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hasta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vinculaciones_cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ausencias" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" "AusenciaTipo" NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ausencias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_series" (
    "id" TEXT NOT NULL,
    "dependenciaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gd_series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_subseries" (
    "id" TEXT NOT NULL,
    "serieId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "retencionGestion" INTEGER,
    "retencionCentral" INTEGER,
    "disposicion" "GdDisposicion",
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gd_subseries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_consecutivos" (
    "id" TEXT NOT NULL,
    "tipo" "GdTipoRadicado" NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "gd_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radicados" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "GdTipoRadicado" NOT NULL,
    "anio" INTEGER NOT NULL,
    "consecutivo" INTEGER NOT NULL,
    "asunto" TEXT NOT NULL,
    "tercero" TEXT,
    "estado" "GdEstadoRadicado" NOT NULL DEFAULT 'RADICADO',
    "dependenciaId" TEXT,
    "subserieId" TEXT,
    "radicadoPorId" TEXT,
    "fechaRadicado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radicados_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gd_adjuntos" (
    "id" TEXT NOT NULL,
    "radicadoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gd_adjuntos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pqrsd_consecutivos" (
    "id" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "pqrsd_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pqrsd" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "consecutivo" INTEGER NOT NULL,
    "tipo" "PqrsdTipo" NOT NULL,
    "canal" "PqrsdCanal" NOT NULL DEFAULT 'PRESENCIAL',
    "estado" "PqrsdEstado" NOT NULL DEFAULT 'RECIBIDA',
    "peticionarioNombre" TEXT NOT NULL,
    "peticionarioEmail" TEXT,
    "peticionarioTelefono" TEXT,
    "asunto" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "dependenciaId" TEXT,
    "cargoAsignadoId" TEXT,
    "usuarioAsignadoId" TEXT,
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diasTermino" INTEGER NOT NULL,
    "fechaVencimiento" TIMESTAMP(3) NOT NULL,
    "respuesta" TEXT,
    "fechaRespuesta" TIMESTAMP(3),
    "respondidoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pqrsd_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cp_plan_cuentas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivel" INTEGER NOT NULL,
    "naturaleza" "Naturaleza" NOT NULL,
    "tipo" "TipoCuenta" NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "permiteMovimientos" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cp_plan_cuentas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cp_periodos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER,
    "estado" "EstadoPeriodo" NOT NULL DEFAULT 'ABIERTO',
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "cerradoEn" TIMESTAMP(3),
    "cerradoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cp_periodos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cp_terceros" (
    "id" TEXT NOT NULL,
    "documento" TEXT NOT NULL,
    "tipoDocumento" "TipoDocumento" NOT NULL DEFAULT 'NIT',
    "razonSocial" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cp_terceros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cp_consecutivos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoComprobante" NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cp_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cp_comprobantes" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "TipoComprobante" NOT NULL DEFAULT 'CONTABLE',
    "fecha" TIMESTAMP(3) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'REGISTRADO',
    "periodoId" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "consecutivo" INTEGER NOT NULL,
    "totalDebito" DECIMAL(18,2) NOT NULL,
    "totalCredito" DECIMAL(18,2) NOT NULL,
    "fuenteModulo" TEXT,
    "fuenteRef" TEXT,
    "creadoPor" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPor" TEXT,
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cp_comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cp_asientos" (
    "id" TEXT NOT NULL,
    "comprobanteId" TEXT NOT NULL,
    "cuentaId" TEXT NOT NULL,
    "terceroId" TEXT,
    "debito" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credito" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "descripcion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cp_asientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_rubros" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "RubroTipo" NOT NULL,
    "nivel" INTEGER NOT NULL,
    "permiteMovimientos" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_rubros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_apropiaciones" (
    "id" TEXT NOT NULL,
    "rubroId" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "apropiacionInicial" DECIMAL(18,2) NOT NULL,
    "adiciones" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "reducciones" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_apropiaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_cdp_consecutivos" (
    "id" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "psp_cdp_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_cdps" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "rubroId" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "objeto" TEXT NOT NULL,
    "estado" "EstadoDocPresupuestal" NOT NULL DEFAULT 'VIGENTE',
    "proyectoId" TEXT,
    "creadoPor" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPor" TEXT,
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_cdps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_rp_consecutivos" (
    "id" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "psp_rp_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_rps" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "cdpId" TEXT NOT NULL,
    "terceroId" TEXT,
    "valor" DECIMAL(18,2) NOT NULL,
    "objeto" TEXT NOT NULL,
    "estado" "EstadoDocPresupuestal" NOT NULL DEFAULT 'VIGENTE',
    "creadoPor" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPor" TEXT,
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_rps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_obligacion_consecutivos" (
    "id" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "psp_obligacion_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_obligaciones" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "rpId" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "concepto" TEXT NOT NULL,
    "estado" "EstadoDocPresupuestal" NOT NULL DEFAULT 'VIGENTE',
    "creadoPor" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPor" TEXT,
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_obligaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_pago_consecutivos" (
    "id" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "psp_pago_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psp_pagos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "obligacionId" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "medioPago" "MedioPago" NOT NULL DEFAULT 'TRANSFERENCIA',
    "referencia" TEXT,
    "comprobanteId" TEXT NOT NULL,
    "estado" "EstadoDocPresupuestal" NOT NULL DEFAULT 'VIGENTE',
    "creadoPor" TEXT,
    "anuladoEn" TIMESTAMP(3),
    "anuladoPor" TEXT,
    "motivoAnulacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "psp_pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bp_proyecto_consecutivos" (
    "id" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bp_proyecto_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bp_proyectos" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "vigencia" INTEGER NOT NULL,
    "dependenciaId" TEXT NOT NULL,
    "estado" "ProyectoEstado" NOT NULL DEFAULT 'FORMULACION',
    "valorTotal" DECIMAL(18,2),
    "fechaInicio" TIMESTAMP(3),
    "fechaFinPrevista" TIMESTAMP(3),
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bp_proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bp_proyecto_hitos" (
    "id" TEXT NOT NULL,
    "proyectoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "pesoPorcentual" DECIMAL(5,2) NOT NULL,
    "avancePorcentual" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "fechaProgramada" TIMESTAMP(3),
    "fechaReporte" TIMESTAMP(3),
    "reportadoPor" TEXT,
    "evidenciaUrl" TEXT,
    "observacion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bp_proyecto_hitos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bp_proyecto_hito_reportes" (
    "id" TEXT NOT NULL,
    "hitoId" TEXT NOT NULL,
    "avancePorcentual" DECIMAL(5,2) NOT NULL,
    "evidenciaUrl" TEXT,
    "observacion" TEXT,
    "reportadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bp_proyecto_hito_reportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "con_consecutivos" (
    "id" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "con_consecutivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "con_contratos" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "vigencia" INTEGER NOT NULL,
    "objeto" TEXT NOT NULL,
    "modalidad" "ModalidadContratacion" NOT NULL,
    "valorContrato" DECIMAL(18,2) NOT NULL,
    "plazoDias" INTEGER,
    "estado" "EstadoContrato" NOT NULL DEFAULT 'BORRADOR',
    "terceroId" TEXT NOT NULL,
    "estructuradorId" TEXT,
    "abogadoAsignadoId" TEXT,
    "rpId" TEXT,
    "fechaSuscripcion" TIMESTAMP(3),
    "creadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "con_contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "con_contrato_versiones" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "numeroVersion" INTEGER NOT NULL,
    "tipo" "TipoVersionContrato" NOT NULL,
    "contenido" TEXT,
    "aprobado" BOOLEAN,
    "observaciones" TEXT,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "con_contrato_versiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empleos_dafp_codigo_key" ON "empleos_dafp"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dependencias_codigo_key" ON "dependencias"("codigo");

-- CreateIndex
CREATE INDEX "dependencias_padreId_idx" ON "dependencias"("padreId");

-- CreateIndex
CREATE INDEX "cargos_dependenciaId_idx" ON "cargos"("dependenciaId");

-- CreateIndex
CREATE INDEX "cargos_empleoId_idx" ON "cargos"("empleoId");

-- CreateIndex
CREATE INDEX "cargos_jefeInmediatoId_idx" ON "cargos"("jefeInmediatoId");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "vinculaciones_cargo_usuarioId_idx" ON "vinculaciones_cargo"("usuarioId");

-- CreateIndex
CREATE INDEX "vinculaciones_cargo_cargoId_idx" ON "vinculaciones_cargo"("cargoId");

-- CreateIndex
CREATE INDEX "ausencias_usuarioId_idx" ON "ausencias"("usuarioId");

-- CreateIndex
CREATE INDEX "gd_series_dependenciaId_idx" ON "gd_series"("dependenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "gd_series_dependenciaId_codigo_key" ON "gd_series"("dependenciaId", "codigo");

-- CreateIndex
CREATE INDEX "gd_subseries_serieId_idx" ON "gd_subseries"("serieId");

-- CreateIndex
CREATE UNIQUE INDEX "gd_subseries_serieId_codigo_key" ON "gd_subseries"("serieId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "gd_consecutivos_tipo_anio_key" ON "gd_consecutivos"("tipo", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "radicados_numero_key" ON "radicados"("numero");

-- CreateIndex
CREATE INDEX "radicados_tipo_anio_idx" ON "radicados"("tipo", "anio");

-- CreateIndex
CREATE INDEX "radicados_dependenciaId_idx" ON "radicados"("dependenciaId");

-- CreateIndex
CREATE INDEX "radicados_estado_idx" ON "radicados"("estado");

-- CreateIndex
CREATE INDEX "gd_adjuntos_radicadoId_idx" ON "gd_adjuntos"("radicadoId");

-- CreateIndex
CREATE UNIQUE INDEX "pqrsd_consecutivos_anio_key" ON "pqrsd_consecutivos"("anio");

-- CreateIndex
CREATE UNIQUE INDEX "pqrsd_numero_key" ON "pqrsd"("numero");

-- CreateIndex
CREATE INDEX "pqrsd_estado_idx" ON "pqrsd"("estado");

-- CreateIndex
CREATE INDEX "pqrsd_usuarioAsignadoId_idx" ON "pqrsd"("usuarioAsignadoId");

-- CreateIndex
CREATE INDEX "pqrsd_dependenciaId_idx" ON "pqrsd"("dependenciaId");

-- CreateIndex
CREATE UNIQUE INDEX "cp_plan_cuentas_codigo_key" ON "cp_plan_cuentas"("codigo");

-- CreateIndex
CREATE INDEX "cp_plan_cuentas_parentId_idx" ON "cp_plan_cuentas"("parentId");

-- CreateIndex
CREATE INDEX "cp_plan_cuentas_nivel_idx" ON "cp_plan_cuentas"("nivel");

-- CreateIndex
CREATE UNIQUE INDEX "cp_periodos_codigo_key" ON "cp_periodos"("codigo");

-- CreateIndex
CREATE INDEX "cp_periodos_anio_mes_idx" ON "cp_periodos"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "cp_terceros_documento_key" ON "cp_terceros"("documento");

-- CreateIndex
CREATE INDEX "cp_terceros_razonSocial_idx" ON "cp_terceros"("razonSocial");

-- CreateIndex
CREATE UNIQUE INDEX "cp_consecutivos_tipo_anio_key" ON "cp_consecutivos"("tipo", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "cp_comprobantes_numero_key" ON "cp_comprobantes"("numero");

-- CreateIndex
CREATE INDEX "cp_comprobantes_periodoId_idx" ON "cp_comprobantes"("periodoId");

-- CreateIndex
CREATE INDEX "cp_comprobantes_fecha_idx" ON "cp_comprobantes"("fecha");

-- CreateIndex
CREATE INDEX "cp_comprobantes_fuenteModulo_fuenteRef_idx" ON "cp_comprobantes"("fuenteModulo", "fuenteRef");

-- CreateIndex
CREATE INDEX "cp_asientos_comprobanteId_idx" ON "cp_asientos"("comprobanteId");

-- CreateIndex
CREATE INDEX "cp_asientos_cuentaId_idx" ON "cp_asientos"("cuentaId");

-- CreateIndex
CREATE INDEX "cp_asientos_terceroId_idx" ON "cp_asientos"("terceroId");

-- CreateIndex
CREATE UNIQUE INDEX "psp_rubros_codigo_key" ON "psp_rubros"("codigo");

-- CreateIndex
CREATE INDEX "psp_rubros_parentId_idx" ON "psp_rubros"("parentId");

-- CreateIndex
CREATE INDEX "psp_rubros_tipo_idx" ON "psp_rubros"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "psp_apropiaciones_rubroId_vigencia_key" ON "psp_apropiaciones"("rubroId", "vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "psp_cdp_consecutivos_vigencia_key" ON "psp_cdp_consecutivos"("vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "psp_cdps_numero_key" ON "psp_cdps"("numero");

-- CreateIndex
CREATE INDEX "psp_cdps_proyectoId_idx" ON "psp_cdps"("proyectoId");

-- CreateIndex
CREATE INDEX "psp_cdps_rubroId_vigencia_idx" ON "psp_cdps"("rubroId", "vigencia");

-- CreateIndex
CREATE INDEX "psp_cdps_vigencia_idx" ON "psp_cdps"("vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "psp_rp_consecutivos_vigencia_key" ON "psp_rp_consecutivos"("vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "psp_rps_numero_key" ON "psp_rps"("numero");

-- CreateIndex
CREATE INDEX "psp_rps_cdpId_idx" ON "psp_rps"("cdpId");

-- CreateIndex
CREATE UNIQUE INDEX "psp_obligacion_consecutivos_vigencia_key" ON "psp_obligacion_consecutivos"("vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "psp_obligaciones_numero_key" ON "psp_obligaciones"("numero");

-- CreateIndex
CREATE INDEX "psp_obligaciones_rpId_idx" ON "psp_obligaciones"("rpId");

-- CreateIndex
CREATE UNIQUE INDEX "psp_pago_consecutivos_vigencia_key" ON "psp_pago_consecutivos"("vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "psp_pagos_numero_key" ON "psp_pagos"("numero");

-- CreateIndex
CREATE UNIQUE INDEX "psp_pagos_comprobanteId_key" ON "psp_pagos"("comprobanteId");

-- CreateIndex
CREATE INDEX "psp_pagos_obligacionId_idx" ON "psp_pagos"("obligacionId");

-- CreateIndex
CREATE UNIQUE INDEX "bp_proyecto_consecutivos_vigencia_key" ON "bp_proyecto_consecutivos"("vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "bp_proyectos_codigo_key" ON "bp_proyectos"("codigo");

-- CreateIndex
CREATE INDEX "bp_proyectos_dependenciaId_idx" ON "bp_proyectos"("dependenciaId");

-- CreateIndex
CREATE INDEX "bp_proyectos_vigencia_idx" ON "bp_proyectos"("vigencia");

-- CreateIndex
CREATE INDEX "bp_proyecto_hitos_proyectoId_idx" ON "bp_proyecto_hitos"("proyectoId");

-- CreateIndex
CREATE INDEX "bp_proyecto_hito_reportes_hitoId_idx" ON "bp_proyecto_hito_reportes"("hitoId");

-- CreateIndex
CREATE UNIQUE INDEX "con_consecutivos_vigencia_key" ON "con_consecutivos"("vigencia");

-- CreateIndex
CREATE UNIQUE INDEX "con_contratos_numero_key" ON "con_contratos"("numero");

-- CreateIndex
CREATE INDEX "con_contratos_terceroId_idx" ON "con_contratos"("terceroId");

-- CreateIndex
CREATE INDEX "con_contratos_vigencia_idx" ON "con_contratos"("vigencia");

-- CreateIndex
CREATE INDEX "con_contratos_estructuradorId_idx" ON "con_contratos"("estructuradorId");

-- CreateIndex
CREATE INDEX "con_contratos_abogadoAsignadoId_idx" ON "con_contratos"("abogadoAsignadoId");

-- CreateIndex
CREATE INDEX "con_contrato_versiones_contratoId_idx" ON "con_contrato_versiones"("contratoId");

-- AddForeignKey
ALTER TABLE "dependencias" ADD CONSTRAINT "dependencias_padreId_fkey" FOREIGN KEY ("padreId") REFERENCES "dependencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "dependencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_empleoId_fkey" FOREIGN KEY ("empleoId") REFERENCES "empleos_dafp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargos" ADD CONSTRAINT "cargos_jefeInmediatoId_fkey" FOREIGN KEY ("jefeInmediatoId") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculaciones_cargo" ADD CONSTRAINT "vinculaciones_cargo_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vinculaciones_cargo" ADD CONSTRAINT "vinculaciones_cargo_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "cargos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ausencias" ADD CONSTRAINT "ausencias_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gd_series" ADD CONSTRAINT "gd_series_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "dependencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gd_subseries" ADD CONSTRAINT "gd_subseries_serieId_fkey" FOREIGN KEY ("serieId") REFERENCES "gd_series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radicados" ADD CONSTRAINT "radicados_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "dependencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radicados" ADD CONSTRAINT "radicados_subserieId_fkey" FOREIGN KEY ("subserieId") REFERENCES "gd_subseries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radicados" ADD CONSTRAINT "radicados_radicadoPorId_fkey" FOREIGN KEY ("radicadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gd_adjuntos" ADD CONSTRAINT "gd_adjuntos_radicadoId_fkey" FOREIGN KEY ("radicadoId") REFERENCES "radicados"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pqrsd" ADD CONSTRAINT "pqrsd_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "dependencias"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pqrsd" ADD CONSTRAINT "pqrsd_cargoAsignadoId_fkey" FOREIGN KEY ("cargoAsignadoId") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pqrsd" ADD CONSTRAINT "pqrsd_usuarioAsignadoId_fkey" FOREIGN KEY ("usuarioAsignadoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pqrsd" ADD CONSTRAINT "pqrsd_respondidoPorId_fkey" FOREIGN KEY ("respondidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cp_plan_cuentas" ADD CONSTRAINT "cp_plan_cuentas_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cp_plan_cuentas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cp_comprobantes" ADD CONSTRAINT "cp_comprobantes_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "cp_periodos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cp_asientos" ADD CONSTRAINT "cp_asientos_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "cp_comprobantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cp_asientos" ADD CONSTRAINT "cp_asientos_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "cp_plan_cuentas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cp_asientos" ADD CONSTRAINT "cp_asientos_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "cp_terceros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_rubros" ADD CONSTRAINT "psp_rubros_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "psp_rubros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_apropiaciones" ADD CONSTRAINT "psp_apropiaciones_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "psp_rubros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_cdps" ADD CONSTRAINT "psp_cdps_rubroId_fkey" FOREIGN KEY ("rubroId") REFERENCES "psp_rubros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_cdps" ADD CONSTRAINT "psp_cdps_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "bp_proyectos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_rps" ADD CONSTRAINT "psp_rps_cdpId_fkey" FOREIGN KEY ("cdpId") REFERENCES "psp_cdps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_rps" ADD CONSTRAINT "psp_rps_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "cp_terceros"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_obligaciones" ADD CONSTRAINT "psp_obligaciones_rpId_fkey" FOREIGN KEY ("rpId") REFERENCES "psp_rps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_pagos" ADD CONSTRAINT "psp_pagos_obligacionId_fkey" FOREIGN KEY ("obligacionId") REFERENCES "psp_obligaciones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psp_pagos" ADD CONSTRAINT "psp_pagos_comprobanteId_fkey" FOREIGN KEY ("comprobanteId") REFERENCES "cp_comprobantes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_proyectos" ADD CONSTRAINT "bp_proyectos_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "dependencias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_proyecto_hitos" ADD CONSTRAINT "bp_proyecto_hitos_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "bp_proyectos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bp_proyecto_hito_reportes" ADD CONSTRAINT "bp_proyecto_hito_reportes_hitoId_fkey" FOREIGN KEY ("hitoId") REFERENCES "bp_proyecto_hitos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "con_contratos" ADD CONSTRAINT "con_contratos_terceroId_fkey" FOREIGN KEY ("terceroId") REFERENCES "cp_terceros"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "con_contratos" ADD CONSTRAINT "con_contratos_estructuradorId_fkey" FOREIGN KEY ("estructuradorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "con_contratos" ADD CONSTRAINT "con_contratos_abogadoAsignadoId_fkey" FOREIGN KEY ("abogadoAsignadoId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "con_contratos" ADD CONSTRAINT "con_contratos_rpId_fkey" FOREIGN KEY ("rpId") REFERENCES "psp_rps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "con_contrato_versiones" ADD CONSTRAINT "con_contrato_versiones_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "con_contratos"("id") ON DELETE CASCADE ON UPDATE CASCADE;


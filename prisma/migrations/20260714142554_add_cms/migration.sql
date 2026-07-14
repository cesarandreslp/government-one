-- CreateTable
CREATE TABLE "paginas_cms" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paginas_cms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloques_cms" (
    "id" TEXT NOT NULL,
    "paginaId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "contenido" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bloques_cms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paginas_cms_slug_key" ON "paginas_cms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "bloques_cms_paginaId_clave_key" ON "bloques_cms"("paginaId", "clave");

-- AddForeignKey
ALTER TABLE "bloques_cms" ADD CONSTRAINT "bloques_cms_paginaId_fkey" FOREIGN KEY ("paginaId") REFERENCES "paginas_cms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

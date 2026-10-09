-- CreateEnum
CREATE TYPE "PaadStatus" AS ENUM ('BORRADOR', 'ENVIADO_A_REVISION', 'OBSERVADO', 'APROBADO_UAP', 'APROBADO_DIRECCION', 'APROBADO');

-- CreateTable
CREATE TABLE "IntegrantePlanificacion" (
    "id" TEXT NOT NULL,
    "planificacionId" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "cargoEnCatedra" TEXT NOT NULL,

    CONSTRAINT "IntegrantePlanificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaadAnual" (
    "id" TEXT NOT NULL,
    "docenteId" TEXT NOT NULL,
    "cicloLectivo" INTEGER NOT NULL,
    "datosPaad" JSONB NOT NULL,
    "estado" "PaadStatus" NOT NULL DEFAULT 'BORRADOR',
    "carreraEvaluadoraId" TEXT,
    "conflictoMigracion" BOOLEAN NOT NULL DEFAULT false,
    "fuenteLegacyId" TEXT,
    "legacyConvertido" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaadAnual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresentacionPaad" (
    "id" TEXT NOT NULL,
    "paadId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "datosPaad" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresentacionPaad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DictamenPaad" (
    "id" TEXT NOT NULL,
    "presentacionId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "rolAutor" "UserRole" NOT NULL,
    "resultado" TEXT NOT NULL,
    "comentario" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DictamenPaad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservacionPaad" (
    "id" TEXT NOT NULL,
    "paadId" TEXT NOT NULL,
    "presentacionId" TEXT,
    "legacyId" TEXT,
    "campoPath" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "rolAutor" "UserRole" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "resuelto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservacionPaad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrantePlanificacion_planificacionId_docenteId_key" ON "IntegrantePlanificacion"("planificacionId", "docenteId");

-- CreateIndex
CREATE UNIQUE INDEX "PaadAnual_docenteId_cicloLectivo_key" ON "PaadAnual"("docenteId", "cicloLectivo");

-- CreateIndex
CREATE UNIQUE INDEX "PresentacionPaad_paadId_numero_key" ON "PresentacionPaad"("paadId", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "DictamenPaad_presentacionId_rolAutor_key" ON "DictamenPaad"("presentacionId", "rolAutor");

-- CreateIndex
CREATE UNIQUE INDEX "ObservacionPaad_legacyId_key" ON "ObservacionPaad"("legacyId");

-- AddForeignKey
ALTER TABLE "IntegrantePlanificacion" ADD CONSTRAINT "IntegrantePlanificacion_planificacionId_fkey" FOREIGN KEY ("planificacionId") REFERENCES "Planificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrantePlanificacion" ADD CONSTRAINT "IntegrantePlanificacion_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaadAnual" ADD CONSTRAINT "PaadAnual_docenteId_fkey" FOREIGN KEY ("docenteId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaadAnual" ADD CONSTRAINT "PaadAnual_carreraEvaluadoraId_fkey" FOREIGN KEY ("carreraEvaluadoraId") REFERENCES "Carrera"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresentacionPaad" ADD CONSTRAINT "PresentacionPaad_paadId_fkey" FOREIGN KEY ("paadId") REFERENCES "PaadAnual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DictamenPaad" ADD CONSTRAINT "DictamenPaad_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "PresentacionPaad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DictamenPaad" ADD CONSTRAINT "DictamenPaad_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionPaad" ADD CONSTRAINT "ObservacionPaad_paadId_fkey" FOREIGN KEY ("paadId") REFERENCES "PaadAnual"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionPaad" ADD CONSTRAINT "ObservacionPaad_presentacionId_fkey" FOREIGN KEY ("presentacionId") REFERENCES "PresentacionPaad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservacionPaad" ADD CONSTRAINT "ObservacionPaad_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Conservar el equipo existente sin modificar las copias históricas del PAAD.
INSERT INTO "IntegrantePlanificacion" ("id", "planificacionId", "docenteId", "cargoEnCatedra")
SELECT "id", "planificacionId", "docenteId", "cargoEnCatedra" FROM "PaadDocente"
ON CONFLICT ("planificacionId", "docenteId") DO NOTHING;


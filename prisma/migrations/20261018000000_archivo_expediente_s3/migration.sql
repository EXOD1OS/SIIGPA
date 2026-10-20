CREATE TYPE "ArchivoExpedienteTipo" AS ENUM (
    'PAAC',
    'PAAD',
    'INFORME_PEDAGOGICO',
    'INFORME_DISCIPLINAR',
    'INFORME_GENERAL'
);

CREATE TABLE "ArchivoExpediente" (
    "id" TEXT NOT NULL,
    "planificacionId" TEXT NOT NULL,
    "tipo" "ArchivoExpedienteTipo" NOT NULL,
    "docenteId" TEXT,
    "nombreArchivo" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchivoExpediente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArchivoExpediente_objectKey_key" ON "ArchivoExpediente"("objectKey");
CREATE INDEX "ArchivoExpediente_planificacionId_tipo_idx" ON "ArchivoExpediente"("planificacionId", "tipo");
CREATE INDEX "ArchivoExpediente_planificacionId_docenteId_idx" ON "ArchivoExpediente"("planificacionId", "docenteId");

ALTER TABLE "ArchivoExpediente"
ADD CONSTRAINT "ArchivoExpediente_planificacionId_fkey"
FOREIGN KEY ("planificacionId") REFERENCES "Planificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
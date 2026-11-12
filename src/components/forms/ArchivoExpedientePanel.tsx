import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { etiquetaTipoArchivo } from '@/lib/archivo-expediente';
import { SectionCard } from './fields';
import { ConsolidarExpedienteButton } from './ConsolidarExpedienteButton';

export async function ArchivoExpedientePanel({
  planificacionId,
  estado,
  puedeConsolidar = false,
}: {
  planificacionId: string;
  estado: string;
  /** Administración / Consejo: puede (re)generar el expediente si quedó sin archivos. */
  puedeConsolidar?: boolean;
}) {
  if (estado !== 'FINALIZADO') return null;

  const archivos = await prisma.archivoExpediente.findMany({
    where: { planificacionId },
    orderBy: [{ tipo: 'asc' }, { nombreArchivo: 'asc' }],
  });

  return (
    <section className="no-print">
      <SectionCard title="Documentos PDF archivados">
        {archivos.length ? (
          <ul className="space-y-2">
            {archivos.map((archivo) => (
              <li key={archivo.id} className="flex flex-col justify-between gap-1 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center">
                <div>
                  <p className="text-sm font-medium text-ink">{etiquetaTipoArchivo(archivo.tipo)}</p>
                  <p className="text-xs text-muted">
                    {archivo.nombreArchivo} · {(archivo.sizeBytes / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Link
                  href={`/api/archivos/${archivo.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                  download={archivo.nombreArchivo}
                >
                  Descargar PDF
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <p className="text-sm text-muted">
              No hay archivos registrados para este expediente. Verificá la configuración del almacenamiento S3/MinIO.
            </p>
            {puedeConsolidar && <ConsolidarExpedienteButton planificacionId={planificacionId} />}
          </>
        )}
      </SectionCard>
    </section>
  );
}
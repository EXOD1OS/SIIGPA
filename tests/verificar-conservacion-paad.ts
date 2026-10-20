import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

// Compara datos antiguos después de migrar. Solo lectura; no recrea ni elimina tablas.
const sourceUrl = process.env.PAAD_BACKUP_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl || !targetUrl || sourceUrl === targetUrl) throw new Error('Indicá bases distintas en PAAD_BACKUP_DATABASE_URL y DATABASE_URL.');
const before = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
const after = new PrismaClient({ datasources: { db: { url: targetUrl } } });
async function main() {
  for (const table of ['Planificacion', 'PaadDocente', 'ItemObservacion', 'AsignacionCatedra', 'Usuario']) {
    // Lista fija de tablas controlada por el código, no por entrada externa.
    const sql = 'SELECT * FROM "' + table + '" ORDER BY id';
    const a = await before.$queryRawUnsafe<unknown[]>(sql);
    const b = await after.$queryRawUnsafe<unknown[]>(sql);
    assert.deepEqual(b, a, 'La migración debe conservar ' + table);
    console.log(table + ': ' + a.length + ' registros íntegros.');
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => Promise.all([before.$disconnect(), after.$disconnect()]));

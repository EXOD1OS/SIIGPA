import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { domainDatabaseIsEmpty } from '../src/lib/database-state';
import { migrarPaads } from '../src/lib/migrar-paad';

const db = new PrismaClient();
async function preparar() {
  const vacia = await domainDatabaseIsEmpty(db);
  if (vacia && process.env.DEMO_SEED_IF_EMPTY === 'true') {
    console.log('Base vacía: cargando estructura, docentes y planificaciones de demostración.');
    const seed = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], { stdio: 'inherit' });
    if (seed.error || seed.status !== 0) {
      throw new Error('La carga inicial no terminó correctamente. Se conservó la base; revisá el registro antes de continuar.');
    }
  } else if (vacia) {
    console.log('Base vacía. DEMO_SEED_IF_EMPTY=false: no se cargarán datos de demostración.');
  } else {
    console.log('Base existente: se conservan usuarios, contraseñas, planificaciones e historial.');
  }
  const resultado = await migrarPaads(db);
  console.log(`Conversión PAAD: ${resultado.convertidos} documentos, ${resultado.conflictos} conflictos registrados.`);
}
preparar().catch((error) => {
  console.error('No se pudo preparar la base. No se ejecutó ningún reinicio de datos.', error);
  process.exitCode = 1;
}).finally(() => db.$disconnect());

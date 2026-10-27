import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const archivo = fileURLToPath(new URL('../.env.docker', import.meta.url));
const raizMinio = new URL('../config/minio/', import.meta.url);
const clavesRequeridas = ['NEXTAUTH_SECRET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'];

function faltanClaves(texto) {
  return clavesRequeridas.filter((clave) => {
    const coincidencia = texto.match(new RegExp(`^${clave}=(.*)$`, 'm'));
    return !coincidencia || !coincidencia[1].trim();
  });
}

try {
  await writeFile(archivo, [
    '# Configuración privada local: no subir a Git.',
    'APP_PORT=3000', 'DB_PORT=5433', 'MINIO_API_PORT=9000', 'MINIO_CONSOLE_PORT=9001',
    'NEXTAUTH_URL=http://localhost:3000',
    `NEXTAUTH_SECRET=${randomBytes(32).toString('hex')}`,
    'DEMO_SEED_IF_EMPTY=true', 'S3_ENDPOINT=http://minio:9000', 'S3_REGION=us-east-1', 'S3_BUCKET=planificaciones-pdf',
    `S3_ACCESS_KEY_ID=siga${randomBytes(8).toString('hex')}`,
    `S3_SECRET_ACCESS_KEY=${randomBytes(24).toString('hex')}`,
    'MINIO_ROOT_ENV_FILE=./config/minio/root.env',
    'MINIO_LICENSE_FILE=./config/minio/minio.license', '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  await mkdir(raizMinio, { recursive: true });
  try {
    await writeFile(new URL('root.env', raizMinio), [
      `MINIO_ROOT_USER=root${randomBytes(6).toString('hex')}`,
      `MINIO_ROOT_PASSWORD=${randomBytes(24).toString('hex')}`, '',
    ].join('\n'), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('Se conservó el archivo root.env existente.');
  }
  console.log('Configuración creada con claves aleatorias. La licencia de AIStor debe aportarse por separado.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  const existente = await readFile(archivo, 'utf8');
  const faltantes = faltanClaves(existente);
  if (faltantes.length) {
    throw new Error(`Se conservó .env.docker, pero faltan ${faltantes.join(', ')}. Completalo usando .env.docker.example como referencia.`);
  }
  console.log('.env.docker ya existe y se conservó sin modificar sus valores.');
}

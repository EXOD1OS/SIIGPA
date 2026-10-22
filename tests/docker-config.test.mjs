import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { spawn } from 'node:child_process';

const original = new URL('../docker/preparar-config.mjs', import.meta.url);

async function crearProyecto() {
  const raiz = await mkdtemp(join(tmpdir(), 'siga-config-'));
  await mkdir(join(raiz, 'docker'));
  await copyFile(original, join(raiz, 'docker', 'preparar-config.mjs'));
  return raiz;
}

function ejecutar(raiz) {
  return new Promise((resolve) => {
    const proceso = spawn(process.execPath, ['docker/preparar-config.mjs'], {
      cwd: raiz,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let salida = '';
    proceso.stdout.on('data', (dato) => { salida += dato; });
    proceso.stderr.on('data', (dato) => { salida += dato; });
    proceso.on('close', (codigo) => resolve({ codigo, salida }));
  });
}

test('crea configuración privada completa y no muestra claves', async (t) => {
  const raiz = await crearProyecto();
  t.after(() => rm(raiz, { recursive: true, force: true }));
  const resultado = await ejecutar(raiz);
  assert.equal(resultado.codigo, 0);
  const env = await readFile(join(raiz, '.env.docker'), 'utf8');
  const root = await readFile(join(raiz, 'config', 'minio', 'root.env'), 'utf8');
  for (const clave of ['NEXTAUTH_SECRET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']) {
    assert.match(env, new RegExp(`^${clave}=.+$`, 'm'));
  }
  assert.match(root, /^MINIO_ROOT_USER=.+$/m);
  assert.doesNotMatch(resultado.salida, /NEXTAUTH_SECRET=|S3_SECRET_ACCESS_KEY=|MINIO_ROOT_PASSWORD=/);
});

test('repetir la preparación conserva los archivos privados', async (t) => {
  const raiz = await crearProyecto();
  t.after(() => rm(raiz, { recursive: true, force: true }));
  await ejecutar(raiz);
  const antes = await readFile(join(raiz, '.env.docker'), 'utf8');
  const rootAntes = await readFile(join(raiz, 'config', 'minio', 'root.env'), 'utf8');
  const resultado = await ejecutar(raiz);
  assert.equal(resultado.codigo, 0);
  assert.equal(await readFile(join(raiz, '.env.docker'), 'utf8'), antes);
  assert.equal(await readFile(join(raiz, 'config', 'minio', 'root.env'), 'utf8'), rootAntes);
});

test('rechaza una configuración existente incompleta sin modificarla', async (t) => {
  const raiz = await crearProyecto();
  t.after(() => rm(raiz, { recursive: true, force: true }));
  const incompleta = 'NEXTAUTH_SECRET=una-clave-larga-de-prueba-que-no-se-publica\n';
  await writeFile(join(raiz, '.env.docker'), incompleta);
  const resultado = await ejecutar(raiz);
  assert.equal(resultado.codigo, 1);
  assert.match(resultado.salida, /S3_ACCESS_KEY_ID/);
  assert.equal(await readFile(join(raiz, '.env.docker'), 'utf8'), incompleta);
});

test('conserva una cuenta root existente al crear la configuración de SIGA', async (t) => {
  const raiz = await crearProyecto();
  t.after(() => rm(raiz, { recursive: true, force: true }));
  await mkdir(join(raiz, 'config', 'minio'), { recursive: true });
  const root = 'MINIO_ROOT_USER=cuenta-existente\nMINIO_ROOT_PASSWORD=secreto-existente\n';
  await writeFile(join(raiz, 'config', 'minio', 'root.env'), root);
  const resultado = await ejecutar(raiz);
  assert.equal(resultado.codigo, 0);
  assert.equal(await readFile(join(raiz, 'config', 'minio', 'root.env'), 'utf8'), root);
});

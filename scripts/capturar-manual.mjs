#!/usr/bin/env node
/**
 * Capturas del Manual de Usuario de SIIGPA (docs/manual/capturas/).
 *
 * Solo lectura: se bloquea toda petición que no sea GET (formularios, Server Actions, subidas),
 * salvo el inicio de sesión de NextAuth. Ningún modal se envía y no se cambian contraseñas ni estados.
 *
 * Requisitos: la aplicación corriendo con los datos de demostración (`prisma/seed.ts`) y Playwright con Chromium:
 *   npm i -D playwright && npx playwright install chromium
 * Uso:
 *   node scripts/capturar-manual.mjs                 # contra http://localhost:3000
 *   SIIGPA_URL=http://otro-host:3000 node scripts/capturar-manual.mjs
 *   PLAYWRIGHT_MODULE=<ruta o file:// a playwright>  # si Playwright está instalado fuera del proyecto
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const modulo = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulo ? (modulo.startsWith('file:') ? modulo : pathToFileURL(modulo).href) : 'playwright');

const BASE = (process.env.SIIGPA_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const PASSWORD = 'unlar2026';
const SALIDA = fileURLToPath(new URL('../docs/manual/capturas/', import.meta.url));
const VIEWPORT = { width: 1440, height: 900 };

// Documentos de la base de demostración (se buscan por nombre de asignatura, no por id).
const ASIG_OBSERVADA = 'Programación I'; // PAAC OBSERVADO de Lucía Torres
const ASIG_EN_REVISION = 'Sistemas de Información I'; // PAAC ENVIADO_A_REVISION (ciclo vigente)
const ASIG_CON_INFORMES = 'Análisis Matemático'; // PAAC con Informe Disciplinar emitido

const ERRORES = [/Unhandled Runtime Error/i, /Application error/i, /This page could not be found/i, /Internal Server Error/i];

fs.mkdirSync(SALIDA, { recursive: true });
const browser = await chromium.launch({ headless: true });
const generadas = [];
const bloqueadas = [];

async function nuevaSesion(email, tema = 'light') {
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'es-AR', timezoneId: 'America/Argentina/Cordoba' });
  // Tema antes de que se ejecute el script inicial del layout.
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('siigpa.theme', t);
    } catch {}
  }, tema);
  // Solo lectura: se aborta toda escritura salvo la autenticación.
  await ctx.route('**/*', (route) => {
    const req = route.request();
    if (req.method() === 'GET' || req.method() === 'HEAD' || req.url().includes('/api/auth/')) return route.continue();
    bloqueadas.push(`${req.method()} ${req.url()}`);
    return route.abort();
  });
  const page = await ctx.newPage();
  if (email) {
    await page.goto(`${BASE}/login`);
    await page.fill('input[name=email]', email);
    await page.fill('input[name=password]', PASSWORD);
    await page.click('button[type=submit]');
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90_000 });
    await listo(page);
  }
  return { ctx, page };
}

/** Espera red ociosa, fuentes e imágenes, y oculta el indicador de desarrollo de Next.js. */
async function listo(page) {
  await page.waitForLoadState('networkidle', { timeout: 90_000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important} *{caret-color:transparent!important}' }).catch(() => {});
  await page.waitForTimeout(700);
}

async function ir(page, ruta) {
  await page.goto(BASE + ruta);
  await listo(page);
}

async function capturar(page, archivo, opciones = {}) {
  await listo(page);
  const texto = await page.locator('body').innerText();
  const error = ERRORES.find((re) => re.test(texto));
  if (error) throw new Error(`${archivo}: la página muestra un error (${error})`);
  await page.screenshot({ path: path.join(SALIDA, archivo), animations: 'disabled', ...opciones });
  generadas.push(archivo);
  console.log('✔', archivo);
}

/** Abre el PAAC de una asignatura desde el listado (botón «Editar PAAC» / «Ver PAAC»). */
async function abrirPaac(page, asignatura) {
  // Un reintento: en `next dev` la primera navegación puede coincidir con una recompilación.
  for (let intento = 1; ; intento++) {
    await ir(page, '/planificaciones');
    await page.locator(`button[aria-label$="PAAC de ${asignatura}"]`).first().click();
    try {
      await page.waitForURL(/\/planificaciones\/[0-9a-f-]{36}/, { timeout: 45_000 });
      break;
    } catch (e) {
      if (intento >= 2) throw e;
    }
  }
  await listo(page);
}

/** Botón visible por su texto (el nombre accesible puede diferir del texto visible). */
const boton = (page, texto) => page.locator('button:visible', { hasText: texto }).first();

async function cerrarModal(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

try {
  // ---------- Acceso ----------
  {
    const { ctx, page } = await nuevaSesion(null, 'light');
    await ir(page, '/login');
    await capturar(page, '01-login-claro.png');
    await ctx.close();
  }
  {
    // Martín López tiene `mustChangePassword`: el modal se abre solo. No se envía.
    const { ctx, page } = await nuevaSesion('auxiliar.prog@unlar.edu.ar');
    await boton(page, 'Guardar contraseña').waitFor();
    await capturar(page, '02-cambiar-password.png');
    await ctx.close();
  }

  // ---------- Docente ----------
  {
    const { ctx, page } = await nuevaSesion('titular.prog@unlar.edu.ar');
    await ir(page, '/dashboard');
    await capturar(page, '03-docente-dashboard.png');

    await ir(page, '/mi-paad');
    await capturar(page, '04-docente-mi-paad.png');
    await boton(page, 'Vista previa documento / PDF').click();
    await capturar(page, '05-docente-mi-paad-pdf.png');

    await ir(page, '/planificaciones');
    await capturar(page, '06-docente-planificaciones.png');

    await abrirPaac(page, ASIG_OBSERVADA);
    await boton(page, /^2\) Diagnóstico/).click();
    await boton(page, 'Marcar como subsanada').scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, -260);
    await capturar(page, '07-docente-paac-editor.png');
    await boton(page, 'Vista previa documento / PDF').click();
    await capturar(page, '08-docente-paac-pdf.png');
    await ctx.close();
  }

  // ---------- UAP ----------
  {
    const { ctx, page } = await nuevaSesion('uap@unlar.edu.ar');
    await ir(page, '/dashboard');
    await capturar(page, '09-uap-dashboard.png');
    await ir(page, '/planificaciones');
    await capturar(page, '10-uap-bandeja-paac.png');
    await ir(page, '/paads');
    await capturar(page, '11-uap-bandeja-paad.png');

    await abrirPaac(page, ASIG_EN_REVISION);
    await boton(page, 'Ir al Informe de Evaluación').click();
    await page.waitForTimeout(900);
    await capturar(page, '12-uap-informe-pedagogico.png');

    await ir(page, '/planificaciones');
    await page.locator(`button[aria-label="Ver informes de ${ASIG_CON_INFORMES}"]`).click();
    await page.getByRole('dialog').first().waitFor();
    await capturar(page, '13-informes-modal-lectura.png');
    await ctx.close();
  }

  // ---------- Dirección de Carrera ----------
  {
    const { ctx, page } = await nuevaSesion('direccion.isi@unlar.edu.ar');
    await ir(page, '/dashboard');
    await capturar(page, '14-direccion-dashboard.png');
    await abrirPaac(page, ASIG_EN_REVISION);
    await boton(page, 'Ir al Informe de Evaluación').click();
    await page.waitForTimeout(900);
    await capturar(page, '15-direccion-informe-disciplinar.png');
    await ctx.close();
  }

  // ---------- Consejo Departamental ----------
  {
    const { ctx, page } = await nuevaSesion('consejo.exactas@unlar.edu.ar');
    await ir(page, '/dashboard');
    await capturar(page, '16-consejo-dashboard.png');
    await ir(page, '/planificaciones');
    await boton(page, /^Históricas \/ Aprobadas/).click();
    await capturar(page, '17-consejo-listado-expedientes.png');
    await boton(page, 'Cargar Expediente').click();
    await page.getByRole('dialog').first().waitFor();
    await capturar(page, '18-consejo-modal-protocolizacion.png');
    await cerrarModal(page);
    await ctx.close();
  }

  // ---------- Administrador ----------
  {
    const { ctx, page } = await nuevaSesion('admin@unlar.edu.ar');
    await ir(page, '/admin');
    await boton(page, /^Expandir$/).click(); // solo despliega el árbol (estado local de la vista)
    await capturar(page, '19-admin-estructura.png');
    // Dentro del árbol plegable otra capa intercepta el puntero: se dispara el click sobre el propio botón.
    await boton(page, 'Equipo de cátedra').evaluate((b) => b.click());
    await page.getByRole('dialog').first().waitFor();
    await capturar(page, '20-admin-equipo-catedra.png');
    await cerrarModal(page);
    await ir(page, '/admin/usuarios');
    await capturar(page, '21-admin-usuarios.png');
    await ir(page, '/dashboard');
    await page.locator('button[aria-label^="Notificaciones"]').click();
    await page.getByText('Marcar todas como leídas').waitFor();
    await capturar(page, '22-header-notificaciones.png');
    await ctx.close();
  }

  // ---------- Anexo: modo oscuro ----------
  {
    const { ctx, page } = await nuevaSesion(null, 'dark');
    await ir(page, '/login');
    await capturar(page, '23-login-oscuro.png');
    await ctx.close();
  }
  {
    const { ctx, page } = await nuevaSesion('titular.prog@unlar.edu.ar', 'dark');
    await ir(page, '/dashboard');
    await capturar(page, '24-dashboard-oscuro.png');
    await abrirPaac(page, ASIG_OBSERVADA);
    await boton(page, /^2\) Diagnóstico/).click();
    await boton(page, 'Marcar como subsanada').scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, -260);
    await capturar(page, '25-paac-editor-oscuro.png');
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${generadas.length} capturas en ${SALIDA}`);
if (bloqueadas.length) console.log(`Escrituras bloqueadas (modo solo lectura): ${bloqueadas.length}\n  ${[...new Set(bloqueadas)].join('\n  ')}`);
if (generadas.length !== 25) process.exitCode = 1;

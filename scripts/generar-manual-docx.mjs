#!/usr/bin/env node
/**
 * Genera docs/manual/MANUAL_USUARIO_SIIGPA.docx a partir de docs/manual/MANUAL_USUARIO.md y sus capturas.
 *
 * Interpreta el subconjunto de Markdown que usa el manual: títulos (#…####), párrafos, listas con viñetas y
 * numeradas, tablas, figuras `![…](./capturas/…)` seguidas de su pie `*Figura N: …*`, y **negrita** / *cursiva*.
 * Produce estilos nativos de Word (Título 1-3) para que la tabla de contenidos se actualice desde Word.
 *
 * Requisitos: `npm i -D docx`  (o DOCX_MODULE=<ruta o file:// al paquete docx> si está instalado fuera del proyecto)
 * Uso:        node scripts/generar-manual-docx.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const modulo = process.env.DOCX_MODULE;
const docx = await import(modulo ? (modulo.startsWith('file:') ? modulo : pathToFileURL(modulo).href) : 'docx');
const {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} = docx;

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const DIR_MANUAL = path.join(RAIZ, 'docs', 'manual');
const ORIGEN = path.join(DIR_MANUAL, 'MANUAL_USUARIO.md');
const DESTINO = path.join(DIR_MANUAL, 'MANUAL_USUARIO_SIIGPA.docx');

// Paleta institucional (tokens de src/app/globals.css).
const VERDE = '157B79';
const TINTA = '203349';
const GRIS = '667789';
const BORDE = 'D5DEE6';
const FONDO_TABLA = 'EAF5F2';
const FUENTE = 'Arial';

// A4 con márgenes de 2,5 cm (DXA: 1 cm = 567).
const A4 = { width: 11906, height: 16838 };
const MARGEN = 1418;
const ANCHO_UTIL_DXA = A4.width - 2 * MARGEN; // 9070 DXA ≈ 16 cm
const ANCHO_FIGURA_PX = Math.round((ANCHO_UTIL_DXA / 1440) * 96); // ≈ 605 px a 96 ppp

/** Ancho y alto de un PNG (cabecera IHDR). */
function medidasPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('No es un PNG');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function imagen(ruta, anchoPx) {
  const data = fs.readFileSync(ruta);
  const { w, h } = medidasPng(data);
  return new ImageRun({ type: 'png', data, transformation: { width: anchoPx, height: Math.round((anchoPx * h) / w) }, altText: { title: path.basename(ruta), description: path.basename(ruta), name: path.basename(ruta) } });
}

/** **negrita**, *cursiva* y texto plano → TextRun[]. */
function enLinea(texto, base = {}) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) runs.push(new TextRun({ text: texto.slice(ultimo, m.index), ...base }));
    const t = m[0];
    runs.push(t.startsWith('**') ? new TextRun({ text: t.slice(2, -2), bold: true, ...base }) : new TextRun({ text: t.slice(1, -1), italics: true, ...base }));
    ultimo = m.index + t.length;
  }
  if (ultimo < texto.length) runs.push(new TextRun({ text: texto.slice(ultimo), ...base }));
  return runs;
}

const borde = { style: BorderStyle.SINGLE, size: 4, color: BORDE };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };

function tabla(filas) {
  const columnas = filas[0].length;
  // Primera columna angosta (estado / rol), el resto reparte el ancho.
  const primera = columnas === 2 ? Math.round(ANCHO_UTIL_DXA * 0.3) : Math.round(ANCHO_UTIL_DXA / columnas);
  const resto = columnas === 2 ? ANCHO_UTIL_DXA - primera : primera;
  const anchos = filas[0].map((_, i) => (i === 0 ? primera : resto));
  anchos[anchos.length - 1] += ANCHO_UTIL_DXA - anchos.reduce((a, b) => a + b, 0);
  return new Table({
    width: { size: ANCHO_UTIL_DXA, type: WidthType.DXA },
    columnWidths: anchos,
    rows: filas.map(
      (celdas, i) =>
        new TableRow({
          tableHeader: i === 0,
          cantSplit: true,
          children: celdas.map(
            (c, j) =>
              new TableCell({
                width: { size: anchos[j], type: WidthType.DXA },
                borders: bordes,
                shading: i === 0 ? { fill: FONDO_TABLA, type: ShadingType.CLEAR, color: 'auto' } : undefined,
                margins: { top: 80, bottom: 80, left: 120, right: 120 },
                children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: enLinea(c, i === 0 || j === 0 ? { bold: true, size: 19 } : { size: 19 }) })],
              }),
          ),
        }),
    ),
  });
}

// ---------- Lectura del Markdown ----------
const lineas = fs.readFileSync(ORIGEN, 'utf8').replace(/\r\n/g, '\n').split('\n');

// Portada: desde «# Título» hasta el primer «## ».
const inicioCuerpo = lineas.findIndex((l) => l.startsWith('## '));
const portadaMd = lineas.slice(0, inicioCuerpo).filter((l) => l.trim());
const titulo = portadaMd.find((l) => l.startsWith('# '))?.slice(2) ?? 'Manual de Usuario — SIIGPA';

const cuerpo = [];
let lista = null; // { tipo: 'ul'|'ol', instancia }
let instanciaOl = 0;
let parrafo = [];
let figuras = 0;

const cerrarParrafo = () => {
  if (!parrafo.length) return;
  cuerpo.push(new Paragraph({ style: 'Cuerpo', children: parrafo.flatMap((l, i) => [...(i ? [new TextRun({ break: 1 })] : []), ...enLinea(l)]) }));
  parrafo = [];
};

for (let i = inicioCuerpo; i < lineas.length; i++) {
  const l = lineas[i];
  const t = l.trim();

  if (!t) {
    cerrarParrafo();
    lista = null;
    continue;
  }
  const h = /^(#{2,4}) (.+)$/.exec(t);
  if (h) {
    cerrarParrafo();
    lista = null;
    const nivel = { 2: HeadingLevel.HEADING_1, 3: HeadingLevel.HEADING_2, 4: HeadingLevel.HEADING_3 }[h[1].length];
    // Cada sección principal empieza en página nueva.
    cuerpo.push(new Paragraph({ heading: nivel, pageBreakBefore: h[1].length === 2, children: [new TextRun(h[2])] }));
    continue;
  }
  const fig = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(t);
  if (fig) {
    cerrarParrafo();
    figuras++;
    const ruta = path.join(DIR_MANUAL, fig[2]);
    const pie = /^\*(.+)\*$/.exec(lineas[i + 1]?.trim() ?? '')?.[1] ?? fig[1];
    if (/^\*(.+)\*$/.test(lineas[i + 1]?.trim() ?? '')) i++;
    cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, keepLines: true, spacing: { before: 200, after: 80 }, children: [imagen(ruta, ANCHO_FIGURA_PX)] }));
    cuerpo.push(new Paragraph({ style: 'PieFigura', children: [new TextRun({ text: pie, italics: true })] }));
    continue;
  }
  if (t.startsWith('|')) {
    cerrarParrafo();
    const filas = [];
    while (i < lineas.length && lineas[i].trim().startsWith('|')) {
      const celdas = lineas[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (!celdas.every((c) => /^:?-+:?$/.test(c))) filas.push(celdas);
      i++;
    }
    i--;
    cuerpo.push(tabla(filas));
    cuerpo.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [] }));
    continue;
  }
  const ul = /^- (.+)$/.exec(t);
  const ol = /^\d+\. (.+)$/.exec(t);
  if (ul || ol) {
    cerrarParrafo();
    const tipo = ul ? 'ul' : 'ol';
    if (!lista || lista.tipo !== tipo) lista = { tipo, instancia: tipo === 'ol' ? ++instanciaOl : 0 };
    cuerpo.push(
      new Paragraph({
        style: 'Cuerpo',
        numbering: tipo === 'ul' ? { reference: 'vinetas', level: 0 } : { reference: 'numeros', level: 0, instance: lista.instancia },
        spacing: { before: 0, after: 80 },
        children: enLinea((ul ?? ol)[1]),
      }),
    );
    continue;
  }
  lista = null;
  parrafo.push(t);
}
cerrarParrafo();

// ---------- Portada ----------
const fecha = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(new Date());
const portada = [
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 480 }, children: [imagen(path.join(RAIZ, 'public', 'unlar-logo-verde.png'), 230)] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [new TextRun({ text: 'UNIVERSIDAD NACIONAL DE LA RIOJA', bold: true, size: 24, color: TINTA })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1200 }, children: [new TextRun({ text: 'Departamento Académico de Ciencias Exactas, Físicas y Naturales', size: 22, color: GRIS })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 360 }, children: [imagen(path.join(RAIZ, 'public', 'logo-SIIGPA-sidebar.png'), 300)] }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: VERDE, space: 12 } },
    children: [new TextRun({ text: titulo, bold: true, size: 52, color: VERDE })],
  }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 120 }, children: [new TextRun({ text: 'Sistema Integral de Gestión de Planificaciones Académicas', size: 28, color: TINTA })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 1400 }, children: [new TextRun({ text: '(DACEFyN – UNLaR)', size: 28, color: TINTA })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [new TextRun({ text: 'Ciclo Lectivo 2026', bold: true, size: 26, color: TINTA })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [new TextRun({ text: 'Ord. HCS N° 171/2019 · Ord. HCS N° 219/2022', size: 20, color: GRIS })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new TextRun({ text: fecha.charAt(0).toUpperCase() + fecha.slice(1), size: 20, color: GRIS })] }),
];

const indice = [
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ style: 'TituloIndice', children: [new TextRun('Índice')] }),
  new TableOfContents('Índice', { hyperlink: true, headingStyleRange: '1-3' }),
  new Paragraph({ style: 'Cuerpo', spacing: { before: 240 }, children: [new TextRun({ text: 'Si el índice aparece vacío, actualizarlo en Word con clic derecho → «Actualizar campos» (F9).', italics: true, size: 18, color: GRIS })] }),
];

const encabezado = new Header({
  children: [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDE, space: 4 } },
      children: [new TextRun({ text: 'SIIGPA | DACEFyN – UNLaR', size: 16, color: GRIS })],
    }),
  ],
});
const pie = new Footer({
  children: [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ['Página ', PageNumber.CURRENT, ' de ', PageNumber.TOTAL_PAGES], size: 16, color: GRIS })],
    }),
  ],
});
const vacio = () => new Header({ children: [new Paragraph({ children: [] })] });

const doc = new Document({
  creator: 'SIIGPA — DACEFyN UNLaR',
  title: titulo,
  description: 'Manual de Usuario del Sistema Integral de Gestión de Planificaciones Académicas',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FUENTE, size: 21, color: TINTA } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FUENTE, size: 32, bold: true, color: VERDE }, paragraph: { spacing: { before: 240, after: 200 }, keepNext: true, keepLines: true, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FUENTE, size: 26, bold: true, color: TINTA }, paragraph: { spacing: { before: 320, after: 140 }, keepNext: true, keepLines: true, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FUENTE, size: 22, bold: true, color: VERDE }, paragraph: { spacing: { before: 240, after: 100 }, keepNext: true, keepLines: true, outlineLevel: 2 } },
      { id: 'Cuerpo', name: 'Cuerpo de texto SIIGPA', basedOn: 'Normal', quickFormat: true, run: { font: FUENTE, size: 21 }, paragraph: { spacing: { before: 0, after: 140, line: 300 }, alignment: AlignmentType.JUSTIFIED } },
      { id: 'PieFigura', name: 'Pie de figura SIIGPA', basedOn: 'Normal', quickFormat: true, run: { font: FUENTE, size: 18, italics: true, color: GRIS }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 280 } } },
      { id: 'TituloIndice', name: 'Título de índice SIIGPA', basedOn: 'Normal', run: { font: FUENTE, size: 32, bold: true, color: VERDE }, paragraph: { spacing: { before: 0, after: 240 } } },
    ],
  },
  numbering: {
    config: [
      { reference: 'vinetas', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 283 } } } }] },
      { reference: 'numeros', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 567, hanging: 340 } } } }] },
    ],
  },
  sections: [
    {
      properties: { page: { size: A4, margin: { top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN, header: 708, footer: 708 } }, titlePage: true },
      headers: { first: vacio(), default: encabezado },
      footers: { first: new Footer({ children: [new Paragraph({ children: [] })] }), default: pie },
      children: [...portada, ...indice, ...cuerpo],
    },
  ],
});

fs.writeFileSync(DESTINO, await Packer.toBuffer(doc));
console.log(`✔ ${path.relative(RAIZ, DESTINO)} (${figuras} figuras, ${(fs.statSync(DESTINO).size / 1024 / 1024).toFixed(1)} MB)`);

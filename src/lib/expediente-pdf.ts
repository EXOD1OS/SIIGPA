import PDFDocument from 'pdfkit';

export type ExpedientePdfContext = {
  asignatura: string;
  carrera: string;
  sede: string;
  cicloLectivo: number;
  planEstudio: string;
  numeroExpediente: string;
  numeroResolucion: string;
  fechaAprobacion: string;
};

type PdfInput = {
  titulo: string;
  contexto: ExpedientePdfContext;
  datos: unknown;
};

function etiqueta(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (first) => first.toLocaleUpperCase('es-AR'));
}

function valorEscalar(value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'string' && /^[A-Z0-9_]+$/.test(value)) {
    return value.replaceAll('_', ' ').toLocaleLowerCase('es-AR').replace(/^./, (first) => first.toLocaleUpperCase('es-AR'));
  }
  return String(value);
}

function renderizarDato(doc: PDFKit.PDFDocument, nombre: string, valor: unknown, nivel = 0) {
  if (valor === null || valor === undefined || nivel > 12) return;
  const sangria = 42 + nivel * 12;
  if (Array.isArray(valor)) {
    doc.moveDown(0.35).font('Helvetica-Bold').fontSize(10).fillColor('#17365d').text(etiqueta(nombre), sangria);
    if (!valor.length) {
      doc.font('Helvetica').fontSize(9).fillColor('#222222').text('Sin registros.', sangria + 8);
      return;
    }
    valor.forEach((elemento, indice) => {
      if (elemento && typeof elemento === 'object') {
        doc.moveDown(0.2).font('Helvetica-Bold').fontSize(9).fillColor('#333333').text(`${etiqueta(nombre)} ${indice + 1}`, sangria + 8);
        if (Array.isArray(elemento)) renderizarDato(doc, 'Detalle', elemento, nivel + 1);
        else Object.entries(elemento as Record<string, unknown>).forEach(([clave, item]) => renderizarDato(doc, clave, item, nivel + 1));
      } else {
        doc.font('Helvetica').fontSize(9).fillColor('#222222').text(`• ${valorEscalar(elemento as string | number | boolean)}`, sangria + 8);
      }
    });
    return;
  }

  if (typeof valor === 'object') {
    doc.moveDown(0.35).font('Helvetica-Bold').fontSize(nivel === 0 ? 11 : 10).fillColor('#17365d').text(etiqueta(nombre), sangria);
    Object.entries(valor as Record<string, unknown>).forEach(([clave, item]) => renderizarDato(doc, clave, item, nivel + 1));
    return;
  }

  doc.font('Helvetica-Bold').fontSize(9).fillColor('#333333').text(`${etiqueta(nombre)}: `, sangria, doc.y, { continued: true });
  doc.font('Helvetica').fontSize(9).fillColor('#222222').text(valorEscalar(valor as string | number | boolean), { width: 510 - nivel * 12 });
}

export async function generarPdfExpediente({ titulo, contexto, datos }: PdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 52, right: 48, bottom: 62, left: 48 },
    bufferPages: true,
    info: { Title: titulo, Author: 'SIGA-Planificaciones — UNLaR', Subject: 'Expediente académico finalizado' },
  });
  const chunks: Buffer[] = [];
  const resultado = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.font('Helvetica-Bold').fontSize(15).fillColor('#12345a').text('UNIVERSIDAD NACIONAL DE LA RIOJA', { align: 'center' });
  doc.moveDown(0.2).font('Helvetica').fontSize(9).fillColor('#555555').text('DACEFyN · Sistema de Gestión de Planificaciones', { align: 'center' });
  doc.moveDown(0.9).font('Helvetica-Bold').fontSize(14).fillColor('#111827').text(titulo, { align: 'center' });
  doc.moveDown(0.8);
  doc.font('Helvetica').fontSize(9).fillColor('#222222');
  doc.text(`Carrera: ${contexto.carrera} · Sede: ${contexto.sede}`);
  doc.text(`Asignatura: ${contexto.asignatura} · Plan: ${contexto.planEstudio} · Ciclo lectivo: ${contexto.cicloLectivo}`);
  doc.text(`Expediente: ${contexto.numeroExpediente} · Resolución: ${contexto.numeroResolucion}`);
  doc.text(`Fecha de aprobación: ${contexto.fechaAprobacion}`);
  doc.moveDown(0.7).strokeColor('#cbd5e1').moveTo(48, doc.y).lineTo(547, doc.y).stroke();
  doc.moveDown(0.4);

  if (datos && typeof datos === 'object' && !Array.isArray(datos)) {
    Object.entries(datos as Record<string, unknown>).forEach(([clave, valor]) => renderizarDato(doc, clave, valor));
  } else {
    renderizarDato(doc, 'Contenido', datos);
  }

  const paginas = doc.bufferedPageRange();
  for (let pagina = 0; pagina < paginas.count; pagina += 1) {
    doc.switchToPage(paginas.start + pagina);
    const y = doc.page.height - 39;
    doc.strokeColor('#e2e8f0').moveTo(48, y - 8).lineTo(547, y - 8).stroke();
    doc.font('Helvetica').fontSize(8).fillColor('#64748b')
      .text(`Documento archivado · ${contexto.numeroExpediente}`, 48, y, { width: 360, lineBreak: false });
    doc.text(`Página ${pagina + 1} de ${paginas.count}`, 420, y, { width: 127, align: 'right', lineBreak: false });
  }

  doc.end();
  return resultado;
}
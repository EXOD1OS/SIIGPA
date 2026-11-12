'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CAMPOS_ASPECTOS, NUMERO_DISTRIBUCION, TITULO_DISTRIBUCION, type AspectosGeneralesPaad } from '@/types/paad';
import type { PaadData } from '@/types/planificacion';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;
const DIA_LABEL: Record<(typeof DIAS)[number], string> = { lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles', jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado' };
const ACTIVIDAD_LABEL: Record<string, string> = { ENSENANZA: 'Enseñanza', INVESTIGACION: 'Investigación', EXTENSION: 'Extensión', FORMACION: 'Formación', GESTION: 'Gestión' };

const unir = (...partes: (string | undefined)[]) => partes.map((p) => p?.trim()).filter(Boolean).join(' – ');
const items = (l: (string | undefined)[]) => l.map((x) => x?.trim() ?? '').filter(Boolean);
const parrafos = (t: string | undefined) => items((t ?? '').split(/\n+/));

/** Apartados 1) a 7) del Anexo III armados con el contenido real del PaadAnual. */
function apartados(d: PaadData): { numero: number; titulo: string; subs: { letra?: string; titulo?: string; listas: { etiqueta?: string; items: string[] }[] }[] }[] {
  const ae = d.actividadEnsenanza;
  return [
    {
      numero: 1,
      titulo: 'ACTIVIDAD DE ENSEÑANZA',
      subs: [
        {
          letra: 'a',
          titulo: 'Curso/s y/o Asignatura/s atendido/s:',
          listas: [
            { etiqueta: 'Cursos y/o asignaturas atendidos', items: items(ae.cursosAtendidos) },
            { etiqueta: 'Capacitaciones en las que participará', items: items(ae.capacitaciones.map((c) => unir(c.nombreCapacitacion, c.lugar, c.fecha, c.tematica, c.areaConocimiento))) },
          ],
        },
        {
          letra: 'b',
          titulo: 'Preparación de Manuales, Guías de Trabajos Prácticos, Nuevos Programas de Estudios, etc.:',
          listas: [{ items: items(ae.materialElaborado.map((m) => unir(m.areaConocimiento, m.tipo, m.autores, m.fecha))) }],
        },
        {
          letra: 'c',
          titulo: 'Otros trabajos de índole específicamente Docente que se consideren pertinentes:',
          listas: [{ items: items(ae.otrosTrabajosDocentes.map((o) => unir(o.areaTematica, o.lugar, o.fecha, o.destinatarios, o.nivel))) }],
        },
      ],
    },
    { numero: 2, titulo: 'ACTIVIDADES DE INVESTIGACIÓN', subs: [{ listas: [{ items: items(d.investigacion.map((i) => unir(i.proyecto, i.descripcion, i.cargo, i.numeroResolucion && `Res. ${i.numeroResolucion}`, i.etapa))) }] }] },
    { numero: 3, titulo: 'ACTIVIDAD DE FORMACIÓN DE RECURSOS HUMANOS', subs: [{ listas: [{ items: parrafos(d.formacionRecursosHumanos.detalle) }] }] },
    { numero: 4, titulo: 'ACTIVIDADES DE FORMACIÓN ACADÉMICA Y/O ESPECIALIZACIÓN PROFESIONAL', subs: [{ listas: [{ items: parrafos(d.formacionAcademica.detalle) }] }] },
    { numero: 5, titulo: 'ACTIVIDADES DE EXTENSIÓN', subs: [{ listas: [{ items: items(d.extension.map((e) => unir(e.proyecto, e.destinatarios, e.tiempoLugar, e.alumnosInvolucrados, e.informe))) }] }] },
    { numero: 6, titulo: 'ACTIVIDADES DE ADMINISTRACIÓN Y GOBIERNO UNIVERSITARIO', subs: [{ listas: [{ items: parrafos(d.gestion.detalle) }] }] },
    { numero: 7, titulo: 'OTRAS ACTIVIDADES NO PREVISTAS EN LOS APARTADOS ANTERIORES', subs: [{ listas: [{ items: items(d.otrasActividades) }] }] },
  ];
}

function Vinetas({ lista }: { lista: string[] }) {
  if (lista.length === 0) return <p className="ml-6 italic text-neutral-500">Sin actividades declaradas.</p>;
  return (
    <ul className="ml-10 list-disc space-y-0.5">
      {lista.map((it, i) => (
        <li key={i} className="pl-1">
          {it}
        </li>
      ))}
    </ul>
  );
}

function Hoja({ aspectos, datos, impresion = false }: { aspectos: AspectosGeneralesPaad; datos: PaadData; impresion?: boolean }) {
  return (
    <article
      aria-label={impresion ? undefined : 'Vista previa del PAAD – Anexo III, Ordenanza Nº 171/19'}
      className={`mx-auto w-full bg-white font-['Times_New_Roman',Times,serif] text-[12.5px] leading-[1.45] text-black ${
        impresion ? 'max-w-none px-[18mm] py-[14mm]' : 'max-w-[210mm] px-[14mm] py-[12mm] shadow-[0_8px_30px_rgba(0,0,0,0.18)] sm:min-h-[297mm] sm:px-[20mm] sm:py-[16mm]'
      }`}
    >
      <header className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- la hoja se imprime tal cual */}
        <img src="/unlar-escudo.png" alt="Escudo de la Universidad Nacional de La Rioja" className="mx-auto h-20 w-20 object-contain" />
        <p className="mt-2 text-[14px] font-bold tracking-wide">UNIVERSIDAD NACIONAL DE LA RIOJA</p>
        <p className="text-[13px] italic">Consejo Superior</p>
      </header>

      <div className="mx-auto mt-5 w-fit border-2 border-black px-8 py-2 text-center">
        <p className="text-[13px] font-bold">ANEXO III – ORDENANZA Nº 171/19</p>
        <p className="text-[13px] font-bold">PLAN ANUAL DE ACTIVIDADES DEL DOCENTE</p>
      </div>

      <section className="mt-6">
        <p className="font-bold underline">ASPECTOS GENERALES</p>
        <dl className="mt-2 space-y-0.5">
          {CAMPOS_ASPECTOS.map(({ key, label }) => (
            <div key={key} className="flex gap-1.5">
              <dt className="shrink-0 font-bold">{label}:</dt>
              <dd>{aspectos[key] || '..........................................'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-5 text-justify italic">
        Estimado profesor: Detalle las actividades que planifica llevar a cabo durante el presente año lectivo, de acuerdo con los siguientes aspectos y en
        función de su categoría y dedicación.
      </p>

      <div className="mt-4 space-y-4">
        {apartados(datos).map((ap) => (
          <section key={ap.numero} className="break-inside-avoid-page">
            <p className="font-bold">
              {ap.numero}) {ap.titulo}
            </p>
            <div className="mt-1.5 space-y-2">
              {ap.subs.map((sub, i) => (
                <div key={i}>
                  {sub.letra && (
                    <p className="ml-4 font-bold">
                      {sub.letra}) {sub.titulo}
                    </p>
                  )}
                  {sub.listas.map((l, j) => (
                    <div key={j} className="mt-1">
                      {l.etiqueta && sub.listas.length > 1 && <p className="ml-6 italic">{l.etiqueta}:</p>}
                      <Vinetas lista={l.items} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="mt-6 break-inside-avoid-page">
        <p className="font-bold">
          {NUMERO_DISTRIBUCION}) {TITULO_DISTRIBUCION.toUpperCase()}
        </p>
        <table className="mt-2 w-full border-collapse border border-black text-center text-[12px]">
          <thead>
            <tr>
              <th scope="col" className="border border-black px-2 py-1 text-left font-bold">
                Actividad
              </th>
              {DIAS.map((d) => (
                <th key={d} scope="col" className="border border-black px-2 py-1 font-bold">
                  {DIA_LABEL[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {datos.distribucionHoraria.map((fila) => (
              <tr key={fila.actividad}>
                <th scope="row" className="border border-black px-2 py-1 text-left font-normal">
                  {ACTIVIDAD_LABEL[fila.actividad] ?? fila.actividad}
                </th>
                {DIAS.map((d) => (
                  <td key={d} className="h-7 border border-black px-2 py-1">
                    {fila[d] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-16 flex justify-end print:mt-20">
        <div className="w-56 border-t border-black pt-1 text-center text-[11.5px]">
          Firma y aclaración del docente
          <div className="mt-0.5 font-bold">{aspectos.presentadoPor}</div>
        </div>
      </div>
    </article>
  );
}

/**
 * Hoja A4 del ANEXO III – ORDENANZA Nº 171/19. Monta además una copia en <body> (clase `doc-print`)
 * que es lo único que se imprime con «Descargar PDF», aunque la hoja esté dentro de un modal con scroll.
 */
export function PaadDocumentoOficial({ aspectos, datos }: { aspectos: AspectosGeneralesPaad; datos: PaadData }) {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  return (
    <>
      <Hoja aspectos={aspectos} datos={datos} />
      {montado &&
        createPortal(
          <div className="print-area doc-print" aria-hidden>
            <Hoja aspectos={aspectos} datos={datos} impresion />
          </div>,
          document.body,
        )}
    </>
  );
}

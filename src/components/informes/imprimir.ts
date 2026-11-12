'use client';

/**
 * Abre el diálogo de impresión solo con la hoja oficial montada en <body> (clase `doc-print`):
 * el usuario elige «Guardar como PDF». Ver las reglas `body[data-imprimiendo]` en globals.css.
 */
export function imprimirHojaOficial() {
  const body = document.body;
  body.dataset.imprimiendo = '1';
  const limpiar = () => {
    delete body.dataset.imprimiendo;
    window.removeEventListener('afterprint', limpiar);
  };
  window.addEventListener('afterprint', limpiar);
  window.print();
  // Algunos navegadores no disparan afterprint de forma confiable.
  window.setTimeout(limpiar, 1000);
}

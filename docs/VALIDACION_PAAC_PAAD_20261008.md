# Validación de la separación PAAC/PAAD — 08/10/2026

## Resultado

El PAAC es de una materia y ciclo; el PAAD es un documento personal único por docente y año.
Presentar, observar, corregir o aprobar uno no modifica el estado del otro.
El equipo consulta el mismo PAAD anual desde sus distintas materias.

## Entornos

- Pruebas de integración y navegador: copia aislada `siga_paad_qa_20261008_v1`.
- Instalación completa: base inicialmente vacía `siga_paad_vacia_20261008_v2`.
- Compilación: `.next-qa-build`, separada del servidor de demostración.
- Base local habitual: `siga_qa_20261008`, actualizada después de probar la conversión.
- Respaldo previo intacto: `siga_paad_respaldo_20261008_v1`, en el PostgreSQL local.

Los usuarios ficticios, dictámenes, expedientes y resoluciones de esta prueba se crearon
solo en la copia aislada. No se trasladaron a la base habitual.

## Pruebas automatizadas

- `npm run test:paad`: 9 casos de selección de fuentes, comparación JSON y detección de conflictos.
- `npm run test:paad:integracion`: 42 comprobaciones contra PostgreSQL.
  Incluye unicidad anual, guardar sin presentar, snapshots inmutables, autoría de nuevas
  presentaciones, reenvío, dictámenes paralelos y dos envíos concurrentes.
  Verifica permisos de propietario, equipo y direcciones, elección manual de Dirección,
  rechazo de edición aprobada y de aprobación/reenvío con observaciones abiertas.
  También prueba repetición de ciclos y de conversión, conservación de observaciones
  antiguas, conflictos y no recrear integrantes quitados después de migrar.
- `prisma validate`, `prisma generate`, lint, TypeScript y build de producción: correctos.
- Las cinco migraciones se aplicaron desde cero y el seed se ejecutó correctamente.

## Recorridos comprobados en el navegador

1. Cristian Bazán envió el PAAC de Programación II (2026) con PAAD del equipo pendientes.
2. Guardó su PAAD personal y luego lo presentó por separado.
3. UAP observó el PAAD. El PAAC permaneció en revisión y pudo recibir aprobación pedagógica.
4. El docente corrigió el contenido, guardó, resolvió la observación y volvió a presentar.
   La primera presentación permaneció en el historial.
5. UAP y Dirección ISI aprobaron la segunda presentación. El PAAD quedó aprobado y de solo lectura.
6. Dirección aprobó el PAAC, se firmó el informe general por ambas instancias y se elevó al Consejo.
7. Consejo asignó expediente `QA-PAAC-2026-008` y resolución `QA-RES-2026-008`.
   El PAAC quedó finalizado mientras Marcelo Roldán seguía sin presentar su PAAD.
8. Administración creó un docente ficticio sin materia; recibió su PAAD de 2026
   con Dirección pendiente. Al asignar la Dirección responsable se habilitó la presentación.
9. Administración comparó dos copias antiguas diferentes. El documento estuvo bloqueado
   hasta seleccionar la fuente A. Se recuperó su contenido y observación pendiente;
   la fuente B siguió disponible como antecedente de solo lectura.
10. Dirección LSI intentó abrir por URL el PAAD de Bazán (evaluado por ISI):
    el servidor devolvió 404, sin mostrar contenido ni controles.

La concurrencia y los intentos de acciones no autorizadas se verificaron mediante las
pruebas de integración; no se simularon pulsando botones secuencialmente.

## Conversión de la base local habitual

Primera ejecución: 132 documentos anuales convertidos, sin conflictos.
Segunda ejecución: 0 conversiones y 0 conflictos nuevos.

La comparación de todas las columnas contra el respaldo verificó que permanecen intactos:

| Tabla anterior | Registros conservados |
| --- | ---: |
| Planificacion (estados, contenido, informes, expedientes y resoluciones) | 119 |
| PaadDocente (copias anteriores) | 220 |
| ItemObservacion (observaciones anteriores) | 1 |
| AsignacionCatedra | 222 |
| Usuario | 71 |

La herramienta de comprobación es `tests/verificar-conservacion-paad.ts` y solo hace lecturas.
El seed no se ejecutó sobre la base habitual.

## Ajustes detectados durante la validación

- No atribuir aprobaciones del PAAC a un PAAD convertido.
- Detectar conflictos entre copias vacías con antecedentes diferentes, incluso con igual
  cantidad de observaciones.
- Evitar que repetir la conversión reincorpore integrantes quitados.
- Refrescar el formulario al elegir una fuente de migración.
- Distinguir el control actual de presentación del PAAD del control histórico guardado en un informe.
- Mantener atómicas las actualizaciones de equipo, asignación y PAAD anual.

No incluye generación oficial de PDF, notificaciones, nuevos campos documentales ni
un circuito de Consejo para el PAAD. Estas pruebas cubren el incremento aprobado,
no certifican todos los comportamientos posibles del sistema.

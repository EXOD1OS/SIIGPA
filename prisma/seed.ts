import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import type {
  PaacCompetenciasData,
  PaadData,
  PedagogicalReportData,
  DisciplinaryReportData,
} from '../src/types/planificacion';
import { ISI_CATEDRAS } from './isi-catedras';
import { generarPlanificacionesDelCiclo } from '../src/lib/generar-planificaciones';
import { defaultPaad } from '../src/lib/defaults';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "ItemObservacion", "PaadDocente", "Planificacion", "Asignatura", "PlanEstudio", "Usuario", "Carrera", "Departamento", "Sede" CASCADE;`
  );

  const passwordHash = await bcrypt.hash('unlar2026', 10);
  const sede = await prisma.sede.create({ data: { nombre: 'Sede Capital - La Rioja', esCapital: true } });
  // Sede regional de ejemplo: en el árbol de jerarquía académica las carreras
  // cuelgan directo de la sede, sin el nivel intermedio de Departamento.
  const sedeChilecito = await prisma.sede.create({ data: { nombre: 'Sede Chilecito', esCapital: false } });
  const deptoExactas = await prisma.departamento.create({
    data: { nombre: 'Departamento Académico de Ciencias Exactas, Físicas y Naturales (DACEFyN)' },
  });
  const deptoHumanas = await prisma.departamento.create({
    data: { nombre: 'Departamento Académico de Ciencias Humanas y de la Educación' },
  });

  const tui = await prisma.carrera.create({
    data: { nombre: 'Tecnicatura Universitaria en Informática', codigo: 'TUI', departamentoId: deptoExactas.id, sedeId: sede.id },
  });
  const isi = await prisma.carrera.create({
    data: { nombre: 'Ingeniería en Sistemas de Información', codigo: 'ISI', departamentoId: deptoExactas.id, sedeId: sede.id },
  });
  const lsi = await prisma.carrera.create({
    data: { nombre: 'Licenciatura en Sistemas de Información', codigo: 'LSI', departamentoId: deptoExactas.id, sedeId: sede.id },
  });
  // Carrera de otro departamento, usada para el caso de materias interdepartamentales
  // (ej. Derecho Informático): pertenece a un plan de Exactas pero se radica y evalúa
  // disciplinarmente en la dirección de esta carrera de Humanas.
  const cienciasEducacion = await prisma.carrera.create({
    data: { nombre: 'Licenciatura en Ciencias de la Educación', codigo: 'LCE', departamentoId: deptoHumanas.id, sedeId: sede.id },
  });

  const tuiChilecito = await prisma.carrera.create({
    data: {
      nombre: 'Tecnicatura Universitaria en Informática',
      codigo: 'TUI-CH',
      departamentoId: deptoExactas.id,
      sedeId: sedeChilecito.id,
    },
  });

  const planTui171 = await prisma.planEstudio.create({
    data: { carreraId: tui.id, ordenanza: 'Ord. HCS 171/2019', enfoque: 'TRADICIONAL' },
  });
  const planTuiChilecito171 = await prisma.planEstudio.create({
    data: { carreraId: tuiChilecito.id, ordenanza: 'Ord. HCS 171/2019', enfoque: 'TRADICIONAL' },
  });
  const planIsiNuevo = await prisma.planEstudio.create({
    data: { carreraId: isi.id, ordenanza: 'Ord. C.S. 235/2023 y 236/2023', enfoque: 'COMPETENCIAS' },
  });
  const planLsiNuevo = await prisma.planEstudio.create({
    data: { carreraId: lsi.id, ordenanza: 'Ord. C.S. 231/2023', enfoque: 'COMPETENCIAS' },
  });

  const analisisMatI = await prisma.asignatura.create({
    data: {
      planEstudioId: planLsiNuevo.id,
      departamentoRadicacionId: deptoExactas.id,
      nombre: 'Análisis Matemático I',
      anoCursada: 1,
      regimen: '1C',
      creditoHorario: 90,
      contenidosMinimosOficiales:
        'Cálculo diferencial e integral en una variable: funciones elementales de una variable real, gráficos, límite y continuidad, derivadas de una función, reglas de derivación y propiedades.',
    },
  });

  const prog1 = await prisma.asignatura.create({
    data: {
      planEstudioId: planIsiNuevo.id,
      departamentoRadicacionId: deptoExactas.id,
      nombre: 'Programación I',
      anoCursada: 2,
      regimen: 'ANUAL',
      creditoHorario: 120,
      contenidosMinimosOficiales:
        'Programación imperativa. Algoritmos, procesos, estructuras de control, funciones, arreglos, punteros y concurrencia.',
    },
  });

  const introProgChilecito = await prisma.asignatura.create({
    data: {
      planEstudioId: planTuiChilecito171.id,
      departamentoRadicacionId: deptoExactas.id,
      nombre: 'Introducción a la Programación',
      anoCursada: 1,
      regimen: 'ANUAL',
      creditoHorario: 90,
      contenidosMinimosOficiales: 'Lógica de programación, algoritmos básicos, pseudocódigo y primer lenguaje de programación.',
    },
  });

  const basesDatos = await prisma.asignatura.create({
    data: {
      planEstudioId: planTui171.id,
      departamentoRadicacionId: deptoExactas.id,
      nombre: 'Base de Datos I',
      anoCursada: 2,
      regimen: '2C',
      creditoHorario: 90,
      contenidosMinimosOficiales: 'Modelo relacional, SQL, normalización, diseño de esquemas, integridad referencial.',
    },
  });

  // Caso interdepartamental (Restricción 3 del alcance): pertenece al plan de ISI pero
  // se radica administrativamente en Ciencias Humanas y su informe disciplinar lo
  // evalúa la dirección de esa carrera, no la de ISI.
  const derechoInf = await prisma.asignatura.create({
    data: {
      planEstudioId: planIsiNuevo.id,
      departamentoRadicacionId: deptoHumanas.id,
      carreraEvaluadoraId: cienciasEducacion.id,
      nombre: 'Derecho Informático y Ética Profesional',
      anoCursada: 5,
      regimen: '1C',
      creditoHorario: 75,
      contenidosMinimosOficiales:
        'Propiedad intelectual, delitos informáticos, protección de datos, ética profesional y responsabilidad legal del software.',
    },
  });

  await prisma.usuario.create({
    data: { email: 'admin@unlar.edu.ar', dni: '10000001', passwordHash, nombre: 'Admin', apellido: 'DACEFyN', rol: UserRole.ADMINISTRADOR },
  });
  await prisma.usuario.create({
    data: {
      email: 'direccion.isi@unlar.edu.ar',
      dni: '10000002',
      passwordHash,
      nombre: 'Carlos',
      apellido: 'Director ISI',
      rol: UserRole.DIRECCION_CARRERA,
      carreraId: isi.id,
    },
  });
  await prisma.usuario.create({
    data: {
      email: 'direccion.lsi@unlar.edu.ar',
      dni: '10000003',
      passwordHash,
      nombre: 'Ana',
      apellido: 'Directora LSI',
      rol: UserRole.DIRECCION_CARRERA,
      carreraId: lsi.id,
    },
  });
  await prisma.usuario.create({
    data: {
      email: 'direccion.educacion@unlar.edu.ar',
      dni: '10000004',
      passwordHash,
      nombre: 'Rosa',
      apellido: 'Directora Cs. Educación',
      rol: UserRole.DIRECCION_CARRERA,
      carreraId: cienciasEducacion.id,
    },
  });
  await prisma.usuario.create({
    data: { email: 'uap@unlar.edu.ar', dni: '10000005', passwordHash, nombre: 'Gabinete', apellido: 'UAP Exactas', rol: UserRole.UAP },
  });
  await prisma.usuario.create({
    data: {
      email: 'consejo.exactas@unlar.edu.ar',
      dni: '10000006',
      passwordHash,
      nombre: 'Secretaría',
      apellido: 'Consejo Departamental',
      rol: UserRole.CONSEJO_DEPARTAMENTAL,
    },
  });

  const profLastra = await prisma.usuario.create({
    data: {
      email: 'lastra.mariana@unlar.edu.ar',
      dni: '20000001',
      passwordHash,
      nombre: 'Mariana Soledad',
      apellido: 'Lastra',
      rol: UserRole.DOCENTE,
    },
  });
  const profNieto = await prisma.usuario.create({
    data: {
      email: 'nieto.alejandro@unlar.edu.ar',
      dni: '20000002',
      passwordHash,
      nombre: 'Alejandro Daniel',
      apellido: 'Nieto',
      rol: UserRole.DOCENTE,
    },
  });
  const profTitular = await prisma.usuario.create({
    data: { email: 'titular.prog@unlar.edu.ar', dni: '20000003', passwordHash, nombre: 'Juan', apellido: 'Pérez', rol: UserRole.DOCENTE },
  });
  const profAuxiliar = await prisma.usuario.create({
    data: { email: 'auxiliar.prog@unlar.edu.ar', dni: '20000004', passwordHash, nombre: 'María', apellido: 'Gómez', rol: UserRole.DOCENTE },
  });

  // ---------------------------------------------------------------------------
  // Planificación 1: Análisis Matemático I (LSI, plan por competencias) — 2024
  // Cargada con el contenido real de tus documentos, en estado APROBADO_PLENO
  // para poder probar el paso nuevo del Informe General de PAAC.
  // ---------------------------------------------------------------------------

  const datosPaacAnalisis: PaacCompetenciasData = {
    encabezado: {
      sede: 'UNLaR - Capital',
      carrera: 'Licenciatura en Sistemas de Información',
      planEstudio: 'Ord. C.S. 231/2023',
      curso: 'Primer año, primer cuatrimestre',
      asignatura: 'Análisis Matemático I',
      regimen: '1C',
      creditoHorario: 90,
      horasTeoricas: 45,
      horasPracticas: 45,
      equipoCatedra: [
        { cargo: 'ADJUNTO', nombre: 'Lastra Mariana' },
        { cargo: 'JTP', nombre: 'Nieto Alejandro' },
      ],
      contenidosMinimos:
        'Cálculo diferencial e integral en una variable: funciones elementales de una variable real, gráficos, límite y continuidad, derivadas de una función, reglas de derivación y propiedades.',
      nivelIntensidad: 3,
      relacionTeoricoPractica: 't=p',
    },
    fundamentacion: {
      importanciaAsignatura:
        'Cuando un Ingeniero en Sistemas de la Información quiere saber cómo funciona un sistema recurre a la resolución de problemas y el Análisis Matemático se presenta como una herramienta al servicio de la resolución. El espacio académico pertenece al bloque Ciencias Básicas, aportando fundamentos para el desarrollo de competencias lógico-matemáticas y científicas de la carrera.',
      matrizCompetencias: [
        { codigo: 'CG1', tipo: 'GENERAL_TECNOLOGICA', detalle: 'Identificar, formular y resolver problemas de ingeniería.', nivelAporte: 0 },
        { codigo: 'CG6', tipo: 'GENERAL_SOCIAL_POLITICA_ACTITUDINAL', detalle: 'Desempeñarse de manera efectiva en equipos de trabajo.', nivelAporte: 0 },
        { codigo: 'CG7', tipo: 'GENERAL_SOCIAL_POLITICA_ACTITUDINAL', detalle: 'Comunicarse con efectividad.', nivelAporte: 0 },
        { codigo: 'CG9', tipo: 'GENERAL_SOCIAL_POLITICA_ACTITUDINAL', detalle: 'Aprender en forma continua y autónoma.', nivelAporte: 0 },
        {
          codigo: 'CE1.1',
          tipo: 'ESPECIFICA',
          detalle: 'Especificar, proyectar y desarrollar sistemas de información cuya utilización pueda afectar la seguridad, salud, bienes o derechos.',
          nivelAporte: 0,
        },
      ],
      diagnostico: {
        articulacionCorrelativas: 'Los estudiantes de esta cátedra son ingresantes a la universidad, por lo que se aplican estrategias de refuerzo y articulación con el nivel medio.',
        articulacionMismoAno: 'Se articula con Álgebra y Geometría Analítica y con Algoritmo y Estructura de Datos; con Análisis Matemático II como correlativa directa.',
        analisisEstudiantes:
          'Nivel básico a intermedio de conocimientos en álgebra y trigonometría, escaso manejo de funciones y límites. Cantidad importante de recursantes. Contexto sociocultural diverso, con acceso desigual a tecnología y recursos.',
        infraestructuraRequerida:
          'Aulas equipadas con pizarras para demostraciones matemáticas, material didáctico complementario (guías, apuntes, multimedia), tecnología básica (proyectores) y acceso a bibliografía y recursos en línea.',
      },
    },
    objetivosPropositoRA: {
      objetivosCarrera:
        'Formar profesionales en Ingeniería/Licenciatura en Sistemas de Información capaces de actuar con eficiencia, responsabilidad, creatividad y sentido crítico, con sólida formación técnica y capacidad de trabajo en equipos multidisciplinarios.',
      propositoAsignatura: [
        'Brindar herramientas matemáticas sólidas para el estudio de problemas elementales de los sistemas de información.',
        'Desarrollar el pensamiento crítico mediante la resolución de problemas y construcciones intra-matemáticas.',
        'Desarrollar las fórmulas del cálculo para estudiar funciones, límite, continuidad y diferenciabilidad.',
        'Manejar software de aplicación y simulación para resolver problemas de Análisis Matemático con cálculo de una variable.',
      ],
      resultadosAprendizaje: [
        { codigo: 'RA1', detalle: 'Entiende y aplica los conceptos y propiedades de las funciones escalares para delimitar su funcionalidad en diversos contextos.' },
        { codigo: 'RA2', detalle: 'Comprende analíticamente el concepto de límite de una función y su interpretación gráfica para calcularlo en contextos de resolución de problemas.' },
        { codigo: 'RA3', detalle: 'Define e identifica geométrica y algebraicamente el concepto de derivada para resolver problemas en diversos contextos.' },
      ],
    },
    metodologia: {
      enfoque:
        'Aprendizaje activo centrado en el estudiante: trabajo en equipos colaborativos, aula invertida, debate guiado, estudio de casos y uso del aula virtual de la universidad.',
      propuestaDesarrolloCompetencias: [
        {
          competencia: 'CG6-CG10',
          resultadoAprendizaje: 'RA1',
          unidadTema: 'Unidad 1 - Funciones de una variable real',
          guiaTp: 'TP N°1',
          actividadFormativa: 'Clase magistral teórico-práctica, tutorías, estudio en grupo e individual',
          estrategiaEnsenanza: 'Aprendizaje activo, debate, clase expositiva dialogada, resolución de problemas, autoevaluación',
        },
        {
          competencia: 'CG6-CG10',
          resultadoAprendizaje: 'RA2',
          unidadTema: 'Unidad 2 - Límite y continuidad',
          guiaTp: 'TP N°2 y N°3',
          actividadFormativa: 'Clase magistral teórico-práctica, tutorías, estudio en grupo e individual',
          estrategiaEnsenanza: 'Aprendizaje activo, debate, clase expositiva dialogada, resolución de problemas, autoevaluación',
        },
        {
          competencia: 'CG6-CG10',
          resultadoAprendizaje: 'RA3',
          unidadTema: 'Unidad 3 - Función Derivada',
          guiaTp: 'TP N°4 y N°5',
          actividadFormativa: 'Clase magistral teórico-práctica, tutorías, estudio en grupo e individual',
          estrategiaEnsenanza: 'Aprendizaje activo, debate, clase expositiva dialogada, resolución de problemas, autoevaluación',
        },
      ],
    },
    contenidos: [
      { unidad: 1, titulo: 'Funciones de una variable real', detalle: 'Orden y desigualdades, valor absoluto y distancia, intervalos, entornos. Funciones: definición, representaciones gráficas, campo de existencia. Funciones algebraicas y trascendentes. Combinación y composición de funciones. Inversa de una función.' },
      { unidad: 2, titulo: 'Límite y Continuidad', detalle: 'Límite de una función en un punto. Álgebra de límites. Infinitésimos e infinitos. Límites laterales. Funciones continuas en un punto y en un intervalo. Discontinuidad infinita. El número e.' },
      { unidad: 3, titulo: 'Función Derivada', detalle: 'La recta tangente a una curva. Derivada en un punto. Función derivada. Regla de la cadena y de la potencia. Derivadas de orden n. Teoremas de Rolle, Lagrange y Cauchy. Aplicaciones.' },
    ],
    programaTrabajosPracticos: [
      { numero: 1, titulo: 'Funciones de una variable real', proposito: ['Resolver ecuaciones e inecuaciones en contextos problematizadores', 'Aplicar el concepto de función y graficar con fluidez'], modalidad: 'Individual y grupal', unidadTemas: 'Unidad 1' },
      { numero: 2, titulo: 'Límites', proposito: ['Comprender el concepto de límite y sus representaciones', 'Aplicar estrategias algebraicas para límites indeterminados'], modalidad: 'Grupal/Individual', unidadTemas: 'Unidad 2' },
      { numero: 3, titulo: 'Continuidad', proposito: ['Analizar la continuidad de una función y clasificar discontinuidades'], modalidad: 'Individual y grupal', unidadTemas: 'Unidad 2' },
      { numero: 4, titulo: 'Derivadas', proposito: ['Definir la derivada y su interpretación geométrica', 'Calcular derivadas con estrategias algebraicas'], modalidad: 'Individual y grupal', unidadTemas: 'Unidad 3' },
      { numero: 5, titulo: 'Aplicaciones con Derivadas', proposito: ['Estudiar aplicaciones prácticas de la derivada en diferentes contextos'], modalidad: 'Individual y grupal', unidadTemas: 'Unidad 3' },
    ],
    evaluacion: {
      tipos: ['INICIAL', 'DE_PROCESO', 'FINAL'],
      criterios: [
        'Utiliza los diferentes tipos de funciones reconociendo sus elementos constitutivos.',
        'Aplica propiedades numéricas, geométricas y algebraicas para el manipuleo de fórmulas.',
        'Utiliza reglas de derivación para la resolución de problemas de aplicación.',
        'Resuelve ejercicios rutinarios de límites y derivadas.',
        'Fundamenta las ideas para resolver un problema matemático.',
      ],
      tecnicas: ['Observación', 'Lista de cotejo', 'Encuestas auto asistidas', 'Trabajos prácticos', 'Pruebas escritas', 'Coloquio'],
      regimenAprobacion: {
        promocional: 'Cumplir actividades de autoevaluación digital y aprobar las dos pruebas parciales con nota 7 o mayor sin recuperar, 80% de asistencia y 80% de TP resueltos con nota 7 o mayor.',
        regular: 'Aprobar las dos pruebas parciales con nota 4 o mayor, pudiendo recuperar ambas. 80% de asistencia y 80% de TP resueltos. Final escrito u oral.',
        libre: 'Examen final escrito con resolución de ejercicios y oral o escrito en conceptos teóricos, con el desarrollo de todo el programa.',
      },
    },
    bibliografia: {
      basica: [
        { titulo: 'Manual de análisis matemático', autores: 'Repetto, Celina', editorial: 'Macchi', ano: 1989 },
        { titulo: 'Cálculo diferencial e integral', autores: 'Piskunov, N.', editorial: 'Limusa', ano: 1999 },
        { titulo: 'Cálculo', autores: 'Thomas, George B.', editorial: 'Pearson Educación', ano: 2006 },
        { titulo: 'Cálculo', autores: 'Stewart, James', editorial: 'Cengage Learning', ano: 2010 },
      ],
      complementaria: [
        { titulo: 'Matemáticas para Administración y Economía', autores: 'Haeussler, E. y Paul, R.', editorial: 'Grupo Editorial Iberoamérica', ano: 1997 },
        { titulo: 'Cálculo Diferencial e Integral', autores: 'Piskunov, N.', editorial: 'Limusa', ano: 1998, enlace: 'https://docs.google.com/file/d/0B-0oGwb4N6jRcUF1b3laOExLeVU' },
      ],
    },
    horariosClases: [
      { dia: 'MARTES', horasTeoricas: '18 a 21 hs' },
      { dia: 'VIERNES', horasPracticas: '10 a 13 hs' },
    ],
    cronograma: [
      { semana: 1, unidad: 1, horasTeoricas: 3, tpNumero: 1, horasPracticas: 3 },
      { semana: 5, unidad: 2, horasTeoricas: 3, tpNumero: 2, horasPracticas: 3 },
      { semana: 9, unidad: 2, horasTeoricas: 3, tpNumero: 3, horasPracticas: 3, evaluacion: '1er parcial' },
      { semana: 10, unidad: 3, horasTeoricas: 3, tpNumero: 4, horasPracticas: 3, evaluacion: 'recuperatorio' },
      { semana: 14, unidad: 3, horasTeoricas: 3, tpNumero: 5, horasPracticas: 3, evaluacion: '2do parcial' },
      { semana: 15, unidad: 3, horasTeoricas: 3, tpNumero: 5, horasPracticas: 3, evaluacion: 'recuperatorio' },
    ],
  };

  const paadLastra: PaadData = {
    actividadEnsenanza: {
      cursosAtendidos: ['TUI - Biogenética, Matemática, 1° año', 'Lic. en Ciencias Biológicas, Álgebra, 1° año', 'Arquitectura, Elementos de la Matemática, 2° año', 'ISI, LSI, Análisis Matemático, 1° año'],
      capacitaciones: [],
      materialElaborado: [
        { areaConocimiento: 'Matemática', tipo: 'Guías de trabajo práctico', autores: 'Cátedra', fecha: '2024' },
        { areaConocimiento: 'Matemática', tipo: 'Material multimedial', autores: 'Lastra, M.', fecha: '2024' },
      ],
      otrosTrabajosDocentes: [
        { areaTematica: 'Tesis MECEN', lugar: 'UNLaR', fecha: '2024', destinatarios: 'Posgrado', nivel: 'Especialización' },
      ],
    },
    investigacion: [
      { proyecto: 'Intercambio de experiencias sobre la enseñanza del Análisis Matemático', descripcion: 'Proyecto de inserción, rol ejecutivo', cargo: 'Integrante', numeroResolucion: '00-07573/2022', etapa: 'Etapa final' },
    ],
    formacionRecursosHumanos: { detalle: 'Orientación a adscriptos en la cátedra de Elementos de la Matemática (Arquitectura).' },
    formacionAcademica: { detalle: 'Diplomatura EBA.DACHyE.' },
    extension: [],
    gestion: { detalle: 'Consejera del Consultivo de Lic. en Ciencias Biológicas. Consiliaria.' },
    otrasActividades: [
      'Desarrollo de materiales de estudio',
      'Clases de consulta',
      'Participación en mesas de trabajo y talleres para la definición del nuevo plan de estudio de LSI e ISI',
    ],
    distribucionHoraria: [
      { actividad: 'ENSENANZA', miercoles: '3 hs' },
      { actividad: 'INVESTIGACION', martes: '4 hs' },
      { actividad: 'EXTENSION' },
      { actividad: 'FORMACION', lunes: '6 hs' },
      { actividad: 'GESTION', jueves: '4 hs' },
    ],
  };

  const informePedagogicoAnalisis: PedagogicalReportData = {
    equipoCatedra: [
      { cargo: 'ADJUNTO', nombre: 'Lastra Mariana' },
      { cargo: 'JTP', nombre: 'Nieto Alejandro' },
    ],
    aspectosGenerales: {
      introduccion: 'PRESENTA_COMPLETA',
      diagnostico: 'PRESENTA_COMPLETA',
      objetivosPropositoRA: 'CONCRETOS_CLAROS',
      claseRecursosDidacticos: 'PRESENTA_Y_DESCRIBE',
    },
    aspectosCurriculares: {
      contenidos: 'DESARROLLADOS_EN_UNIDADES',
      trabajosPracticos: 'ARTICULADOS_CON_TEORIA',
      trabajosPracticosLaboratorio: 'NO_APLICA',
      trabajosCampo: 'NO_APLICA',
      evaluacionInicial: 'FORMATIVA_Y_SUMATIVA',
      regimenAprobacion: 'PROMOCIONAL_REGULAR_LIBRE',
      horarios: 'PRESENTA',
      distribucionHoraria: 'PRESENTA',
    },
    dictamen: 'FAVORABLE',
    observaciones: '',
  };

  const informeDisciplinarAnalisis: DisciplinaryReportData = {
    contenidos: 'CUMPLE',
    trabajosPracticos: { tp: 'ACORDE', laboratorio: 'ACORDE', campo: 'ACORDE' },
    bibliografia: { basica: 'PRESENTA', complementaria: 'PRESENTA' },
    controlPaad: [
      { docenteId: profLastra.id, nombreDocente: 'Lastra Mariana', cargo: 'ADJUNTO', estado: 'PRESENTO' },
      { docenteId: profNieto.id, nombreDocente: 'Nieto Alejandro', cargo: 'JTP', estado: 'PRESENTO' },
    ],
    dictamen: 'CUMPLE',
    observaciones: '',
  };

  const planifAnalisis = await prisma.planificacion.create({
    data: {
      asignaturaId: analisisMatI.id,
      cicloLectivo: 2024,
      docenteResponsableId: profLastra.id,
      estado: 'APROBADO_PLENO',
      datosPaac: datosPaacAnalisis as any,
      informePedagogico: informePedagogicoAnalisis as any,
      informeDisciplinar: informeDisciplinarAnalisis as any,
    },
  });

  await prisma.paadDocente.createMany({
    data: [
      { planificacionId: planifAnalisis.id, docenteId: profLastra.id, cargoEnCatedra: 'ADJUNTO', estadoPresento: 'PRESENTO', datosPaad: paadLastra as any },
      {
        planificacionId: planifAnalisis.id,
        docenteId: profNieto.id,
        cargoEnCatedra: 'JTP',
        estadoPresento: 'PRESENTO',
        datosPaad: {
          actividadEnsenanza: { cursosAtendidos: ['ISI, LSI, Análisis Matemático, 1° año - prácticos'], capacitaciones: [], materialElaborado: [], otrosTrabajosDocentes: [] },
          investigacion: [],
          formacionRecursosHumanos: { detalle: '' },
          formacionAcademica: { detalle: '' },
          extension: [],
          gestion: { detalle: '' },
          otrasActividades: [],
          distribucionHoraria: [
            { actividad: 'ENSENANZA', viernes: '3 hs' },
            { actividad: 'INVESTIGACION' },
            { actividad: 'EXTENSION' },
            { actividad: 'FORMACION' },
            { actividad: 'GESTION' },
          ],
        } as any,
      },
    ],
  });

  await prisma.asignacionCatedra.createMany({
    data: [
      { asignaturaId: analisisMatI.id, cicloLectivo: 2024, docenteId: profLastra.id, categoria: 'ADJUNTO', esResponsable: true },
      { asignaturaId: analisisMatI.id, cicloLectivo: 2024, docenteId: profNieto.id, categoria: 'JTP', esResponsable: false },
    ],
  });

  // ---------------------------------------------------------------------------
  // Planificación 2: Programación I (ISI, plan por competencias) — 2026, en borrador
  // ---------------------------------------------------------------------------

  const datosPaacProg: PaacCompetenciasData = {
    encabezado: {
      sede: 'UNLaR - Capital',
      carrera: 'Ingeniería en Sistemas de Información',
      planEstudio: 'Ord. C.S. 235/2023 y 236/2023',
      curso: 'Segundo año',
      asignatura: 'Programación I',
      regimen: 'ANUAL',
      creditoHorario: 120,
      horasTeoricas: 60,
      horasPracticas: 60,
      equipoCatedra: [
        { cargo: 'TITULAR', nombre: 'Juan Pérez' },
        { cargo: 'JTP', nombre: 'María Gómez' },
      ],
      contenidosMinimos: 'Programación imperativa. Algoritmos, procesos, estructuras de control, funciones, arreglos, punteros y concurrencia.',
      nivelIntensidad: 2,
      relacionTeoricoPractica: 't=p',
    },
    fundamentacion: {
      importanciaAsignatura: 'Base algorítmica y de resolución de problemas para toda la carrera.',
      matrizCompetencias: [
        { codigo: 'CE1.3', tipo: 'ESPECIFICA', detalle: 'Especificar, proyectar y desarrollar software.', nivelAporte: 2 },
      ],
      diagnostico: {
        articulacionCorrelativas: 'Correlativa con Informática II.',
        articulacionMismoAno: 'Articulada con Sistemas de Información I.',
        analisisEstudiantes: 'Estudiantes de segundo año con base en Informática I.',
        infraestructuraRequerida: 'Laboratorio de Computación 2.',
      },
    },
    objetivosPropositoRA: {
      objetivosCarrera: 'Formar profesionales capaces de diseñar y desarrollar software de calidad.',
      propositoAsignatura: ['Diseñar algoritmos correctos y eficientes.'],
      resultadosAprendizaje: [{ codigo: 'RA1', detalle: 'Resuelve problemas mediante algoritmos estructurados en C/C++.' }],
    },
    metodologia: { enfoque: 'Clases expositivas dialogadas y resolución de problemas en laboratorio.', propuestaDesarrolloCompetencias: [] },
    contenidos: [{ unidad: 1, titulo: 'Fundamentos de algoritmos', detalle: 'Variables, control de flujo, funciones.' }],
    programaTrabajosPracticos: [{ numero: 1, titulo: 'Guías de laboratorio', proposito: ['Practicar estructuras de control'], modalidad: 'Individual', unidadTemas: 'Unidad 1' }],
    evaluacion: {
      tipos: ['INICIAL', 'DE_PROCESO', 'FINAL'],
      criterios: ['Evaluación de código y lógica'],
      tecnicas: ['Trabajos prácticos', 'Pruebas escritas'],
      regimenAprobacion: { promocional: 'Nota >= 7 en ambos parciales y TP integrador aprobado', regular: 'Nota >= 4', libre: 'Examen teórico-práctico total' },
    },
    bibliografia: {
      basica: [{ titulo: 'C++ Cómo programar', autores: 'Deitel & Deitel', editorial: 'Pearson', ano: 2018 }],
      complementaria: [],
    },
    horariosClases: [],
    cronograma: [],
  };

  const planif2026 = await prisma.planificacion.create({
    data: {
      asignaturaId: prog1.id,
      cicloLectivo: 2026,
      docenteResponsableId: profTitular.id,
      estado: 'BORRADOR',
      datosPaac: datosPaacProg as any,
    },
  });

  const paadVacio = (): PaadData => ({
    actividadEnsenanza: { cursosAtendidos: [], capacitaciones: [], materialElaborado: [], otrosTrabajosDocentes: [] },
    investigacion: [],
    formacionRecursosHumanos: { detalle: '' },
    formacionAcademica: { detalle: '' },
    extension: [],
    gestion: { detalle: '' },
    otrasActividades: [],
    distribucionHoraria: [
      { actividad: 'ENSENANZA' },
      { actividad: 'INVESTIGACION' },
      { actividad: 'EXTENSION' },
      { actividad: 'FORMACION' },
      { actividad: 'GESTION' },
    ],
  });

  await prisma.paadDocente.createMany({
    data: [
      {
        planificacionId: planif2026.id,
        docenteId: profTitular.id,
        cargoEnCatedra: 'TITULAR',
        estadoPresento: 'NO_PRESENTO',
        datosPaad: { ...paadVacio(), actividadEnsenanza: { ...paadVacio().actividadEnsenanza, cursosAtendidos: ['Comisión A y B'] } } as any,
      },
      {
        planificacionId: planif2026.id,
        docenteId: profAuxiliar.id,
        cargoEnCatedra: 'JTP',
        estadoPresento: 'NO_PRESENTO',
        datosPaad: { ...paadVacio(), actividadEnsenanza: { ...paadVacio().actividadEnsenanza, cursosAtendidos: ['Prácticos Comisión A'] } } as any,
      },
    ],
  });

  await prisma.asignacionCatedra.createMany({
    data: [
      { asignaturaId: prog1.id, cicloLectivo: 2026, docenteId: profTitular.id, categoria: 'TITULAR', esResponsable: true },
      { asignaturaId: prog1.id, cicloLectivo: 2026, docenteId: profAuxiliar.id, categoria: 'JTP', esResponsable: false },
    ],
  });

  // Carga de referencia ISI a partir del relevamiento de profesores y cátedras.
  // El archivo fuente no informa año, régimen, carga horaria ni responsable, por
  // eso esos datos quedan explícitamente pendientes y no se generan PAAC.
  const normalizar = (texto: string) =>
    texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const slugDocente = (texto: string) => normalizar(texto).replace(/\s+/g, '.');
  const separarNombre = (texto: string) => {
    const limpio = texto.replace(/\s+/g, ' ').trim();
    const separador = limpio.indexOf(',');
    if (separador > 0) {
      return {
        nombre: limpio.slice(separador + 1).trim(),
        apellido: limpio.slice(0, separador).trim(),
      };
    }
    return { nombre: limpio, apellido: '' };
  };
  const docentesExistentes = new Map([
    ['lastra mariana', profLastra],
    ['nieto alejandro', profNieto],
  ]);
  let materiasIsiImportadas = 0;
  let docentesIsiImportados = 0;
  let asignacionesIsiImportadas = 0;
  let planificacionesIsiImportadas = 0;

  for (let i = 0; i < ISI_CATEDRAS.length; i += 1) {
    const registro = ISI_CATEDRAS[i];
    const claveDocente = normalizar(registro.docente);
    let docente = docentesExistentes.get(claveDocente);
    if (!docente) {
      const identidad = separarNombre(registro.docente);
      docente = await prisma.usuario.create({
        data: {
          nombre: identidad.nombre,
          apellido: identidad.apellido,
          email: `${slugDocente(registro.docente)}@unlar.edu.ar`,
          dni: `ISI-IMPORT-${String(i + 1).padStart(3, '0')}`,
          rol: UserRole.DOCENTE,
          passwordHash,
          mustChangePassword: true,
        },
      });
      docentesIsiImportados += 1;
    }

    for (const nombreMateria of registro.materias) {
      let asignatura = await prisma.asignatura.findFirst({ where: { planEstudioId: planIsiNuevo.id, nombre: nombreMateria } });
      if (!asignatura) {
        asignatura = await prisma.asignatura.create({
          data: {
            planEstudioId: planIsiNuevo.id,
            departamentoRadicacionId: deptoExactas.id,
            nombre: nombreMateria,
            anoCursada: 0,
            regimen: 'A DEFINIR',
            creditoHorario: 0,
            contenidosMinimosOficiales: 'Pendiente de completar según el plan de estudios ISI.',
          },
        });
        materiasIsiImportadas += 1;
      }
      await prisma.asignacionCatedra.create({
        data: {
          asignaturaId: asignatura.id,
          cicloLectivo: 2026,
          docenteId: docente.id,
          categoria: 'A DEFINIR',
          esResponsable: false,
        },
      });
      asignacionesIsiImportadas += 1;
    }
  }

  // Crear borradores vacíos para las materias con equipo 2026. El PAAC de
  // ejemplo de Programación I se conserva sin cambios.
  const generacion = await generarPlanificacionesDelCiclo(prisma, 2026);
  planificacionesIsiImportadas = generacion.creadas;
  const asignaturasIsi = await prisma.asignatura.findMany({
    where: { planEstudioId: planIsiNuevo.id },
    include: { asignacionesCatedra: { where: { cicloLectivo: 2026 }, orderBy: { createdAt: 'asc' } } },
  });
  for (const asignatura of asignaturasIsi) {
    const equipo = asignatura.asignacionesCatedra;
    if (!equipo.length) continue;
    const existente = await prisma.planificacion.findUnique({
      where: { asignaturaId_cicloLectivo: { asignaturaId: asignatura.id, cicloLectivo: 2026 } },
    });
    const planificacionId = existente?.id;
    if (!planificacionId) throw new Error(`No se pudo determinar la planificación de ${asignatura.nombre}.`);
    for (const integrante of equipo) {
      await prisma.paadDocente.upsert({
        where: { planificacionId_docenteId: { planificacionId, docenteId: integrante.docenteId } },
        update: { cargoEnCatedra: integrante.categoria },
        create: {
          planificacionId,
          docenteId: integrante.docenteId,
          cargoEnCatedra: integrante.categoria,
          estadoPresento: 'NO_PRESENTO',
          datosPaad: defaultPaad() as any,
        },
      });
    }
  }

  console.log('Seed ejecutado con éxito.');
  console.log(`Carga ISI: ${materiasIsiImportadas} materias nuevas, ${docentesIsiImportados} docentes nuevos, ${asignacionesIsiImportadas} asignaciones 2026 y ${planificacionesIsiImportadas} planificaciones borrador.`);
  console.log('Usuarios de prueba (password: unlar2026):');
  console.log('  admin@unlar.edu.ar (ADMINISTRADOR)');
  console.log('  direccion.isi@unlar.edu.ar / direccion.lsi@unlar.edu.ar / direccion.educacion@unlar.edu.ar (DIRECCION_CARRERA)');
  console.log('  uap@unlar.edu.ar (UAP)');
  console.log('  consejo.exactas@unlar.edu.ar (CONSEJO_DEPARTAMENTAL)');
  console.log('  lastra.mariana@unlar.edu.ar (DOCENTE, responsable de Análisis Matemático I - APROBADO_PLENO)');
  console.log('  nieto.alejandro@unlar.edu.ar (DOCENTE, auxiliar)');
  console.log('  titular.prog@unlar.edu.ar / auxiliar.prog@unlar.edu.ar (Programación I - BORRADOR)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

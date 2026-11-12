guia.md
Guía de desarrollo, arquitectura y especificaciones del sistema SIGA-Planificaciones para asistentes de IA y agentes de codificación autónomos (Claude Code, Cursor, Windsurf, Copilot).

1. Visión General del Dominio y Sistema
SIGA-Planificaciones es el Sistema de Gestión de Planificaciones Docentes (PAAC/PAAD) para el Departamento Académico de Ciencias Exactas, Físicas y Naturales (DACEFyN) de la Universidad Nacional de La Rioja (UNLaR). Digitaliza, audita y gestiona el circuito administrativo estipulado por las normativas institucionales:

Ordenanza HCS N° 171/2019: Estructura base del PAAC (Anexo II) y PAAD (Anexo III).
Ordenanza HCS N° 219/2022: Circuitos de evaluación, Informe Pedagógico UAP (Anexo III), Informe Disciplinar de Dirección (Anexo IV), Informe General (Anexo V) y Nota de Elevación (Anexo II).
Ordenanza HCS N° 448/2011: Plan de transición por competencias para carreras de informática.
Carreras Contempladas
TUI: Tecnicatura Universitaria en Informática.
ISI: Ingeniería en Sistemas de Información.
LSI: Licenciatura en Sistemas de Información.
Reglas Críticas del Negocio Académico
Jerarquía Académica Diferenciada:
Sede Capital: Jerarquía completa: Sede Capital -> Departamento (DACEFyN) -> Carrera (TUI/ISI/LSI) -> Plan de Estudio -> Asignatura -> Equipo de Cátedra.
Sedes Regionales: Sin división departamental: Sede Regional -> Carrera -> Plan de Estudio -> Asignatura -> Equipo de Cátedra.
Estructura Matricial de Asignaturas:
Ciertas materias pertenecen curricularmente a una carrera pero se radican y dictan desde otro departamento académico (ej. Derecho Informático y Ética Profesional pertenece a ISI pero se radica en el Departamento de Ciencias Humanas). La planificación se deriva al departamento que gestiona la asignatura.
Planes Tradicionales vs. Competencias:
Tradicional (Ord. 171/19): Objetivos conceptuales, procedimentales y actitudinales.
Competencias (Ord. 448/11): Matriz de competencias genéricas y específicas, nivel de aporte (0 a 3) y descriptores de aprendizaje.
Provisioning de Usuarios y Acceso:
Sin autorregistro. Los usuarios son creados exclusivamente por el Administrador.
Identificador y credencial provisoria: DNI.
La bandera must_change_password = true fuerza el cambio de clave en /cambiar-password en el primer login.
Generación por Lotes de Planificaciones:
Los docentes no crean planificaciones manualmente. El Administrador dispara el ciclo lectivo (1C: anuales y primer cuatrimestre; 2C: segundo cuatrimestre), instanciando los registros en estado BORRADOR con sus respectivos PAAC y PAAD para el equipo docente asignado.
2. Diagrama de Base de Datos (Entity-Relationship)
Unable to render rich display

Parse error on line 215:
... created_at }## 3. Máquina de Est
-------------------^
Expecting 'EOF', 'NEWLINE', 'title', 'acc_title', 'acc_descr', 'acc_descr_multiline_value', 'END', 'SUBGRAPH', 'direction_tb', 'direction_bt', 'direction_rl', 'direction_lr', 'CLASSDEF', 'UNICODE_TEXT', 'CLASS', 'STYLE', 'NUM', 'ENTITY_NAME', 'DECIMAL_NUM', 'ENTITY_ONE', got 'BRKT'



erDiagram
    DEPARTAMENTOS ||--o{ CARRERAS : administra_en_capital
    DEPARTAMENTOS ||--o{ ASIGNATURAS : radica_matricial_capital
    CARRERAS ||--|{ CARRERAS_SEDES : dicta_en
    SEDES ||--|{ CARRERAS_SEDES : hospeda
    CARRERAS ||--o{ PLANES_ESTUDIO : ofrece
    CARRERAS ||--o{ USUARIOS : asigna_director
    PLANES_ESTUDIO ||--|{ ASIGNATURAS : contiene

    CICLOS_LECTIVOS ||--|{ PERIODOS_ACADEMICOS : divide
    CICLOS_LECTIVOS ||--o{ EQUIPOS_CATEDRA : planta_anual
    ASIGNATURAS ||--|{ EQUIPOS_CATEDRA : conforma
    USUARIOS ||--|{ EQUIPOS_CATEDRA : asigna_docente

    PERIODOS_ACADEMICOS ||--o{ PLANIFICACIONES : agrupa_1C_2C
    ASIGNATURAS ||--o{ PLANIFICACIONES : genera
    USUARIOS ||--o{ PLANIFICACIONES : docente_responsable

    PLANIFICACIONES ||--|| PAAC : posee_un_paac
    PAAC ||--o{ PAAC_COMPETENCIAS : matriz_competencias

    PLANIFICACIONES ||--|{ PAAD_DOCENTES : agrupa_paads
    USUARIOS ||--|{ PAAD_DOCENTES : completa_profesor

    PLANIFICACIONES ||--o| INFORMES_PEDAGOGICOS : evalua_uap
    USUARIOS ||--o{ INFORMES_PEDAGOGICOS : auditor_uap

    PLANIFICACIONES ||--o| INFORMES_DISCIPLINARES : evalua_direccion
    USUARIOS ||--o{ INFORMES_DISCIPLINARES : auditor_director

    PLANIFICACIONES ||--o| INFORMES_GENERALES_PAAC : consolida_anexo_v

    PAAC ||--o{ OBSERVACIONES_ITEMS : campo_paac
    PAAD_DOCENTES ||--o{ OBSERVACIONES_ITEMS : campo_paad
    USUARIOS ||--o{ OBSERVACIONES_ITEMS : emite_auditor

    SEDES {
        uuid id PK
        varchar nombre
        boolean es_capital
    }

    DEPARTAMENTOS {
        uuid id PK
        varchar nombre
    }

    CARRERAS {
        uuid id PK
        uuid departamento_id_nullable FK
        varchar nombre
        varchar codigo UK
    }

    CARRERAS_SEDES {
        uuid id PK
        uuid carrera_id FK
        uuid sede_id FK
    }

    PLANES_ESTUDIO {
        uuid id PK
        uuid carrera_id FK
        varchar ordenanza
        varchar enfoque
        boolean activo
    }

    ASIGNATURAS {
        uuid id PK
        uuid plan_estudio_id FK
        uuid departamento_radicacion_nullable FK
        varchar nombre
        int ano_cursada
        varchar regimen_dictado
        int horas_semanales
        int horas_totales
        text contenidos_minimos
    }

    CICLOS_LECTIVOS {
        int ano_lectivo PK
        date fecha_inicio
        date fecha_fin
        boolean activo
    }

    PERIODOS_ACADEMICOS {
        uuid id PK
        int ciclo_lectivo FK
        varchar tipo_periodo
        varchar alcance_materias
        date fecha_limite_presentacion
        date fecha_limite_informes
    }

    USUARIOS {
        uuid id PK
        varchar email UK
        varchar dni UK
        varchar password_hash
        varchar nombre
        varchar apellido
        varchar rol
        boolean must_change_password
        uuid carrera_id_nullable FK
    }

    EQUIPOS_CATEDRA {
        uuid id PK
        uuid asignatura_id FK
        uuid docente_id FK
        int ciclo_lectivo FK
        varchar cargo
        boolean es_responsable
    }

    PLANIFICACIONES {
        uuid id PK
        uuid periodo_academico_id FK
        uuid asignatura_id FK
        uuid docente_responsable_id FK
        varchar estado
        varchar numero_expediente
        varchar numero_resolucion
        timestamp fecha_aprobacion_cd
        timestamp updated_at
    }

    PAAC {
        uuid id PK
        uuid planificacion_id FK
        jsonb datos_encabezado
        jsonb fundamentacion_diagnostico
        jsonb objetivos_generales
        jsonb metodologia_ensenanza
        jsonb evaluacion_regimen
        jsonb trabajos_practicos
        jsonb bibliografia
        jsonb distribucion_horaria
        varchar estado_elaboracion
    }

    PAAC_COMPETENCIAS {
        uuid id PK
        uuid paac_id FK
        varchar tipo_competencia
        text descripcion_competencia
        int nivel_aporte
        jsonb descriptores_aprendizaje
    }

    PAAD_DOCENTES {
        uuid id PK
        uuid planificacion_id FK
        uuid docente_id FK
        varchar cargo_en_catedra
        jsonb docencia_directa
        jsonb capacitacion
        jsonb formacion_rrhh
        jsonb investigacion_extension
        varchar estado_presentacion
        timestamp updated_at
    }

    INFORMES_PEDAGOGICOS {
        uuid id PK
        uuid planificacion_id FK
        uuid auditor_uap_id FK
        jsonb aspectos_generales
        jsonb aspectos_curriculares
        varchar dictamen
        text observaciones_generales
        timestamp fecha_emision
    }

    INFORMES_DISCIPLINARES {
        uuid id PK
        uuid planificacion_id FK
        uuid director_carrera_id FK
        varchar contenidos_minimos
        varchar trabajos_practicos
        varchar bibliografia
        jsonb control_individual_paad
        varchar dictamen
        text observaciones_disciplinares
        timestamp fecha_emision
    }

    INFORMES_GENERALES_PAAC {
        uuid id PK
        uuid planificacion_id FK
        varchar docente_responsable_nombre
        varchar cargo_docente
        varchar estado_paac
        varchar estado_paad
        varchar estado_global
        text observaciones_generales
        timestamp fecha_elaboracion
    }

    OBSERVACIONES_ITEMS {
        uuid id PK
        uuid paac_id FK
        uuid paad_docente_id FK
        varchar campo_path
        uuid autor_id FK
        varchar rol_autor
        text mensaje
        boolean resuelto
        timestamp created_at
    }


## 3. Máquina de Estados y Workflow Reglamentario

stateDiagram-v2
    [*] --> BORRADOR: Disparo masivo por Administrador
    
    state BORRADOR {
        [*] --> Completando_Instrumentos
        Completando_Instrumentos: Auxiliares completan PAAD (Anexo III)
        Completando_Instrumentos: Responsable completa PAAC (Anexo II)
    }

    BORRADOR --> ENVIADO_A_REVISION: Responsable envía cuando todos los PAAD = 'PRESENTO'
    
    state Evaluacion_Simultanea {
        [*] --> Revision_Paralela
        Revision_Paralela: UAP evalúa pedagogía (Anexo III)
        Revision_Paralela: Dirección evalúa contenidos y PAADs (Anexo IV)
    }
    
    ENVIADO_A_REVISION --> Evaluacion_Simultanea
    Evaluacion_Simultanea --> OBSERVADO: UAP o Dirección emiten observaciones
    OBSERVADO --> BORRADOR: Docente corrige campos marcados
    
    Evaluacion_Simultanea --> APROBADO_PEDAGOGICO: Dictamen UAP Favorable
    Evaluacion_Simultanea --> APROBADO_DISCIPLINAR: Dictamen Dirección Favorable
    
    APROBADO_PEDAGOGICO --> APROBADO_PLENO: Dirección emite conformidad
    APROBADO_DISCIPLINAR --> APROBADO_PLENO: UAP emite conformidad
    
    APROBADO_PLENO --> ELEVADO_AL_CONSEJO: Dirección emite Nota de Elevación (Anexo II)
    ELEVADO_AL_CONSEJO --> FINALIZADO: Consejo Departamental aprueba (N° Exp. y N° Res.)
    FINALIZADO --> [*]


## 4. Reglas de Transición

    BORRADOR -> ENVIADO_A_REVISION: Habilitado exclusivamente para el DOCENTE_RESPONSABLE cuando todos los docentes de la cátedra presentaron su PAAD individual (estado_presentacion === 'PRESENTO').

    OBSERVADO: Si la UAP o Dirección rechazan o crean ItemObservacion, se habilita la edición del docente únicamente en los campos observados.

    APROBADO_PLENO: Requiere la concurrencia de ambos informes aprobados (APROBADO_PEDAGOGICO y APROBADO_DISCIPLINAR).

    FINALIZADO: El Consejo Departamental asigna numero_expediente, numero_resolucion y fecha_aprobacion_cd.


## 5. Matriz de Roles y Responsabilidades (RBAC)

| Rol | Alcance y Capacidades |
| :--- | :--- |
| `DOCENTE_AUXILIAR` | Completa y edita exclusivamente su **PAAD** individual (Anexo III)[cite: 1]. Consulta su historial de planificaciones y resoluciones previas[cite: 1]. |
| `DOCENTE_RESPONSABLE` | Confecciona el **PAAC** (Anexo II) y su propio PAAD[cite: 1]. Supervisa la entrega de los PAAD de su equipo y efectúa el envío unificado a revisión[cite: 1]. |
| `UAP` | Revisa aspectos pedagógicos y curriculares transversales[cite: 1]. Emite el **Informe Pedagógico** (Anexo III, Ord. 219/22) y crea observaciones en campos puntuales (`campo_path`)[cite: 1]. |
| `DIRECCION_CARRERA` | Acceso restringido a las asignaturas de su carrera[cite: 1]. Emite el **Informe Disciplinar** (Anexo IV), consolida el **Informe General** (Anexo V) y emite la **Nota de Elevación** (Anexo II) al Consejo Departamental[cite: 1]. |
| `CONSEJO_DEPARTAMENTAL` | Audita el expediente completo elevado[cite: 1]. Formaliza la aprobación ingresando el N° de expediente y N° de resolución institucional[cite: 1]. |
| `ADMINISTRADOR` | Mantenimiento de sedes, departamentos, carreras, planes, materias y equipos docentes[cite: 1]. Dispara masivamente los ciclos lectivos (`1C` y `2C`) y da de alta usuarios[cite: 1]. |


## 6. Sistema Atómico de Observaciones (ItemObservacion)

Las observaciones no son notas de texto libre genéricas, sino anotaciones ancladas a una ruta exacta de campo mediante `campo_path` (ej. `metodologiaEvaluacion.regimenAprobacion.regular`):

* **Frontend Wrapper**: Componente `ObservationFieldWrapper` que envuelve cada input.
* **Comportamiento**: Si existe un ítem no resuelto, aplica borde de advertencia (`border-amber-500/70`), fondo resaltado y un badge con el rol del auditor.
* **Resolución**: Provee un botón para que el docente responsable o auxiliar marque la observación como subsanada (`resuelto = true`) tras efectuar la corrección.

---

## 7. Stack Tecnológico y Convenciones de Código

* **Framework**: Next.js 14 (App Router, Server Actions, React Server Components).
* **Lenguaje**: TypeScript 5 (modo estricto, alias `@/*` hacia `./src/*`).
* **Base de Datos**: PostgreSQL 16 + Prisma ORM 5.22.
* **Autenticación**: NextAuth.js v4 con CredentialsProvider (`bcryptjs`).
* **Estado Global UI**: Redux Toolkit (filtros de carrera/ciclo, documento activo, observaciones).
* **UI & Estilos**: Tailwind CSS 3 con paleta institucional **Dark 


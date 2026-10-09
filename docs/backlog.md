# Backlog — Mira

Backlog de la Entrega 1. **Ya está cargado en Jira**, con los mismos IDs que
aparecen en este documento:

- Tablero: https://bolgunn.atlassian.net/jira/software/projects/MIR/boards
- `MIR-1` … `MIR-29` — Entrega 1
- `MIR-30` … `MIR-33` — reservado para la Entrega 2
- `MIR-34` … `MIR-40` — las épicas

Los items se crearon antes que las épicas precisamente para que esta
numeración coincida: si las épicas se hubieran creado primero, se habrían
llevado `MIR-1..7` y cada rama, commit y PR de este documento apuntaría al
item equivocado.

El archivo [`jira-import.csv`](./jira-import.csv) se conserva como respaldo
para reimportar en un sitio limpio; nótese que usa `Epic Link`, mientras que
Jira ya migró al campo `Parent`.

**Convenciones.**

- Estimación en **story points** (escala Fibonacci: 1, 2, 3, 5, 8, 13).
- Prioridad: **Highest** (bloquea el flujo central) · **High** (MVP) ·
  **Medium** (requisito del tema, no bloqueante) · **Low** (mejora).
- Los IDs `MIR-n` son los que deben aparecer en ramas, commits y Pull Requests.
- Cada historia se implementa en la rama
  `feature/MIR-<n>-<descripcion-en-kebab-case>`.

**Estado al momento de escribir este documento:** el andamiaje del monorepo y el
módulo de autenticación (MIR-1, MIR-3 y MIR-4 en su parte de API) están
implementados con sus tres niveles de prueba, como rebanada vertical de
referencia. Todo lo demás está por hacer.

**Total de la Entrega 1:** 29 items, 130 story points (desglose por epica al final).

---

## Épica 1 — Autenticación y cuenta de usuario

### MIR-1 · Registro de usuario (API) — ✅ implementado

> Como visitante
> quiero crear una cuenta con mi correo y una contraseña
> para poder acceder a la plataforma.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

- **Dado** que envío nombre, correo no registrado y contraseña válida,
  **cuando** hago POST a `/api/auth/register`,
  **entonces** recibo 201, el usuario creado sin su hash, y una cookie de sesión `HttpOnly`.
- **Dado** que el correo ya está registrado,
  **cuando** intento registrarme,
  **entonces** recibo 409 con código `EMAIL_TAKEN` y no se crea nada.
- **Dado** que la contraseña tiene menos de 8 caracteres o no combina letra y número,
  **cuando** envío el formulario,
  **entonces** recibo 422 indicando el campo `password`.
- **Dado** cualquier registro exitoso,
  **cuando** consulto la base de datos,
  **entonces** la contraseña está almacenada como hash bcrypt, nunca en texto plano.

---

### MIR-2 · Pantalla de registro (Web)

> Como visitante
> quiero un formulario de registro
> para crear mi cuenta sin usar herramientas técnicas.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 3

**Criterios de aceptación**

- **Dado** que estoy en `/registro`, **cuando** la página carga, **entonces** veo campos de nombre, correo y contraseña, todos con etiqueta asociada.
- **Dado** que escribo un correo inválido, **cuando** envío, **entonces** veo el error bajo el campo y **no** se hace ninguna llamada a la API.
- **Dado** un registro exitoso, **cuando** el servidor responde, **entonces** quedo autenticado y soy redirigido a `/proyectos`.
- **Dado** que el correo ya existe, **cuando** el servidor responde 409, **entonces** veo un mensaje claro y el formulario conserva lo escrito.

**Notas.** Reutiliza `registerSchema` de `@mira/shared` con `zodResolver`.
`LoginPage.tsx` sirve de plantilla.

---

### MIR-3 · Inicio de sesión — ✅ implementado

> Como usuario registrado
> quiero iniciar sesión
> para acceder a mis proyectos.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

- **Dado** credenciales correctas, **cuando** inicio sesión, **entonces** recibo 200 y una cookie `HttpOnly`, y llego a `/proyectos`.
- **Dado** una contraseña incorrecta, **cuando** inicio sesión, **entonces** recibo 401 y **no** se entrega cookie.
- **Dado** un correo que no existe, **cuando** inicio sesión, **entonces** el mensaje de error es **idéntico** al de contraseña incorrecta.
- **Dado** que la API no responde, **cuando** envío el formulario, **entonces** veo un mensaje de error de conexión y no una pantalla en blanco.

---

### MIR-4 · Cerrar sesión y sesión persistente

> Como usuario autenticado
> quiero que mi sesión se mantenga al recargar y poder cerrarla
> para no reingresar mis credenciales y para proteger mi cuenta en equipos compartidos.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 3

**Criterios de aceptación**

- **Dado** que tengo sesión iniciada, **cuando** recargo la página, **entonces** sigo autenticado (la aplicación consulta `/api/auth/me`).
- **Dado** que hago clic en "Cerrar sesión", **cuando** el servidor responde 204, **entonces** la cookie se borra y soy redirigido a `/login`.
- **Dado** que cerré sesión, **cuando** intento entrar a `/proyectos`, **entonces** soy redirigido a `/login`.
- **Dado** que cierro sesión, **cuando** otro usuario entra en el mismo navegador, **entonces** no ve datos cacheados del anterior.

**Notas.** La API y los hooks ya existen; falta el botón en la UI y el guardia
de rutas completo.

---

## Épica 2 — Proyectos y equipo

### MIR-5 · Crear proyecto

> Como usuario autenticado
> quiero crear un proyecto con nombre y clave
> para empezar a organizar el trabajo de mi equipo.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

API:

- **Dado** nombre y clave válidos, **cuando** creo el proyecto, **entonces** recibo 201 y quedo registrado como `OWNER`.
- **Dado** que la clave ya existe, **cuando** creo el proyecto, **entonces** recibo 409 con un mensaje que indica el conflicto.
- **Dado** que la clave no cumple el formato (2 a 8 caracteres, empieza con letra, solo alfanuméricos), **cuando** envío, **entonces** recibo 422.
- **Dado** que no tengo sesión, **cuando** intento crear un proyecto, **entonces** recibo 401.

Web:

- **Dado** que estoy en "Mis proyectos", **cuando** pulso "Nuevo proyecto" y envío nombre y clave válidos, **entonces** vuelvo a la lista y el proyecto aparece con mi rol Propietario.
- **Dado** que la clave ya existe, **cuando** envío, **entonces** veo el mensaje bajo el campo clave, conservo lo escrito y el campo recibe el foco.
- **Dado** datos que no cumplen el formato, **cuando** envío, **entonces** veo el error bajo cada campo sin llamar a la API.

---

### MIR-6 · Listar mis proyectos

> Como usuario autenticado
> quiero ver la lista de proyectos en los que participo
> para entrar rápidamente al que necesito.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 3

**Criterios de aceptación**

- **Dado** que soy miembro de dos proyectos, **cuando** abro `/proyectos`, **entonces** veo exactamente esos dos, con mi rol en cada uno.
- **Dado** que existe un proyecto del que no soy miembro, **cuando** listo, **entonces** ese proyecto **no** aparece.
- **Dado** que no participo en ninguno, **cuando** abro la página, **entonces** veo un estado vacío que invita a crear el primero.

---

### MIR-7 · Ver y editar un proyecto

> Como OWNER de un proyecto
> quiero modificar su nombre y descripción
> para mantener la información al día.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 3

**Criterios de aceptación**

- **Dado** que soy OWNER, **cuando** edito nombre o descripción, **entonces** recibo 200 y los cambios persisten.
- **Dado** que soy MEMBER o VIEWER, **cuando** intento editar, **entonces** recibo 403 y la interfaz **no** muestra el botón de editar.
- **Dado** que envío un campo desconocido, **cuando** hago PATCH, **entonces** recibo 422.
- **Dado** que soy miembro, **cuando** abro la configuración del proyecto, **entonces** veo nombre, clave, descripción y mi rol; si no soy miembro recibo 403.
- **Dado** que envío la clave en el PATCH, **cuando** edito, **entonces** recibo 422: la clave es inmutable.
- **Dado** que edito como OWNER, **cuando** un campo cambia, **entonces** queda registrado en la bitácora (`PROJECT_UPDATED`) con su valor anterior y nuevo.

---

### MIR-8 · Eliminar un proyecto

> Como OWNER
> quiero eliminar un proyecto
> para retirar del sistema el trabajo que ya no corresponde.

**Tipo:** Historia · **Prioridad:** Medium · **Estimación:** 3

**Criterios de aceptación**

- **Dado** que soy OWNER, **cuando** confirmo la eliminación, **entonces** recibo 204 y el proyecto desaparece de mi lista.
- **Dado** que el proyecto tiene items y comentarios, **cuando** se elimina, **entonces** se eliminan en cascada y no quedan registros huérfanos.
- **Dado** que no soy OWNER, **cuando** intento eliminar, **entonces** recibo 403.
- **Dado** que abro el diálogo de confirmación, **cuando** cancelo, **entonces** no se elimina nada.

---

### MIR-9 · Invitar a un miembro al proyecto

> Como OWNER
> quiero agregar a otra persona por su correo
> para que colabore en el proyecto.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 5

**Criterios de aceptación**

- **Dado** un correo de usuario registrado, **cuando** lo agrego con rol MEMBER, **entonces** recibo 201 y aparece en la lista del equipo.
- **Dado** un correo que no corresponde a ningún usuario, **cuando** lo agrego, **entonces** recibo 404 con un mensaje comprensible.
- **Dado** que la persona ya es miembro, **cuando** la agrego otra vez, **entonces** recibo 409.
- **Dado** que soy MEMBER, **cuando** intento invitar, **entonces** recibo 403.

---

### MIR-10 · Cambiar rol y quitar miembros

> Como OWNER
> quiero cambiar el rol de un miembro o quitarlo del proyecto
> para mantener los permisos alineados con la realidad del equipo.

**Tipo:** Historia · **Prioridad:** Medium · **Estimación:** 5

**Criterios de aceptación**

- **Dado** que soy OWNER, **cuando** cambio a un miembro de MEMBER a VIEWER, **entonces** esa persona pierde inmediatamente la capacidad de crear items.
- **Dado** que soy el **único** OWNER, **cuando** intento degradarme o quitarme, **entonces** recibo 400: un proyecto no puede quedar sin OWNER.
- **Dado** que quito a un miembro, **cuando** tenía items asignados, **entonces** esos items quedan sin responsable y no se eliminan.
- **Dado** que soy VIEWER, **cuando** intento cambiar un rol, **entonces** recibo 403.

---

## Épica 3 — Elementos de trabajo (CRUD)

### MIR-11 · Crear un elemento de trabajo

> Como miembro de un proyecto
> quiero crear historias, tareas, bugs y épicas
> para registrar el trabajo pendiente.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 8

**Criterios de aceptación**

- **Dado** un título válido, **cuando** creo el item, **entonces** recibo 201 con una referencia legible tipo `MIR-1`, correlativa dentro del proyecto.
- **Dado** que no indico tipo, estado ni prioridad, **cuando** creo el item, **entonces** quedan en `TASK`, `BACKLOG` y `MEDIUM`.
- **Dado** que dos personas crean un item **simultáneamente**, **cuando** se generan las referencias, **entonces** no se repiten (el contador se incrementa dentro de la misma transacción).
- **Dado** que soy VIEWER, **cuando** intento crear, **entonces** recibo 403.
- **Dado** que se crea un item, **cuando** consulto el historial, **entonces** existe una entrada `ITEM_CREATED`.

---

### MIR-12 · Listar el backlog con paginación

> Como miembro
> quiero ver el backlog del proyecto
> para tener una vista completa del trabajo pendiente.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

- **Dado** que el proyecto tiene 25 items, **cuando** pido la primera página de 20, **entonces** recibo 20 items y un total de 25.
- **Dado** que no soy miembro del proyecto, **cuando** pido el backlog, **entonces** recibo 403.
- **Dado** que el proyecto no tiene items, **cuando** abro el backlog, **entonces** veo un estado vacío, no una tabla en blanco.
- **Dado** que pido un tamaño de página mayor a 100, **cuando** envío la petición, **entonces** recibo 422.

---

### MIR-13 · Buscar y filtrar el backlog

> Como miembro
> quiero buscar por texto y filtrar por tipo, estado, prioridad y responsable
> para encontrar rápido lo que necesito.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 5

**Criterios de aceptación**

- **Dado** que busco "login", **cuando** aplico la búsqueda, **entonces** obtengo los items cuyo título o descripción lo contengan, **sin distinguir mayúsculas**.
- **Dado** que filtro por `type=BUG` y `priority=HIGH`, **cuando** aplico, **entonces** ambos filtros se combinan con AND.
- **Dado** que ningún item coincide, **cuando** busco, **entonces** veo un mensaje de "sin resultados" con la opción de limpiar los filtros.
- **Dado** que estoy en la página 3 y cambio un filtro, **cuando** se aplica, **entonces** vuelvo a la página 1.

---

### MIR-14 · Ver el detalle de un elemento

> Como miembro
> quiero abrir un item y ver toda su información
> para entender el trabajo antes de tomarlo.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 3

**Criterios de aceptación**

- **Dado** un item existente de mi proyecto, **cuando** abro su detalle, **entonces** veo referencia, título, descripción, tipo, estado, prioridad, responsable, estimación y fechas.
- **Dado** un item de un proyecto del que no soy miembro, **cuando** intento abrirlo, **entonces** recibo 404 (no 403: no revelamos que existe).
- **Dado** un identificador inexistente, **cuando** abro la ruta, **entonces** veo una pantalla de "no encontrado", no un error sin manejar.

---

### MIR-15 · Editar un elemento de trabajo

> Como miembro
> quiero modificar los campos de un item
> para reflejar cómo evoluciona el trabajo.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

- **Dado** que cambio el título, **cuando** guardo, **entonces** recibo 200 y el cambio persiste.
- **Dado** que envío solo un campo, **cuando** hago PATCH, **entonces** los demás campos **no** se modifican.
- **Dado** que soy VIEWER, **cuando** intento editar, **entonces** recibo 403 y la interfaz muestra el item en modo lectura.
- **Dado** cualquier edición, **cuando** se guarda, **entonces** se registra una entrada `ITEM_UPDATED` con el campo, el valor anterior y el nuevo.

---

### MIR-16 · Eliminar un elemento de trabajo

> Como miembro
> quiero eliminar un item
> para limpiar trabajo que ya no aplica.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 3

**Criterios de aceptación**

- **Dado** que confirmo la eliminación, **cuando** se procesa, **entonces** recibo 204 y el item desaparece del backlog y del tablero.
- **Dado** que el item tiene comentarios, **cuando** se elimina, **entonces** se eliminan en cascada.
- **Dado** que soy VIEWER, **cuando** intento eliminar, **entonces** recibo 403.
- **Dado** el diálogo de confirmación, **cuando** cancelo, **entonces** no se elimina nada.

---

### MIR-17 · Asignar un responsable

> Como miembro
> quiero asignar un item a alguien del equipo
> para que quede claro quién es responsable.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 3

**Criterios de aceptación**

- **Dado** un miembro del proyecto, **cuando** lo asigno, **entonces** aparece como responsable y se registra `ITEM_ASSIGNED`.
- **Dado** un usuario que **no** es miembro del proyecto, **cuando** intento asignarlo, **entonces** recibo 400.
- **Dado** un item asignado, **cuando** quito el responsable, **entonces** queda como "sin asignar".
- **Dado** el backlog, **cuando** filtro por responsable, **entonces** veo solo sus items.

---

## Épica 4 — Tablero Kanban

### MIR-18 · Visualizar el tablero — ✅ implementado

> Como miembro
> quiero ver los items en columnas por estado
> para entender de un vistazo cómo va el trabajo.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 8

**Criterios de aceptación**

- **Dado** un proyecto con items, **cuando** abro el tablero, **entonces** veo las columnas Por hacer, En progreso, En revisión y Hecho, cada una con sus tarjetas.
- **Dado** una tarjeta, **cuando** la miro, **entonces** muestra referencia, título, tipo, prioridad y responsable.
- **Dado** una columna sin items, **cuando** abro el tablero, **entonces** la columna se muestra vacía y sigue siendo destino válido.
- **Dado** que abro el tablero en un teléfono, **cuando** se renderiza, **entonces** las columnas se desplazan horizontalmente sin romper el diseño.

**Notas.** `GET /api/projects/:projectId/board` devuelve `{ items }` sin
paginar, solo con los estados de `BOARD_STATUSES` (el backlog no aparece);
cualquier miembro, incluido VIEWER, puede verlo. La pantalla vive en
`/proyectos/:projectId/tablero`; las columnas salen de `BOARD_STATUSES`, no de
los items, por eso una columna vacía siempre existe.

---

### MIR-19 · Cambiar el estado desde el menú de la tarjeta — ✅ implementado

> Como miembro
> quiero cambiar el estado de una tarjeta desde un menú
> para mover trabajo sin depender del arrastre.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

- **Dado** una tarjeta, **cuando** abro "Mover a…" y elijo otro estado, **entonces** la tarjeta se mueve a esa columna y el cambio persiste tras recargar.
- **Dado** que la API falla, **cuando** intento mover, **entonces** la tarjeta vuelve a su columna original y veo un mensaje de error.
- **Dado** que soy VIEWER, **cuando** abro una tarjeta, **entonces** el menú de mover **no** está disponible.
- **Dado** un cambio de estado, **cuando** reviso el historial, **entonces** existe `ITEM_STATUS_CHANGED` con el estado anterior y el nuevo.

**Notas.** Este es el camino determinista que usarán las pruebas E2E de la
Entrega 3. Debe existir **antes** que MIR-20.

`PATCH /api/projects/:projectId/work-items/:workItemId/status` recibe
`{ status }` (estricto: otro campo responde 422) y devuelve `{ item }`. El
cambio de estado y su `ITEM_STATUS_CHANGED` (`field: "status"`, `fromValue`,
`toValue`) se escriben en la misma transacción; mover al mismo estado responde
200 sin registrar historial. VIEWER recibe 403 y el no miembro 404, igual que
en el detalle. En el tablero, cada tarjeta tiene el botón **Mover a…** (menú
accesible con teclado) solo si `can(rol, 'work-item:change-status')`; la
mutación `useMoveWorkItem` es optimista y, si la API falla, devuelve la
tarjeta a su columna y muestra el error. MIR-20 debe reutilizarla.

---

### MIR-20 · Arrastrar y soltar tarjetas — ✅ implementado

> Como miembro
> quiero arrastrar una tarjeta a otra columna
> para reorganizar el trabajo de forma natural.

**Tipo:** Historia · **Prioridad:** Medium · **Estimación:** 8

**Criterios de aceptación**

- **Dado** una tarjeta, **cuando** la arrastro a otra columna y suelto, **entonces** cambia de estado con actualización optimista.
- **Dado** que el servidor rechaza el cambio, **cuando** falla, **entonces** la tarjeta regresa a su posición original.
- **Dado** que uso solo el teclado, **cuando** enfoco una tarjeta y uso las teclas de arrastre, **entonces** puedo moverla sin ratón.
- **Dado** que soy VIEWER, **cuando** intento arrastrar, **entonces** la tarjeta no se mueve.

**Notas.** dnd-kit con `PointerSensor` y `KeyboardSensor`. Reutiliza la misma
mutación de MIR-19.

Cada columna es un destino (`useDroppable` con su estado como id) y cada
tarjeta un arrastrable que lleva el item en `data`; al soltar en otra columna se
llama a `useMoveWorkItem`, así que la actualización optimista, el rollback y el
mensaje de error son los mismos del menú. Con ratón se toma la tarjeta desde
cualquier punto (distancia mínima de 5 px, para que un clic no sea un arrastre);
con teclado, desde el asa **Arrastrar MIR-n**: Espacio o Enter la toma, las
flechas izquierda y derecha saltan a la columna vecina (`coordinateGetter`
propio en `boardDnd.ts`), Espacio o Enter la suelta y Escape cancela. Los
anuncios para lectores de pantalla están en español. Sin
`can(rol, 'work-item:change-status')` el arrastrable queda deshabilitado y no
hay asa. Las pruebas (`KanbanBoard.dnd.test.tsx`) simulan el layout con
`getBoundingClientRect` porque jsdom no lo calcula.

---

## Épica 5 — Colaboración y trazabilidad

### MIR-21 · Comentar un elemento de trabajo

> Como miembro
> quiero comentar en un item
> para dejar contexto y coordinarme con el equipo.

**Tipo:** Historia · **Prioridad:** Medium · **Estimación:** 5

**Criterios de aceptación**

- **Dado** un comentario no vacío, **cuando** lo publico, **entonces** recibo 201 y aparece con mi nombre y la fecha.
- **Dado** un comentario en blanco o de solo espacios, **cuando** lo envío, **entonces** recibo 422.
- **Dado** que soy VIEWER, **cuando** intento comentar, **entonces** recibo 403.
- **Dado** varios comentarios, **cuando** abro el item, **entonces** aparecen del más antiguo al más reciente.

---

### MIR-22 · Historial de cambios de un elemento

> Como miembro
> quiero ver qué cambió en un item, cuándo y quién lo hizo
> para entender cómo llegó a su estado actual.

**Tipo:** Historia · **Prioridad:** Medium · **Estimación:** 5

**Criterios de aceptación**

- **Dado** un item con cambios, **cuando** abro su historial, **entonces** veo las entradas en orden cronológico inverso, con actor y fecha.
- **Dado** un cambio de estado, **cuando** lo veo en el historial, **entonces** se lee en lenguaje natural ("movió de Por hacer a En progreso"), no como nombres de columnas de base de datos.
- **Dado** que una actualización falla a mitad de camino, **cuando** se revierte la transacción, **entonces** **no** queda una entrada de historial huérfana.

---

### MIR-23 · Panel del proyecto

> Como miembro
> quiero un panel con el resumen del proyecto
> para conocer su estado sin recorrer el backlog.

**Tipo:** Historia · **Prioridad:** Medium · **Estimación:** 5

**Criterios de aceptación**

- **Dado** un proyecto con items, **cuando** abro el panel, **entonces** veo el conteo por estado, por tipo y por prioridad.
- **Dado** un proyecto vacío, **cuando** abro el panel, **entonces** veo ceros y un mensaje orientador, no una pantalla rota.
- **Dado** el panel, **cuando** lo reviso, **entonces** muestra la actividad reciente del proyecto.

---

## Épica 6 — Calidad, infraestructura y entrega

### MIR-24 · Diseño responsive

**Tipo:** Tarea · **Prioridad:** High · **Estimación:** 5

- **Dado** un teléfono de 375 px de ancho, **cuando** navego por la aplicación, **entonces** ninguna vista produce desplazamiento horizontal no intencional.
- **Dado** el tablero en móvil, **cuando** lo abro, **entonces** las columnas se desplazan horizontalmente de forma intencional y legible.
- **Dado** los formularios en móvil, **cuando** los uso, **entonces** los campos ocupan el ancho disponible y los botones son alcanzables con el pulgar.

---

### MIR-25 · Protección de `main` y verificación en Pull Requests

**Tipo:** Tarea técnica · **Prioridad:** Highest · **Estimación:** 2

- `main` protegida: sin push directo, requiere Pull Request y una aprobación.
- El workflow de CI es check obligatorio para poder fusionar.
- `develop` creada y configurada como rama por defecto.

---

### MIR-26 · Wiki del proyecto

**Tipo:** Documentación · **Prioridad:** High · **Estimación:** 5

- Home como índice con enlaces a todas las páginas.
- Páginas de `deliverables/entregas.md` §4.7: `Proyecto - Resumen y alcance`,
  `Proyecto - Requisitos y trazabilidad`, `Proyecto - Arquitectura y
  tecnologías`, `Proyecto - Estrategia de pruebas`, `Proyecto - Supuestos y
  dependencias`, `Proyecto - Evidencias`, `Entrega 1`, `Entrega 2`, `Entrega 3`.
- Página "Entrega 1" con H1 exactamente `Entrega 1`.
- Contenido fuente en `docs/wiki/`, publicado a la Wiki por
  `.github/workflows/wiki.yml` en cada push a `develop` (espejo exacto). La
  Wiki no se edita en GitHub.
- CI verifica en cada PR: sin `[[wikilinks]]`, sin enlaces rotos y el H1 de
  cada entrega; en el PR de release a `main`, que no queden secciones ⏳.
- Las secciones que dependen del release (resultados, evidencias, uso de IA)
  quedan marcadas ⏳ y se completan en MIR-28.

---

### MIR-27 · Despliegue del ambiente de demostración

**Tipo:** Tarea técnica · **Prioridad:** High · **Estimación:** 5

- Frontend desplegado en Vercel con `VITE_API_URL=/api`, reenviado a la API
  por el rewrite de `apps/web/vercel.json`.
- API desplegada en Render, conectada al PostgreSQL de Supabase.
- Migraciones aplicadas con `prisma migrate deploy`.
- Cookies de sesión funcionando en Chrome, incógnito y Safari (mismo origen vía
  rewrite, ver D13); `CORS_ORIGIN` igual fijado al origen exacto de producción.
- `/api/health` verifica la base y un pinger externo lo llama cada 10 minutos.

---

### MIR-28 · Release `v1.0-entrega1`

**Tipo:** Tarea · **Prioridad:** Highest · **Estimación:** 2

- Pull Request de release de `develop` a `main`, revisado.
- Tag `v1.0-entrega1` sobre un commit estable de `main`.
- GitHub Release con funcionalidades, defectos corregidos, pruebas ejecutadas y
  limitaciones conocidas.
- Evidencia congelada con `npm run wiki:evidencias -- entrega-1` sobre el
  commit del release, enlazada desde la Wiki.
- Páginas de la Wiki sin secciones ⏳ (salvo Entrega 2 y 3): lo exige el check
  "Verificar Wiki" del PR de release.

---

### MIR-29 · Cápsula de video de la Entrega 1

**Tipo:** Documentación · **Prioridad:** High · **Estimación:** 3

- Alcance de la herramienta de testing, trabajo realizado, dependencias del
  proyecto, estrategia de pruebas, ejecución de las pruebas, resultados y
  problemas encontrados.
- Enlace publicado en el README y en la Wiki.

---

## Reservado para la Entrega 2

No se trabaja ahora. Se documenta aquí para que el esquema de datos y las
decisiones ya lo contemplen, y porque la Entrega 2 exige **dos requerimientos
funcionales nuevos**.

| ID | Requerimiento | Por qué se reservó |
| --- | --- | --- |
| MIR-30 | Sprints: crear, asignar items, cerrar | `WorkItem.sprintId` ya existe como campo nullable |
| MIR-31 | Columnas del tablero configurables por proyecto | Migración de enum a tabla `BoardColumn`, ya prevista en D8 |
| MIR-32 | Organizaciones y multi-equipo | `Project.organizationId` ya existe como campo nullable |
| MIR-33 | Jenkins: instalación, pipeline e integración con Slack | Es el objeto central de la Entrega 2 |

---

## Resumen por épica

| Épica | Items | Story points |
| --- | --- | --- |
| 1 — Autenticación | 4 | 16 |
| 2 — Proyectos y equipo | 6 | 24 |
| 3 — Elementos de trabajo | 7 | 32 |
| 4 — Tablero Kanban | 3 | 21 |
| 5 — Colaboración y trazabilidad | 3 | 15 |
| 6 — Calidad y entrega | 6 | 22 |
| **Total Entrega 1** | **29** | **130** |

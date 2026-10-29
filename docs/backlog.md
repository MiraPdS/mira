# Backlog — Mira

Backlog de las Entregas 1 y 2. **Ya está cargado en Jira**, con los mismos IDs
que aparecen en este documento:

- Tablero: https://bolgunn.atlassian.net/jira/software/projects/MIR/boards
- `MIR-1` … `MIR-30` — Entrega 1 (`MIR-30` se agregó al verificar el release)
- `MIR-31`, `MIR-33` y `MIR-43` … `MIR-58` — Entrega 2 (`MIR-31` y `MIR-33`
  eran reservas y se reutilizaron)
- `MIR-32` — organizaciones y multi-equipo, fuera de alcance
- `MIR-34` … `MIR-42` — las épicas (`MIR-40` a `MIR-42` son de la Entrega 2)

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

### MIR-30 · Crear desde el tablero y abrir el detalle desde el backlog — ✅ implementado

> Como miembro
> quiero crear items desde el tablero y abrir cualquier item desde el backlog
> para no depender de una sola pantalla para cada cosa.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 3

Detectado al verificar el release `v1.0-entrega1`: el detalle solo se abría
desde las tarjetas del tablero, así que un item en BACKLOG (que el tablero no
muestra) no tenía cómo abrirse, y el tablero no permitía crear.

**Criterios de aceptación**

- **Dado** que soy OWNER o MEMBER, **cuando** creo un item desde el tablero, **entonces** nace en "Por hacer" y aparece en esa columna sin recargar.
- **Dado** que soy VIEWER, **cuando** abro el tablero, **entonces** no veo el botón de crear.
- **Dado** el backlog, **cuando** hago clic en el título de un item (en cualquier estado), **entonces** se abre su detalle.
- **Dado** que abrí el detalle desde el backlog, **cuando** vuelvo o elimino el item, **entonces** regreso al backlog; desde el tablero, al tablero.

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

Ampliados al planificar (ver `docs/plans/MIR-22-historial-elemento.md`):

- **Dado** que soy VIEWER del proyecto, **cuando** abro el historial, **entonces** lo veo; **dado** que no soy miembro, **entonces** recibo 404.
- **Dado** un item con más de 100 cambios, **cuando** abro su historial, **entonces** veo los 100 más recientes y un aviso de que la lista está recortada.
- **Dado** el panel del proyecto (MIR-23), **cuando** muestra la actividad, **entonces** usa las mismas frases en lenguaje natural, refiriéndose a "un ítem".

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

# Entrega 2

La Entrega 2 ([`deliverables/entrega2.md`](../deliverables/entrega2.md)) pide
llevar el proyecto a CI/CD con Jenkins, integrado con GitHub y Slack, y
desarrollar **dos requerimientos funcionales nuevos** con sus pruebas. Los
elegidos son los dos que ya estaban previstos en el esquema y en las decisiones:

- **Sprints:** el enunciado del tema (`requirements/tema2.md`) los pide como
  requisito base ("Creación y gestión de Sprints", "Asignación de elementos de
  trabajo a un Sprint") y es lo único obligatorio que quedó fuera de la
  Entrega 1. `WorkItem.sprintId` ya existe como campo nullable.
- **Columnas del tablero configurables por proyecto:** el reemplazo del enum
  fijo que D8 dejó reservado para esta entrega.

Organizaciones y multi-equipo (`Project.organizationId`) queda fuera: es un
aspecto abierto del tema, no un requisito.

También cierra el compromiso que quedó de la Entrega 1: el umbral de cobertura
que rompe el build (ver "Decisiones pendientes" en
[`decisiones-tecnicas.md`](./decisiones-tecnicas.md)).

El reparto, el DAG de dependencias y el orden sugerido están en
[`plan-trabajo-entrega2.md`](./plan-trabajo-entrega2.md).

---

## Épica 7 — Sprints

### MIR-43 · Modelo y API de Sprints

> Como miembro
> quiero que el proyecto tenga sprints con nombre, fechas y objetivo
> para planificar el trabajo en iteraciones.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

- **Dado** que soy OWNER o MEMBER, **cuando** hago POST a `/api/projects/:id/sprints` con nombre, fecha de inicio y fecha de término, **entonces** recibo 201 y el sprint nace en estado `PLANNED`.
- **Dado** que la fecha de término es anterior a la de inicio, **cuando** creo o edito el sprint, **entonces** recibo 422 indicando el campo `endDate`.
- **Dado** que soy VIEWER, **cuando** intento crear, editar o eliminar un sprint, **entonces** recibo 403.
- **Dado** el proyecto, **cuando** listo sus sprints, **entonces** los veo ordenados por fecha de inicio con su estado y la cantidad de items y de puntos de cada uno.
- **Dado** un sprint, **cuando** consulto la base de datos, **entonces** `WorkItem.sprintId` es una FK real hacia `Sprint` (la migración agrega la relación que hoy falta).

---

### MIR-44 · Pantalla de Sprints

> Como miembro
> quiero ver y administrar los sprints del proyecto en una pantalla
> para no tener que hacerlo a través de la API.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

- **Dado** el proyecto, **cuando** abro "Sprints", **entonces** veo el sprint activo arriba, los planificados después y los cerrados al final.
- **Dado** que soy OWNER o MEMBER, **cuando** creo o edito un sprint desde el formulario, **entonces** aparece en la lista sin recargar.
- **Dado** que soy VIEWER, **cuando** abro la pantalla, **entonces** no veo los botones de crear ni de editar.
- **Dado** un formulario con datos inválidos, **cuando** lo envío, **entonces** veo el error junto al campo que corresponde.

---

### MIR-45 · Asignar elementos a un sprint

> Como miembro
> quiero mover elementos del backlog a un sprint
> para decidir qué entra en cada iteración.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 5

**Criterios de aceptación**

- **Dado** un elemento, **cuando** le asigno un sprint `PLANNED` o `ACTIVE` desde el detalle, **entonces** queda en ese sprint y se registra en su historial.
- **Dado** un sprint `CLOSED`, **cuando** intento asignarle un elemento, **entonces** recibo 409 y el elemento no cambia.
- **Dado** un elemento de otro proyecto, **cuando** intento asignarlo al sprint, **entonces** recibo 400.
- **Dado** el backlog, **cuando** filtro por sprint (o por "sin sprint"), **entonces** veo solo esos elementos.

---

### MIR-46 · Iniciar y cerrar un sprint

> Como miembro
> quiero iniciar un sprint y cerrarlo al terminar
> para que el equipo trabaje sobre una sola iteración a la vez.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 5

**Criterios de aceptación**

- **Dado** un sprint `PLANNED`, **cuando** lo inicio, **entonces** pasa a `ACTIVE`.
- **Dado** que el proyecto ya tiene un sprint `ACTIVE`, **cuando** intento iniciar otro, **entonces** recibo 409 `SPRINT_ALREADY_ACTIVE`.
- **Dado** un sprint `ACTIVE`, **cuando** lo cierro, **entonces** pasa a `CLOSED` y sus elementos no terminados vuelven al backlog o pasan al sprint planificado que yo elija.
- **Dado** un sprint cerrado, **cuando** lo consulto, **entonces** veo cuántos puntos se comprometieron y cuántos se completaron.

---

### MIR-47 · Tablero del sprint activo

> Como miembro
> quiero que el tablero muestre por defecto el sprint activo
> para concentrarme en lo que el equipo comprometió.

**Tipo:** Historia · **Prioridad:** Medium · **Estimación:** 3

**Criterios de aceptación**

- **Dado** un proyecto con sprint activo, **cuando** abro el tablero, **entonces** veo solo los elementos de ese sprint y su nombre y fechas en el encabezado.
- **Dado** el tablero, **cuando** elijo "Todos los elementos", **entonces** vuelvo a la vista sin filtro de la Entrega 1.
- **Dado** un proyecto sin sprint activo, **cuando** abro el tablero, **entonces** veo todos los elementos, como en la Entrega 1.

---

## Épica 8 — Columnas configurables del tablero

### MIR-31 · Migrar los estados a columnas por proyecto

> Como equipo
> queremos que los estados del tablero vivan en una tabla por proyecto
> para poder adaptarlos al flujo de cada equipo.

**Tipo:** Tarea técnica · **Prioridad:** Highest · **Estimación:** 8

Reemplaza el enum fijo de D8 por la tabla `BoardColumn` (nombre, orden y una
categoría `TODO`, `IN_PROGRESS` o `DONE`). La categoría es lo que permite que el
panel (MIR-23) y el cierre de sprint (MIR-46) sigan sabiendo qué está terminado
aunque la columna se llame distinto.

**Criterios de aceptación**

- **Dado** un proyecto existente, **cuando** se aplica la migración, **entonces** recibe las columnas Por hacer, En progreso, En revisión y Hecho, y cada elemento queda en la columna que corresponde a su estado anterior, sin perder ninguno.
- **Dado** un proyecto nuevo, **cuando** se crea, **entonces** nace con esas mismas cuatro columnas.
- **Dado** el backlog, **cuando** un elemento no está en ninguna columna, **entonces** se sigue considerando BACKLOG y no aparece en el tablero.
- **Dado** el historial y el panel, **cuando** un elemento cambia de columna, **entonces** se sigue registrando `ITEM_STATUS_CHANGED` y el panel cuenta por categoría.
- **Dado** la suite de la Entrega 1, **cuando** corre después de la migración, **entonces** sigue en verde.

---

### MIR-48 · API de columnas

> Como OWNER
> quiero crear, renombrar, reordenar y eliminar columnas
> para que el tablero refleje el flujo real del equipo.

**Tipo:** Historia · **Prioridad:** Highest · **Estimación:** 5

**Criterios de aceptación**

- **Dado** que soy OWNER, **cuando** creo una columna con nombre y categoría, **entonces** recibo 201 y queda al final del tablero.
- **Dado** que soy MEMBER o VIEWER, **cuando** intento modificar las columnas, **entonces** recibo 403.
- **Dado** dos columnas, **cuando** cambio su orden, **entonces** el nuevo orden se conserva al recargar.
- **Dado** una columna con elementos, **cuando** la elimino, **entonces** debo indicar a qué columna se mueven; sin destino recibo 409.
- **Dado** un proyecto, **cuando** intento dejarlo sin ninguna columna de categoría `DONE`, **entonces** recibo 409.

---

### MIR-49 · Tablero y backlog con las columnas del proyecto

> Como miembro
> quiero que el tablero muestre las columnas de mi proyecto
> para trabajar con mi propio flujo.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 5

**Criterios de aceptación**

- **Dado** un proyecto con columnas personalizadas, **cuando** abro el tablero, **entonces** veo esas columnas en su orden.
- **Dado** una tarjeta, **cuando** la muevo por el menú o arrastrándola, **entonces** puede ir a cualquier columna del proyecto.
- **Dado** el backlog y sus filtros, **cuando** filtro por estado, **entonces** las opciones son las columnas del proyecto.
- **Dado** un teléfono de 375 px, **cuando** el proyecto tiene más de cuatro columnas, **entonces** el tablero se desplaza horizontalmente de forma legible.

---

### MIR-50 · Pantalla de configuración de columnas

> Como OWNER
> quiero administrar las columnas desde la configuración del proyecto
> para cambiarlas sin pedirle nada al equipo de desarrollo.

**Tipo:** Historia · **Prioridad:** High · **Estimación:** 5

**Criterios de aceptación**

- **Dado** que soy OWNER, **cuando** abro la configuración del proyecto, **entonces** puedo agregar, renombrar, reordenar y eliminar columnas.
- **Dado** que elimino una columna con elementos, **cuando** confirmo, **entonces** se me pide elegir la columna de destino.
- **Dado** que soy MEMBER o VIEWER, **cuando** abro la configuración, **entonces** veo las columnas pero no puedo modificarlas.

---

## Épica 9 — Integración y despliegue continuo

> **Jenkins se reemplazó por GitHub Actions y Slack por Discord**, con
> autorización del profesor
> ([D14](./decisiones-tecnicas.md#d14--github-actions-como-cicd-oficial)).
> `MIR-33` ya está reescrito; `MIR-51` a `MIR-55` todavía describen Jenkins y
> se reescriben en un PR de documentación aparte.

### MIR-33 · CI/CD oficial en GitHub Actions

**Tipo:** Tarea técnica · **Prioridad:** Highest · **Estimación:** 3

- Queda registrada **D14 — GitHub Actions como CI/CD oficial**, citando la
  autorización del profesor; D11 remite a D14 y la tabla de decisiones
  pendientes marca resueltas "Dónde corre Jenkins" y Slack/Discord.
- Existe el environment `deploy` en GitHub, restringido a la rama `main`, sin
  revisores obligatorios, con los secretos `RENDER_DEPLOY_HOOK_URL` y
  `VERCEL_DEPLOY_HOOK_URL`. `NOTIFY_WEBHOOK_URL` (Discord) existe como secreto
  de repositorio. Ningún valor está en el repositorio.
- Los workflows declaran `permissions:` mínimos y la protección de `main`
  aplica también a los administradores.
- [`docs/ci-cd.md`](./ci-cd.md) documenta disparadores, jobs, secretos
  (nombre, dónde vive, de dónde sale el valor, quién lo usa) y cómo recrear la
  configuración.

---

### MIR-51 · Pipeline en `Jenkinsfile`

**Tipo:** Tarea técnica · **Prioridad:** Highest · **Estimación:** 5

- `Jenkinsfile` declarativo versionado en la raíz del repositorio.
- Etapas: instalación (`npm ci`), lint, tipos, pruebas unitarias, de
  integración (con Postgres efímero) y de componentes (RTL), y build.
- Falla rápido: si una etapa falla, las siguientes no corren y el build queda
  rojo.
- Publica los reportes de pruebas (JUnit) y de cobertura como artefactos del
  build, para dejar trazabilidad de cada ejecución.

---

### MIR-52 · Webhook de GitHub y estado en el commit

**Tipo:** Tarea técnica · **Prioridad:** Highest · **Estimación:** 3

- Un webhook de GitHub dispara el pipeline en cada push y en cada Pull Request
  hacia `develop` y `main` (multibranch pipeline).
- El resultado queda asociado al commit y al PR como check verde o rojo.
- El check de Jenkins se agrega como obligatorio en la protección de `main`
  (junto al de GitHub Actions de MIR-25).

---

### MIR-53 · Notificaciones a Slack

**Tipo:** Tarea técnica · **Prioridad:** High · **Estimación:** 2

- Jenkins avisa en el canal del equipo cuando un build falla, cuando vuelve a
  pasar después de un fallo y cuando termina un despliegue.
- El mensaje incluye la rama, el commit, el autor y un enlace al build.

---

### MIR-54 · Despliegue desde Jenkins

**Tipo:** Tarea técnica · **Prioridad:** Medium · **Estimación:** 3

- Un build verde en `main` despliega la API en Render y el frontend en Vercel
  mediante sus deploy hooks, y después verifica `/api/health`.
- Un build rojo no despliega.
- Se documentan las dependencias entre Jenkins y la aplicación (qué usa cada
  etapa y de dónde sale cada credencial).

---

### MIR-55 · Umbral de cobertura que rompe el build

**Tipo:** Tarea técnica · **Prioridad:** High · **Estimación:** 2

Compromiso pendiente de la Entrega 1.

- Umbral de cobertura fijado en `vitest.config.ts` a partir de la línea base
  real medida al inicio de la entrega.
- Si la cobertura baja del umbral, el pipeline queda rojo, tanto en Jenkins
  como en GitHub Actions.
- El umbral y su justificación quedan en la estrategia de pruebas.

---

## Épica 6 — Calidad, infraestructura y entrega (Entrega 2)

### MIR-56 · Wiki de la Entrega 2

**Tipo:** Documentación · **Prioridad:** High · **Estimación:** 3

- Página `Entrega 2` con los nueve puntos del Anexo A del enunciado: objetivo,
  qué se implementó, arquitectura e infraestructura (obligatoria), pipeline,
  integraciones, cómo ejecutar, mejoras en la aplicación, pruebas y su
  relación con CI, y problemas encontrados con sus soluciones.
- Diagrama de la infraestructura: dónde corren la app y Jenkins, y cómo se
  conectan GitHub, Jenkins, Slack, Render y Vercel.
- Evidencias del pipeline: capturas, logs y el historial de builds.
- Trazabilidad actualizada con los requerimientos nuevos.

---

### MIR-57 · Release `v2.0-entrega2`

**Tipo:** Tarea · **Prioridad:** Highest · **Estimación:** 2

- Pull Request de release de `develop` a `main`, con los checks de Jenkins y de
  GitHub Actions en verde.
- Tag `v2.0-entrega2` sobre el merge commit, desplegado por el pipeline.
- GitHub Release con funcionalidades, defectos corregidos, pruebas ejecutadas y
  limitaciones conocidas.
- Evidencia congelada con `npm run wiki:evidencias -- entrega-2`.

---

### MIR-58 · Cápsula de video de la Entrega 2

**Tipo:** Documentación · **Prioridad:** High · **Estimación:** 3

- Cubre alcance de la herramienta, trabajo realizado (proyecto y dependencias
  entre Jenkins y la aplicación), uso de Jenkins y problemas encontrados con
  sus soluciones.
- Enlace publicado en el README y en la Wiki.

---

## Resumen por épica

| Épica | Items | Story points |
| --- | --- | --- |
| 1 — Autenticación | 4 | 16 |
| 2 — Proyectos y equipo | 6 | 24 |
| 3 — Elementos de trabajo | 8 | 35 |
| 4 — Tablero Kanban | 3 | 21 |
| 5 — Colaboración y trazabilidad | 3 | 15 |
| 6 — Calidad y entrega | 6 | 22 |
| **Total Entrega 1** | **30** | **133** |
| 7 — Sprints | 5 | 23 |
| 8 — Columnas configurables | 4 | 23 |
| 9 — Integración y despliegue continuo | 6 | 18 |
| 6 — Calidad y entrega (Entrega 2) | 3 | 8 |
| **Total Entrega 2** | **18** | **72** |

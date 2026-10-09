# Plan — MIR-5 (ampliacion web) · Pantalla crear proyecto

**Rama:** `feature/MIR-5-pantalla-crear-proyecto` (desde `origin/develop`,
`abc915d`, ya incluye MIR-6 y MIR-9)
**Estimacion:** MIR-5 pasa de 5 a 8 pts (API 5, ya hecha + web 3) · **Prioridad:** Highest
**Alcance:** solo `apps/web` y docs. La API (`POST /api/projects`) y
`createProjectSchema` ya existen y tienen pruebas; no se tocan.

## Por que

En MIR-6 el boton "Nuevo proyecto" y el estado vacio llevan a
`/proyectos/nuevo`, que es un marcador: no hay formulario y nunca se llama a la
API. MIR-5 solo tenia criterios de API. Se amplia MIR-5 con la pantalla web.

## Criterios de aceptacion nuevos (web)

- **Dado** que estoy en "Mis proyectos", **cuando** pulso "Nuevo proyecto" y
  envio nombre y clave validos, **entonces** vuelvo a la lista y el proyecto
  aparece con mi rol Propietario.
- **Dado** que la clave ya existe, **cuando** envio, **entonces** veo el
  mensaje bajo el campo clave, conservo lo escrito y el campo recibe el foco.
- **Dado** datos que no cumplen el formato, **cuando** envio, **entonces** veo
  el error bajo cada campo sin llamar a la API.

## Lo que ya existe y se reutiliza

| Pieza | Donde | Uso |
| --- | --- | --- |
| `createProjectSchema` / `CreateProjectInput` | `@mira/shared` | validacion en cliente (mismo esquema que el servidor) |
| `RegisterPage` | `features/auth` | patron: zodResolver, `setError` para 409/422, banner para el resto |
| `Field`, `Input`, `Button` | `components/ui` | campos accesibles con `<id>-hint` / `<id>-error` |
| `projectApi`, `projectKeys` | `features/projects/project.api.ts`, `useProjects.ts` | se agrega `create` y `useCreateProject` |
| Manejador global de 401 | `lib/query-client.ts` | sesion perdida -> `/login` |

## Decisiones tomadas

1. **Exito:** `navigate('/proyectos', { replace: true })` (atras no vuelve al
   formulario) e `invalidateQueries({ queryKey: projectKeys.all })` en el
   `onSuccess` de la mutacion. Sin toast: el proyecto en la lista es la
   confirmacion. Cuando exista MIR-23 se puede cambiar el destino.
2. **Campos:**
   - Nombre (`Input`).
   - Clave (`Input`, clase `uppercase`) con ayuda: "De 2 a 8 letras o numeros,
     empezando por letra. Es el prefijo de las tarjetas (MIR-1)." El esquema
     ya la pasa a mayusculas al enviar.
   - Descripcion (opcional): `<textarea>` con las clases de `Input`, sin
     componente nuevo. **Vacia -> `undefined`** antes de enviar, para no
     guardar `""` en vez de `null`.
   - Sin autogenerar la clave desde el nombre.
3. **Botones:** "Crear proyecto" (`submit`, "Creando..." y deshabilitado en
   curso) y "Cancelar" (enlace a `/proyectos`).
4. **Errores**, igual que `RegisterPage`:
   - 409 `PROJECT_KEY_TAKEN` -> bajo Clave, con `shouldFocus: true`;
   - 422 con `fields` -> bajo cada campo;
   - red/500/sin campo -> banner `role="alert"`;
   - 401 -> manejador global.
   Lo escrito nunca se resetea ante un error.
5. Textos sin tildes, como el resto de la UI.

## Cambios por archivo

### 1. `apps/web/src/features/projects/project.api.ts`

- `projectApi.create(input: CreateProjectInput): Promise<ProjectDto>` ->
  `POST /projects`, devuelve `project` de `{ project: ProjectDto }`.

### 2. `apps/web/src/features/projects/useProjects.ts`

- `useCreateProject()`: `useMutation<ProjectDto, Error, CreateProjectInput>`
  con `onSuccess` que invalida `projectKeys.all`.

### 3. `apps/web/src/features/projects/CreateProjectPage.tsx` (nuevo)

- `useForm<CreateProjectInput>` con `zodResolver(createProjectSchema)`,
  `defaultValues: { name: '', key: '', description: '' }`.
- `onSubmit`: limpia `description` vacia, `mutateAsync`, `navigate`; errores
  segun decision 4.
- Layout: `<main>` con `<h1>Nuevo proyecto</h1>`, formulario con `Field`s,
  banner, botones.

### 4. `apps/web/src/App.tsx`

- `/proyectos/nuevo` -> `<CreateProjectPage />` (se elimina el `Pendiente`).

### 5. Docs

- `docs/backlog.md`: MIR-5 con los criterios web y estimacion 8.
- `docs/jira-import.csv`: misma ampliacion en la fila de MIR-5.
- `docs/plan-trabajo.md`: MIR-5 a 8 pts en la tabla y el grafo, total de
  Benjamin y total general. La ruta critica no cambia: lo que bloquea a
  MIR-11 es la API, ya hecha.

## Tests

### `features/projects/CreateProjectPage.test.tsx` (nuevo)

RTL + MSW, `useNavigate` mockeado como en `RegisterPage.test.tsx`.

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | Valido | cuerpo `{ name, key: 'MIR' }` (escrita en minusculas), sin `description`; `navigate('/proyectos', { replace: true })` |
| 2 | Con descripcion | `description` enviada sin espacios sobrantes |
| 3 | Cache | `projectKeys.all` sembrada; tras crear queda invalidada |
| 4 | Clave mal formada | error bajo Clave; ninguna peticion a la API |
| 5 | 409 `PROJECT_KEY_TAKEN` | mensaje bajo Clave, foco en Clave, valores conservados, `navigate` no llamado |
| 6 | 422 con `fields.name` | mensaje bajo Nombre |
| 7 | 500 | banner; valores conservados |
| 8 | En curso | "Creando..." deshabilitado |
| 9 | Cancelar | enlace a `/proyectos` |

### `App.test.tsx` (ampliar)

Flujo completo: `/proyectos` vacio -> "Nuevo proyecto" -> llenar -> enviar ->
el proyecto aparece en la lista con rol "Propietario". El handler de
`GET /projects` devuelve el proyecto despues del `POST`.

## Verificacion

1. `npx vitest run --project web` en verde (API sin cambios).
2. `npm run lint`, `npm run typecheck`, `npm run format:check`.
3. Manual: `npm run dev`, iniciar sesion, "Nuevo proyecto", crear uno ->
   aparece en la lista como Propietario; repetir la clave -> mensaje bajo
   Clave con foco.

## Cierre

- Commits: `feat(web): MIR-5 pantalla crear proyecto` y
  `docs: MIR-5 ampliar con la pantalla web`.
- PR hacia `develop`. Actualizar el ticket MIR-5 en Jira (criterios y 8 pts).

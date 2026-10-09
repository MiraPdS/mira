# Plan — MIR-4 · Cerrar sesion y sesion persistente

**Rama:** `feature/MIR-4-cerrar-sesion` (desde `origin/develop`, `2d5733e`, ya
incluye MIR-2 y MIR-12)
**Estimacion:** 3 pts · **Prioridad:** Highest
**Alcance:** solo `apps/web`. La API (`POST /auth/logout`, `GET /auth/me`) ya
existe y tiene pruebas de integracion; no se toca la API ni `@mira/shared`.

## Conflictos con PRs abiertos

Revisado contra todos los PRs y ramas remotas al momento de planificar:

| PR / rama | Archivos web | Conflicto |
| --- | --- | --- |
| #4 MIR-14 | `WorkItemDetail*`, `useWorkItems.ts`, `work-items.api.ts` | No |
| #3 MIR-5 | solo API | No |
| MIR-9 | sin cambios web | No |

Nadie mas toca `App.tsx`, `useAuth.ts`, `query-client.ts`, `test/render.tsx` ni
los handlers de MSW. MIR-12 y MIR-14 crean componentes pero **no los enrutan**:
quien los enrute los anida bajo el layout autenticado.

## Lo que ya existe y se reutiliza

| Pieza | Donde | Uso |
| --- | --- | --- |
| `useCurrentUser()` | `features/auth/useAuth.ts` | sesion actual; 401 -> `null` |
| `useLogout()` | `features/auth/useAuth.ts` | ya hace `setQueryData(me, null)` + `clear()` en exito; no se modifica |
| `RequiereSesion` | `App.tsx` (privado) | se mueve a `guards.tsx` y se amplia |
| `Button` (`variant="ghost"`) | `components/ui/button.tsx` | boton de cerrar sesion |
| Handlers MSW de `/auth/logout` (204) y `/auth/me` (401) | `test/msw/handlers.ts` | por defecto: logout ok, sin sesion |

## Decisiones tomadas

1. **Layout autenticado como ruta padre.**
   `<Route element={<RequiereSesion><AppLayout /></RequiereSesion>}>` con las
   rutas protegidas anidadas. Las pantallas futuras (MIR-5/6/12/14) solo se
   anidan; nadie vuelve a envolver con `RequiereSesion` a mano.
2. **Guardia de invitado (`SoloInvitados`) para `/login` y `/registro`:**
   renderiza el formulario **de inmediato** y redirige a `/proyectos`
   (`replace`) cuando `me` resuelve a un usuario. Mientras carga o si `/me`
   falla, se ve el formulario. No hay "Cargando..." para invitados y
   `App.test.tsx` no cambia. Tras login/registro exitoso redirigen tanto la
   pagina (`navigate`) como la guardia: mismo destino, inofensivo; se mantiene
   el `navigate` de la pagina para que sus tests no dependan de la guardia.
3. **Cerrar sesion:**
   - En curso: boton deshabilitado con texto "Cerrando..." (sin doble envio).
   - 204: el hook limpia la cache (sin cambios) y el boton hace
     `navigate('/login', { replace: true })` de forma explicita.
   - Error (red, 500): se **mantiene la sesion** y la pagina; mensaje inline
     `role="alert"` junto al boton: "No se pudo cerrar sesion. Intenta de
     nuevo." No se toca la cache. Razon: la cookie es `HttpOnly`, JS no puede
     borrarla; "cerrar localmente" mentiria y un recargo volveria a entrar.
   - Sin dialogo de confirmacion.
4. **Manejador global de 401** en `createQueryClient`: `QueryCache` y
   `MutationCache` con `onError`; ante `ApiRequestError` con `status === 401`
   y `code !== 'INVALID_CREDENTIALS'` -> `setQueryData(authKeys.me, null)` +
   `clear()`. La guardia del layout redirige sola a `/login`. La excepcion es
   obligatoria: un login con contrasena mala tambien responde 401.
   `/me` no dispara el manejador porque su `queryFn` ya convierte el 401 en
   `null`.
5. **Sin "volver a donde estaba"**: tras login siempre `/proyectos`. Evita que
   el usuario B aterrice en la URL del proyecto del usuario A en un equipo
   compartido. Queda como posible mejora futura.
6. **`RequiereSesion` distingue tres estados:**
   - cargando -> "Cargando..." (`role="status"`), como hoy;
   - `user === null` (401) -> `<Navigate to="/login" replace />`;
   - error (red/5xx, tras los reintentos del query client) -> `role="alert"`
     "No se pudo verificar tu sesion." + boton **"Reintentar"** que llama a
     `refetch()`. **No** redirige: una caida de la API no debe parecer un
     cierre de sesion (CA1).
7. **Tests con el query client real:** `crearQueryClientDePrueba` en
   `test/render.tsx` pasa a construirse con `createQueryClient()` y luego
   `setDefaultOptions(...)` con `retry: false, gcTime: 0, staleTime: 0`, para
   que los tests de componente ejerciten el manejador de 401 de verdad.
   Revisado: el unico test que usa 401 es `INVALID_CREDENTIALS` en
   `LoginPage.test.tsx`, que el manejador ignora.
8. Textos sin tildes, como el resto de la UI.

## Cambios por archivo

### 1. `apps/web/src/lib/query-client.ts`

- Crear `queryCache` y `mutationCache` con `onError: alPerderSesion`, donde
  `alPerderSesion(error)` aplica la decision 4 sobre el `queryClient` creado
  en la misma funcion (cierre sobre la variable).
- `authKeys` se importa de `@/features/auth/useAuth` (ojo con import
  circular: `useAuth.ts` importa `api-client`, no `query-client`; no hay
  ciclo). Si se prefiere evitar la dependencia lib -> feature, mover
  `authKeys` a `features/auth/auth.keys.ts` y reexportar desde `useAuth.ts`.
- Se conservan los `defaultOptions` actuales.

### 2. `apps/web/src/features/auth/guards.tsx` (nuevo)

- `RequiereSesion({ children })`: decision 6. Usa
  `const { data: user, isPending, isError, refetch } = useCurrentUser()`.
  Orden de chequeo: `isPending` -> `isError` -> `user ? children : Navigate`.
- `SoloInvitados({ children })`: `const { data: user } = useCurrentUser()`;
  `user ? <Navigate to="/proyectos" replace /> : <>{children}</>`.

### 3. `apps/web/src/features/auth/LogoutButton.tsx` (nuevo)

- `const logout = useLogout(); const navigate = useNavigate();`
- `onClick`: `try { await logout.mutateAsync(); navigate('/login', { replace: true }) } catch { /* queda en logout.error */ }`.
- `<Button variant="ghost" disabled={logout.isPending}>` con texto
  `logout.isPending ? 'Cerrando...' : 'Cerrar sesion'`.
- Si `logout.isError`: `<p role="alert" className="text-sm text-red-600">No se pudo cerrar sesion. Intenta de nuevo.</p>`.

### 4. `apps/web/src/components/layout/AppLayout.tsx` (nuevo)

- `<header>` con "Mira" a la izquierda; a la derecha `user.name` (de
  `useCurrentUser`, garantizado por la guardia) y `<LogoutButton />`.
- `<Outlet />` debajo.

### 5. `apps/web/src/App.tsx`

- Eliminar `RequiereSesion` local; importar `RequiereSesion` y `SoloInvitados`
  de `guards.tsx`.
- `/login` -> `<SoloInvitados><LoginPage /></SoloInvitados>`; igual
  `/registro`.
- Ruta padre sin `path` con `element={<RequiereSesion><AppLayout /></RequiereSesion>}`
  y dentro `/proyectos` -> `<Pendiente item="MIR-6" … />`.
- `/` y `*` quedan como estan (publicas, fuera del layout).

### 6. `apps/web/src/test/render.tsx`

- Decision 7.

## Tests

Nivel componente (RTL + MSW, proveedores reales). Usuario autenticado via
`server.use(http.get('/auth/me', () => HttpResponse.json({ user: USUARIO_DE_PRUEBA })))`.

### `features/auth/guards.test.tsx` (nuevo)

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | CA1 · recargo con sesion | `RequiereSesion` muestra "Cargando..." y luego el contenido protegido |
| 2 | Sin sesion (401) | redirige a `/login` (ruta de prueba muestra marcador) |
| 3 | `/me` responde 500 | alerta "No se pudo verificar tu sesion", **sin** redireccion; al cambiar el handler a 200 y pulsar "Reintentar" aparece el contenido |
| 4 | `SoloInvitados` con sesion | redirige a `/proyectos` |
| 5 | `SoloInvitados` sin sesion | el contenido se ve **de inmediato** (consulta sincrona `getBy…`) |

Para 2 y 4 se monta un `<Routes>` minimo con rutas marcador en vez de mockear
`useNavigate`, porque la redireccion la hace `<Navigate>`.

### `features/auth/LogoutButton.test.tsx` (nuevo)

`useNavigate` mockeado como en `LoginPage.test.tsx`.

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | CA2 · 204 | `navigate('/login', { replace: true })`; `queryClient.getQueryData(authKeys.me)` es `undefined` (cache vaciada) |
| 2 | CA4 · cache del usuario anterior | se siembra `queryClient.setQueryData(['projects'], [...])`; tras logout `getQueryData(['projects'])` es `undefined` |
| 3 | En curso | handler con `delay()`; boton deshabilitado con "Cerrando..." |
| 4 | Error 500 | alerta "No se pudo cerrar sesion"; `navigate` **no** llamado; `me` sigue siendo el usuario |

### `lib/query-client.test.ts` (nuevo)

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | Query cualquiera responde 401 `UNAUTHORIZED` | `me` pasa a `null`; otras queries borradas |
| 2 | Mutacion responde 401 `INVALID_CREDENTIALS` | `me` y la cache **intactas** |

### `App.test.tsx` (ampliar, sin tocar el test existente)

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | CA2 + CA3 · flujo completo | con sesion en `/proyectos` se ve el header con el nombre; clic en "Cerrar sesion"; se llega a `/login`; con `/me` ya en 401, navegar a `/proyectos` vuelve a `/login` |
| 2 | Layout | en `/proyectos` con sesion aparece "Mis proyectos" dentro del layout (nombre del usuario y boton visibles) |

Nota: en el flujo completo, tras el 204 el handler de `/me` debe pasar a 401
(`server.use`) antes del clic, para simular la cookie borrada.

## Verificacion

1. `npx vitest run --project web`: los tests nuevos pasan y los existentes
   (`App`, `LoginPage`, `RegisterPage`, `CreateWorkItemForm`,
   `WorkItemBacklog`) siguen en verde.
2. `npm run lint`, `npm run typecheck` y `npm run format:check` sin errores.
3. Manual: `npm run db:up`, `npm run dev`;
   - iniciar sesion, recargar `/proyectos` -> sigue autenticado (CA1);
   - "Cerrar sesion" -> `/login`; cookie `mira_token` ausente en DevTools (CA2);
   - escribir `/proyectos` -> `/login` (CA3);
   - con sesion, ir a `/login` -> redirige a `/proyectos`;
   - con sesion, apagar la API y recargar -> "No se pudo verificar tu sesion"
     + "Reintentar"; encender la API y reintentar -> vuelve;
   - borrar la cookie a mano en DevTools y provocar una peticion -> `/login`.

## Cierre

- Commit: `feat(web): MIR-4 cerrar sesion y sesion persistente`.
- Push con `git push -u origin feature/MIR-4-cerrar-sesion`.
- PR hacia `develop`.
- Este plan (`docs/plans/`) no se commitea salvo que se decida lo contrario.
- Posible item futuro: "volver a donde estaba" tras login (decision 5).

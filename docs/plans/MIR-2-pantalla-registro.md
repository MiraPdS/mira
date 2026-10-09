# Plan — MIR-2 · Pantalla de registro (Web)

**Rama:** `feature/MIR-2-pantalla-registro` (desde `origin/develop`, `c40ed58`)
**Estimación:** 3 pts · **Prioridad:** Highest
**Alcance:** solo `apps/web`. No se toca la API ni `@mira/shared`.

## Lo que ya existe y se reutiliza

| Pieza | Dónde | Uso |
| --- | --- | --- |
| `registerSchema` / `RegisterInput` | `@mira/shared` | `zodResolver` del formulario |
| `useRegister()` | `features/auth/useAuth.ts` | mutación; ya escribe `authKeys.me` en la caché |
| `authApi.register` | `features/auth/auth.api.ts` | `POST /auth/register` |
| `ApiRequestError` (`status`, `code`, `fields`, `fieldError`) | `lib/api-client.ts` | mapeo de errores del servidor |
| Handler MSW de `/auth/register` (201) | `test/msw/handlers.ts` | camino feliz por defecto |
| `LoginPage.tsx` / `LoginPage.test.tsx` | `features/auth/` | plantilla de página y de tests |

## Decisiones tomadas

1. **409 `EMAIL_TAKEN`** → error **bajo el campo correo** (no banner), con
   `aria-invalid` y un enlace a `/login`:
   "Ya existe una cuenta con ese correo. ¿Quieres iniciar sesion?".
2. **422 con `fields`** → cada mensaje se pinta bajo su campo (`setError`).
3. **Banner `role="alert"`** solo para errores sin campo: red caída, 500, 422
   sin `fields`.
4. **El formulario conserva lo escrito** en todos los casos de error (no se
   llama a `reset`, no se navega).
5. **Contraseña:** texto de ayuda visible siempre
   ("Minimo 8 caracteres, con al menos una letra y un numero"), enlazado con
   `aria-describedby`. **Sin** campo de confirmación y **sin** botón de
   mostrar/ocultar.
6. **Sin guardia de invitado** (usuario con sesión que entra a `/registro`):
   queda para MIR-4.
7. Textos sin tildes, como el resto de la UI. Título y botón "Crear cuenta";
   botón en curso "Creando...".

## Cambios por archivo

### 1. `apps/web/src/components/ui/field.tsx`

- `error?: string` → `error?: ReactNode` (para admitir el enlace a login).
- Nueva prop opcional `hint?: string`, renderizada entre el control y el error
  como `<p id="{id}-hint" className="text-sm text-slate-500">`.
- Compatible hacia atrás: `LoginPage` y `CreateWorkItemForm` no cambian.

### 2. `apps/web/src/features/auth/RegisterPage.tsx` (nuevo)

Estructura calcada de `LoginPage`:

- `useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', email: '', password: '' } })`.
- Campos: `name` (`autoComplete="name"`), `email` (`type="email"`,
  `autoComplete="email"`), `password` (`type="password"`,
  `autoComplete="new-password"`, con `hint`).
- `aria-describedby` de cada input: id del error si lo hay; en `password`,
  además el id del hint (`"password-hint password-error"`).
- `onSubmit`:
  - éxito → `navigate('/proyectos', { replace: true })`.
  - `ApiRequestError` con `code === 'EMAIL_TAKEN'` →
    `setError('email', { type: 'EMAIL_TAKEN', message: error.message })`.
  - `ApiRequestError` con `status === 422` y `fields` → `setError` por cada
    campo conocido (`name`, `email`, `password`) con `error.fieldError(campo)`.
  - cualquier otro error → se deja en `register.error` y se muestra en el
    banner.
- Render del error de correo: si `errors.email?.type === 'EMAIL_TAKEN'`, el
  mensaje + `<Link to="/login">Inicia sesion</Link>`; si no, el mensaje plano.
- El banner solo se muestra si el error **no** fue mapeado a un campo.
- Los errores manuales se limpian solos en el siguiente envío: `handleSubmit`
  reemplaza los errores con el resultado del resolver.

### 3. `apps/web/src/App.tsx`

- `/registro` → `<RegisterPage />` en lugar de `<Pendiente item="MIR-2" … />`.

### 4. `apps/web/src/features/auth/RegisterPage.test.tsx` (nuevo)

Nivel componente (RTL + MSW, proveedores reales, `useNavigate` mockeado como en
`LoginPage.test.tsx`). Un test por criterio, más las decisiones:

| # | Caso | Verifica |
| --- | --- | --- |
| 1 | CA1 · carga | título, campos nombre/correo/contrasena por `getByLabelText`; hint enlazado vía `aria-describedby` |
| 2 | CA2 · correo inválido | error bajo el campo; espía en `server.use` **no** llamado |
| 3 | CA3 · registro exitoso | cuerpo `{ name, email, password }` con correo normalizado; `queryClient.getQueryData(authKeys.me)` es el usuario; `navigate('/proyectos', { replace: true })` |
| 4 | CA4 · 409 | mensaje bajo correo, `aria-invalid="true"`, enlace a `/login`, los tres campos conservan su valor, sin navegación |
| 5 | 422 con `fields` | `fields.password` aparece bajo el campo contrasena |
| 6 | Red caída | banner `role="alert"` con "No se pudo conectar" |

Ojo: `Field` pinta el error con `role="alert"`, así que en los casos 4–6 hay
que consultar el alerta concreta (por texto o dentro del campo), no
`findByRole('alert')` a secas.

## Verificación

1. `npx vitest run --project web`: los 6 tests nuevos pasan y
   `LoginPage.test.tsx` / `CreateWorkItemForm.test.tsx` siguen en verde.
2. `npm run lint`, `npm run typecheck` y `npm run format:check` sin errores.
3. Manual: `npm run db:up`, `npm run dev`; registrar una cuenta nueva (llega a
   `/proyectos`), repetir con el mismo correo (error + enlace), probar con la
   API apagada (banner).

## Cierre

- Commit: `feat(web): MIR-2 pantalla de registro`.
- Push con `git push -u origin feature/MIR-2-pantalla-registro` (la rama hoy
  rastrea `origin/develop`).
- PR hacia `develop`.
- Este plan (`docs/plans/`) no se commitea salvo que se decida lo contrario.
- Agregar a MIR-4 la nota: guardia de invitado para `/login` y `/registro`.

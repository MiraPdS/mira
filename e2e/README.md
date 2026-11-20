# Pruebas E2E — `@mira/e2e`

Pruebas de interfaz de la Entrega 3 con **Playwright**. Las decisiones del
andamiaje están en
[`docs/plans/MIR-61-andamiaje-playwright.md`](../docs/plans/MIR-61-andamiaje-playwright.md).

## Cómo correrlas

```bash
npm run db:up                                   # Postgres de pruebas en 5443
npx -w @mira/e2e playwright install chromium    # solo la primera vez
npm run test:e2e                                # todo
npm run test:e2e -- specs/elementos.spec.ts     # un archivo
npm run test:e2e -- --project=mobile            # solo móvil
npm run test:e2e:ui                             # modo interactivo
npm run report -w @mira/e2e                     # último reporte HTML
```

Qué pasa al correr `npm run test:e2e`:

1. `webServer` levanta la **API en :3100** contra `mira_e2e` y la **web en
   :4173** (`vite build` + `vite preview`). `vite preview` reenvía `/api` a la
   API, así que el navegador ve un solo origen, igual que en Vercel.
2. `global-setup.ts` hace `prisma migrate reset` sobre `mira_e2e`: migra y
   corre el seed (ada, alan, grace y el proyecto `MIR`).
3. El proyecto `setup` (`auth.setup.ts`) inicia sesión por API y guarda las
   cookies en `e2e/.auth/`.
4. Corren `chromium` (desktop, 1280×800) y `mobile` (375×812, touch).

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:4173` | Si la defines, **no** se levantan servidores, no se resetea la base y `proyectoPropio` falla a propósito |
| `E2E_API_PORT` | `3100` | Puerto de la API de E2E |
| `E2E_DATABASE_URL` | `…localhost:5443/mira_e2e` | Base de E2E; el reset solo acepta nombres `*_e2e` |
| `CI` | — | Usa `dist/` ya compilados, `workers: 2`, prohíbe `test.only` |

## Estructura

```
e2e/
  playwright.config.ts   entorno.ts   global-setup.ts   auth.setup.ts
  fixtures/
    index.ts      ← importar test y expect SIEMPRE desde aquí
    usuarios.ts   ← ada (OWNER), alan (MEMBER), grace (VIEWER) del seed
    proyecto.ts   ← fixture proyectoPropio
  specs/<modulo>.spec.ts
```

`playwright.config.ts`, `entorno.ts`, `global-setup.ts`, `auth.setup.ts` y
`fixtures/` son zona compartida: los cambios se proponen en el PR.

## Escribir una spec

```ts
import { expect, test, usuarios } from '../fixtures';

test.describe('MIR-11 · Crear elemento', () => {
  test('crear elemento lo muestra en el backlog', async ({ page, proyectoPropio }) => {
    await page.goto(proyectoPropio.url);
    await page.getByRole('button', { name: /crear elemento/i }).click();
    // ...
    await expect(page.getByRole('link', { name: 'Mi elemento' })).toBeVisible();
  });
});

test.describe('MIR-7 · Permisos como VIEWER', () => {
  test.use({ storageState: usuarios.grace.storage });
  // ...
});
```

- **Sesión:** por defecto cada test entra como **ada**. Para otro usuario,
  usa `test.use({ storageState: usuarios.alan.storage })`, y para un
  navegador sin sesión, `test.use({ storageState: sinSesion })`.
- **`proyectoPropio`:** crea por API un proyecto nuevo (clave `E` + 7
  caracteres aleatorios) cuyo OWNER es el usuario de la sesión. Devuelve
  `{ id, key, name, url }`, y `url` es su backlog. No agrega miembros: si los
  necesitas, llama a `POST /api/projects/:id/members` en la spec. Con
  `BASE_URL` definida lanza un error: nunca se crean datos en un ambiente
  que no se resetea, como la demo.
- **El puerto 4173 tiene que estar libre.** La web de E2E nunca reutiliza un
  servidor que ya esté corriendo: un `npm run preview` manual le habla a la
  API de desarrollo, y los tests escribirían en `mira_dev`. Ciérralo antes de
  correr la suite. La API de E2E (:3100) sí se reutiliza, porque es solo de
  E2E.
- **El proyecto `MIR` del seed es de solo lectura.** Todo test que crea,
  edita o borra datos usa `proyectoPropio`.

## Convenciones

1. **Selectores**, en orden: `getByRole` / `getByLabel`, después `getByText` y
   al final `getByTestId`. Nada de CSS ni XPath.
2. **`data-testid`** en kebab-case y en español (`tarjeta-elemento`), solo
   cuando no hay rol ni nombre accesible.
3. **Esperas:** solo `expect` con reintento (`toBeVisible`, `toHaveURL`…).
   Prohibido `page.waitForTimeout`.
4. **Paralelismo:** `fullyParallel: true`. Ningún test depende de otro ni del
   orden en que corren.
5. **Timeouts por defecto** (30 s el test y 5 s el `expect`) y `retries: 0`.
   No se suben para tapar un problema: un test intermitente es un Bug en
   `MIR-74`.
6. **Nombres en español.** Un `describe` por historia con su clave:
   `test.describe('MIR-11 · Crear elemento', …)`.
7. **Importar `test` y `expect` desde `../fixtures`**, nunca desde
   `@playwright/test`.
8. **Móvil por etiquetas:** `{ tag: '@movil' }` corre en desktop y móvil, y
   `{ tag: ['@movil', '@solo-movil'] }` corre solo en móvil.
9. **Antes de pedir revisión,** la spec nueva pasa tres veces seguidas en
   local.

## Reportes y evidencia

| Qué | Dónde |
| --- | --- |
| Reporte HTML | `e2e/playwright-report/` |
| JUnit | `e2e/reportes/junit-e2e.xml` |
| Traces, screenshots y videos (solo de los tests que fallan) | `e2e/test-results/` |

Para ver el trace de un fallo, ábrelo desde el reporte HTML o con
`npx -w @mira/e2e playwright show-trace test-results/<test>/trace.zip` (la
ruta es relativa a `e2e/`).

## En CI

El job **`E2E`** de `.github/workflows/ci.yml` corre esta suite en cada PR y
push a `main` y `develop`, después de `Build`, y es check obligatorio de
`main`. Si un test falla, el PR no se puede fusionar y `#mira-ci` avisa. Los
detalles están en [`docs/ci-cd.md`](../docs/ci-cd.md#pruebas-e2e).

En la ejecución, sección _Artifacts_:

| Artefacto | Qué trae |
| --- | --- |
| `reporte-e2e` | El reporte HTML: descomprímelo y abre `index.html`, o usa `npx -w @mira/e2e playwright show-report <carpeta>` |
| `reporte-junit-e2e` | `junit-e2e.xml` |
| `evidencia-fallos-e2e` | Solo si algo falló: una carpeta por test con `trace.zip`, screenshot y video |

Para abrir un trace de CI:
`npx -w @mira/e2e playwright show-trace <carpeta-descargada>/<test>/trace.zip`,
o arrastra el `trace.zip` a [trace.playwright.dev](https://trace.playwright.dev).

Un E2E que pasa en local y falla en CI suele deberse a la diferencia de
entorno: en CI la web se compila sin `VITE_API_URL`, corren 2 workers y no se
reutiliza ningún servidor. Para reproducirlo (bash; cierra antes lo que use
:3100 y :4173):

```bash
VITE_API_URL= npm run build     # vacía pisa un VITE_API_URL de algún .env
CI=true npm run test:e2e
```

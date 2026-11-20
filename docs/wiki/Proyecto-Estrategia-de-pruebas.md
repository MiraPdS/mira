# Proyecto - Estrategia de pruebas

**Herramientas declaradas del equipo:** Vitest + React Testing Library
(unitario, integración y componente) y Playwright (E2E, desde la Entrega 3).

Por qué: el proyecto es TypeScript de punta a punta y Vitest corre el mismo
código en los tres workspaces, compartiendo configuración con Vite. React
Testing Library consulta por lo que el usuario percibe (rol, etiqueta, texto),
así que las pruebas de interfaz sobreviven a los refactors.

El detalle completo, con ejemplos reales del proyecto, está en
[`docs/estrategia-pruebas.md`](https://github.com/MiraPdS/mira/blob/develop/docs/estrategia-pruebas.md).

## Niveles de prueba

| Nivel | Qué prueba | Dobles | Necesita | Archivos |
| --- | --- | --- | --- | --- |
| **Unitario** | Reglas de negocio: `service` de cada módulo, permisos, esquemas | Repositorio mockeado (`vitest-mock-extended`) | nada | `*.test.ts` |
| **Integración** | Rutas HTTP completas: middlewares, validación, SQL real, cookies | ninguno | PostgreSQL en Docker (5443) | `*.integration.test.ts` |
| **Componente** | Páginas React con sus proveedores reales | MSW intercepta la red | nada | `*.test.tsx` |
| **E2E** _(Entrega 3)_ | Flujos completos de usuario en Chromium headless: web → API → PostgreSQL | ninguno | API, web y PostgreSQL (`mira_e2e`); los levanta Playwright | `e2e/specs/*.spec.ts` |

Muchas pruebas rápidas abajo, pocas y caras arriba. En Vitest son cuatro
proyectos: `shared`, `api-unit`, `api-integration` y `web`; los E2E son un
workspace aparte, `@mira/e2e`, con su propio runner.

### Unitario

El `service` recibe el repositorio por parámetro, así que se sustituye la
persistencia por un doble y se verifican solo las reglas. Ejemplo: el mensaje
de error es idéntico para "correo inexistente" y "contraseña incorrecta", para
no revelar qué correos están registrados.

La matriz rol × permiso de `can()` se prueba exhaustivamente con una tabla
(`packages/shared/src/permissions.test.ts`).

### Integración

Supertest le hace peticiones reales a la app Express contra el PostgreSQL de
pruebas. Verifica lo que ningún mock puede: códigos de estado, `Set-Cookie`
con `HttpOnly`, restricciones únicas y transacciones.

- **Aislamiento:** `resetDb()` trunca todas las tablas antes de cada test; cada
  prueba arma su mundo con factories, sin depender del orden.
- **Datos deterministas:** nada de `faker` en valores que se asierten.

### Componente

Las páginas se renderizan con `QueryClientProvider` y router reales. MSW
responde a nivel de red, con `onUnhandledRequest: 'error'`: un endpoint no
declarado hace fallar la prueba en vez de colgarla.

### E2E

Playwright
([D15](https://github.com/MiraPdS/mira/blob/develop/docs/decisiones-tecnicas.md#d15--playwright-como-herramienta-e2e))
abre un navegador real y recorre la aplicación como un usuario: no hay dobles.
Prueban lo que los otros niveles no ven juntos: que la web, la API, la cookie
de sesión y la base funcionen de punta a punta, en escritorio (1280×800) y en
móvil (375×812).

- **Pocos y por flujo:** uno o pocos tests por historia, sobre el camino
  principal y sus errores más visibles. Las reglas y los casos borde siguen en
  los niveles de abajo.
- **Datos:** el `globalSetup` resetea y siembra `mira_e2e` una vez por corrida.
  El proyecto `MIR` del seed es de solo lectura; lo que escribe usa el fixture
  `proyectoPropio`, un proyecto nuevo por test.
- **Sesión por rol:** el proyecto `setup` inicia sesión una vez con ada
  (OWNER), alan (MEMBER) y grace (VIEWER) y guarda las cookies
  (`storageState`).
- **Estables por diseño:** selectores por rol y etiqueta, solo esperas con
  `expect`, `retries: 0`, y cada chequeo negativo con su contraprueba. Un test
  intermitente se registra como Bug, no se reintenta.
- **Humo:** los tests `@humo`, de solo lectura, corren además contra la demo
  publicada después de cada despliegue.

El set completo, qué valida cada spec y los problemas encontrados están en
[Entrega 3](Entrega-3.md#3-set-de-pruebas); las convenciones, en
[`e2e/README.md`](https://github.com/MiraPdS/mira/blob/develop/e2e/README.md).

## Cómo se ejecutan

```bash
npm test                  # las cuatro suites, un reporte de cobertura combinado
npm run test:unit         # sin Docker: shared + api-unit + web
npm run test:integration  # requiere npm run db:up
npm run test:coverage     # genera coverage/ (HTML, lcov, json-summary)
npm run test:e2e          # E2E: levanta API y web, requiere npm run db:up
```

En CI ([`ci.yml`](https://github.com/MiraPdS/mira/blob/develop/.github/workflows/ci.yml))
cada PR corre formato, lint, tipos, las cuatro suites contra un PostgreSQL
efímero, el build y, desde la Entrega 3, el job `E2E`. Los tres son checks
obligatorios para fusionar a `main`. Después de cada despliegue a `main`, el
job `Humo E2E` corre los `@humo` contra la demo.

## Cobertura

Se mide con v8 (HTML + lcov + json-summary, artefacto de CI). En la Entrega 1
solo se reportaba; desde la Entrega 2 (MIR-55) el umbral es **bloqueante**: está
en [`vitest.config.ts`](https://github.com/MiraPdS/mira/blob/develop/vitest.config.ts)
y, si la cobertura baja, `npm run test:coverage` falla (código de salida 1). En
GitHub Actions eso deja el PR en rojo, verificado con un run real.

Línea base medida en el CI de `develop` al inicio de la entrega (commit
`35308c1`) y umbral vigente:

| Alcance | Línea base (sent. / ramas / func. / líneas) | Umbral |
| --- | --- | --- |
| Todo el código | 97,18 / 89,33 / 97,9 / 97,18 % | 95 / 87 / 95 / 95 % |
| Services de la API | 100 / ≥ 97,9 / 100 / 100 % | 98 / 95 / 98 / 98 % |
| Hooks de la web | 100 / ≥ 88,9 / 100 / 100 % | 98 / 85 / 98 / 98 % |

Cada umbral es la línea base redondeada hacia abajo menos unos 2 puntos: deja
margen para el código nuevo de la entrega, pero una caída real rompe el build.
Services y hooks llevan un umbral más alto porque concentran las reglas de
negocio, los permisos y la caché; el global evita que un módulo nuevo sin
pruebas pase inadvertido. El umbral se sube si la cobertura sube, y nunca se
baja para que pase un PR. Justificación completa en la
[estrategia de pruebas del repositorio](https://github.com/MiraPdS/mira/blob/develop/docs/estrategia-pruebas.md#4-cobertura).

La cobertura de cada entrega queda congelada en el repositorio, ver
[Evidencias](Proyecto-Evidencias.md).

## Qué se prueba y qué no

- **Se prueba:** reglas de negocio y casos borde, autorización, validación de
  entrada, contratos HTTP, persistencia y restricciones, estados de la interfaz
  (carga, vacío, error de validación, error del servidor).
- **No se prueba:** código de terceros, configuración declarativa sin lógica,
  estilos visuales.

## Defectos

Se registran en Jira con pasos de reproducción, resultado esperado, resultado
obtenido, severidad y evidencia. **Todo defecto corregido llega con una prueba
que falla antes del arreglo.**

## Evolución por entrega

| Entrega | Qué se suma |
| --- | --- |
| **1** | Unitario, integración y componente; cobertura reportada; CI en cada PR |
| **2** | GitHub Actions como CI/CD oficial; pruebas de los dos requerimientos nuevos; umbral de cobertura bloqueante (MIR-55); Discord |
| **3** | Cuarto nivel, E2E con Playwright: 35 tests en 10 specs que cubren 13 flujos de usuario ([lista](Entrega-3.md#3-set-de-pruebas)), headless en cada PR y push (`E2E`, check obligatorio de `main`) y humo contra la demo después de cada despliegue; reporte HTML, JUnit, traces, capturas y videos como artefactos |

Decisiones de las primeras entregas que facilitaron los E2E: sesión por cookie
`httpOnly` (se guarda con `storageState`), menú "Mover a…" además del arrastre,
y seed idempotente con datos fijos.

### Por qué los E2E no arrastran tarjetas

Los E2E del tablero (MIR-67, `e2e/specs/tablero.spec.ts`) mueven las tarjetas
con el menú "Mover a…" y dejan fuera, a propósito, el arrastre con dnd-kit
(MIR-20):

- **No es determinista.** dnd-kit activa el arrastre con sensores propios
  (ratón con 5 px de distancia mínima, tacto solo desde el asa y teclado) y
  decide la columna por colisión y auto-scroll. Simularlo en Playwright
  depende de coordenadas, del ancho de la ventana y de la velocidad del
  puntero: es la receta de un test intermitente.
- **No cubre nada más.** Soltar una tarjeta y elegir "Mover a…" usan la misma
  mutación (`useMoveWorkItem`) y el mismo endpoint
  (`PATCH /work-items/:id/status`), así que el E2E ya verifica el efecto que
  importa: la tarjeta cambia de columna, persiste al recargar y queda en el
  historial (MIR-22).
- **El arrastre ya tiene pruebas.** `KanbanBoard.dnd.test.tsx` cubre en el
  nivel de componente soltar en otra columna, cancelar, el teclado, los
  anuncios para lectores de pantalla y la reversión si la API falla.

Para ubicar columnas y tarjetas, el tablero expone `data-testid` estables:
`columna-tablero` (con `data-columna-id`) y `tarjeta-elemento` (con
`data-elemento-id`). Las specs prefieren igual el nombre accesible: la lista
"Tarjetas de …" de cada columna y la tarjeta como `article` con su título.

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->

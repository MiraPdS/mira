# Proyecto - Estrategia de pruebas

**Herramienta declarada del equipo:** Vitest + React Testing Library.

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
| **E2E** _(Entrega 3)_ | Flujos completos en navegador headless contra la URL desplegada | ninguno | ambiente desplegado | — |

Muchas pruebas rápidas abajo, pocas y caras arriba. En Vitest son cuatro
proyectos: `shared`, `api-unit`, `api-integration` y `web`.

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

## Cómo se ejecutan

```bash
npm test                  # las cuatro suites, un reporte de cobertura combinado
npm run test:unit         # sin Docker: shared + api-unit + web
npm run test:integration  # requiere npm run db:up
npm run test:coverage     # genera coverage/ (HTML, lcov, json-summary)
```

En CI ([`ci.yml`](https://github.com/MiraPdS/mira/blob/develop/.github/workflows/ci.yml))
cada PR corre formato, lint, tipos, las cuatro suites contra un PostgreSQL
efímero y el build. Es check obligatorio para fusionar a `main`.

## Cobertura

Se **reporta** desde la Entrega 1 (v8, HTML + lcov + json-summary, artefacto de
CI) pero **no rompe el build todavía**: un umbral sin línea base empuja a
escribir pruebas de relleno. El umbral bloqueante llega en la Entrega 2, sobre
`services` y `hooks`.

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
| **2** | Jenkins como CI/CD oficial; pruebas de los dos requerimientos nuevos; umbral de cobertura bloqueante; Slack |
| **3** | Al menos 10 E2E headless en el pipeline, con capturas y reportes como artefactos |

Decisiones que ya preparan la Entrega 3: sesión por cookie `httpOnly`, menú
"Mover a…" además del arrastre, y seed idempotente con datos fijos.

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->

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

Se mide con v8 (HTML + lcov + json-summary, artefacto de CI). En la Entrega 1
solo se reportaba; desde la Entrega 2 (MIR-55) el umbral es **bloqueante**: está
en [`vitest.config.ts`](https://github.com/MiraPdS/mira/blob/develop/vitest.config.ts)
y, si la cobertura baja, `npm run test:coverage` falla (código de salida 1). En
GitHub Actions eso deja el PR en rojo, verificado con un run real. En Jenkins
queda **pendiente**: el pipeline (MIR-51) aún no existe; cuando su Jenkinsfile
ejecute el mismo comando y propague el código de salida, fallará igual sin
configuración extra.

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
| **2** | Jenkins como CI/CD oficial; pruebas de los dos requerimientos nuevos; umbral de cobertura bloqueante (MIR-55); Slack |
| **3** | Al menos 10 E2E headless en el pipeline, con capturas y reportes como artefactos |

Decisiones que ya preparan la Entrega 3: sesión por cookie `httpOnly`, menú
"Mover a…" además del arrastre, y seed idempotente con datos fijos.

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->

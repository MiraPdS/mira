# Estrategia de pruebas

Base para la página _Proyecto - Estrategia de Pruebas_ de la Wiki.

**Herramienta declarada del equipo:** Vitest + React Testing Library.

## 1. Por qué esta herramienta

El proyecto es TypeScript de punta a punta. Vitest corre el mismo código en los
tres workspaces sin transpilación aparte, comparte configuración con Vite (lo
que elimina una fuente entera de divergencias entre cómo se compila la
aplicación y cómo se compilan sus pruebas) y trae cobertura, mocks y modo
interactivo integrados.

React Testing Library aporta la filosofía que hace que las pruebas de interfaz
sobrevivan a un refactor: se consulta por lo que el usuario percibe (rol,
etiqueta, texto), nunca por clases CSS ni estructura interna del componente.

## 2. Los tres niveles

| Nivel | Qué prueba | Dobles | Dependencias | Dónde vive |
| --- | --- | --- | --- | --- |
| **Unitario** | Reglas de negocio puras: permisos, validación, `service` de cada módulo | Repositorio mockeado con `vitest-mock-extended` | ninguna | `*.test.ts` junto al código |
| **Integración** | Rutas HTTP completas: middlewares, validación, Prisma y SQL real | ninguno | Docker (PostgreSQL 5443) | `*.integration.test.ts` |
| **Componente** | Páginas React con sus proveedores reales | MSW intercepta la red | ninguna | `*.test.tsx` |

La forma es intencional: muchas pruebas rápidas en la base, menos y más lentas
arriba. En la Entrega 3 se suma un cuarto nivel (E2E sobre navegador), que será
el más escaso y el más caro.

### 2.1 Unitario — el `service` sin base de datos

El `service` recibe el repositorio por parámetro y lanza errores de dominio
(`ConflictError`, `UnauthorizedError`, …) sin conocer Express ni Prisma. Por eso
se puede sustituir la persistencia por un doble y verificar solo las reglas.

Ejemplo real del proyecto (`auth.service.test.ts`): que el hash nunca se filtre
en la respuesta, que un correo duplicado produzca conflicto sin llegar a
escribir, y que el mensaje de error sea idéntico para "correo inexistente" y
"contraseña incorrecta" — porque si difirieran, cualquiera podría averiguar qué
correos están registrados probando el formulario.

### 2.2 Integración — Supertest contra PostgreSQL real

Supertest importa la aplicación Express (sin abrir un puerto) y le hace
peticiones reales contra el PostgreSQL de pruebas. Aquí se verifica lo que
ningún mock puede: códigos de estado, la cabecera `Set-Cookie` con `HttpOnly`,
la restricción única de correo en la base y que los datos queden persistidos.

**Aislamiento.** Un helper `resetDb()` ejecuta
`TRUNCATE … RESTART IDENTITY CASCADE` sobre todas las tablas **antes de cada
test**. Cada prueba construye el mundo que necesita con las factories de
`src/test/factories.ts`, así que ninguna depende del orden de ejecución. Los
archivos corren en serie y en un solo proceso, porque comparten la base.

**Datos.** Las factories producen valores deterministas con overrides
explícitos. Regla del equipo: **nada de `faker` en valores que se asierten**. Un
fallo que no se reproduce se termina catalogando como intermitente y se ignora,
y una suite ignorada es peor que no tener suite.

### 2.3 Componente — RTL con MSW

Las páginas se renderizan completas, dentro de los proveedores reales
(`QueryClientProvider` y router). MSW intercepta a nivel de red, de modo que el
componente, `react-hook-form`, TanStack Query y el cliente HTTP se ejecutan de
verdad: lo único falso es la respuesta del servidor.

Consecuencia práctica: renombrar una función interna no rompe ninguna prueba,
pero romper la asociación `<label for>` sí — y debe romperla, porque un
formulario que la prueba no encuentra tampoco lo encuentra un lector de
pantalla.

MSW corre con `onUnhandledRequest: 'error'`: si un componente llama a un
endpoint que nadie declaró, la prueba falla en vez de quedarse esperando una
respuesta que nunca llega.

## 3. Cómo se ejecutan

```bash
npm test                  # las tres suites, un reporte de cobertura combinado
npm run test:unit         # sin Docker: shared + api-unit + web
npm run test:integration  # solo integración (requiere npm run db:up)
npm run test:coverage     # genera coverage/ en HTML y lcov
npm run test:watch        # modo interactivo durante el desarrollo
```

La configuración raíz agrupa los cuatro proyectos con `test.projects`, de modo
que una sola corrida produce un único reporte de cobertura — que es la evidencia
que pide la rúbrica — mientras cada integrante puede correr solo su paquete
mientras programa.

## 4. Cobertura

La cobertura se **reporta** desde la Entrega 1 (`v8`, en HTML y lcov, subida
como artefacto del pipeline) pero **no rompe el build todavía**.

Es deliberado: un umbral alto impuesto antes de tener línea base empuja a
escribir pruebas de relleno que suben el porcentaje sin verificar nada. El
umbral bloqueante se activa en la Entrega 2, cuando exista un número real que
defender, y se aplicará sobre `services` y `hooks`, no sobre el proyecto
completo.

## 5. Qué se prueba y qué no

**Se prueba.** Reglas de negocio y sus casos borde; autorización (la matriz
rol × acción, exhaustiva); validación de entrada; contratos HTTP (estado, forma
del error, cookies); persistencia y restricciones de la base; estados de la
interfaz: carga, vacío, error de validación, error del servidor y red caída.

**No se prueba.** Código de terceros (Prisma, Express, React); configuración
declarativa sin lógica; estilos visuales — el CSS se verifica mirando, y en la
Entrega 3 con capturas de los E2E.

## 6. Evolución por entrega

| Entrega | Qué se suma |
| --- | --- |
| **1** | Los tres niveles descritos aquí; cobertura reportada; verificación en cada PR con GitHub Actions |
| **2** | Jenkins como CI/CD oficial; pruebas de los dos requerimientos nuevos; umbral de cobertura bloqueante; notificaciones a Slack |
| **3** | Al menos 10 pruebas E2E sobre navegador en modo headless, integradas al pipeline, con capturas y reportes como artefactos |

## 7. Preparado para la Entrega 3

Tres decisiones tomadas ahora existen para que los E2E no sean una pelea:

1. **Sesión por cookie httpOnly** — la prueba hace login por la interfaz y el
   navegador arrastra la cookie sola; no hay tokens que administrar.
2. **Menú "Mover a…" además del arrastre** — cambiar el estado de una tarjeta
   tiene un camino determinista, en vez de depender de simular un arrastre.
3. **Seed idempotente con usuarios y datos fijos** — `npm run db:seed` deja un
   estado inicial conocido, que es la base de cualquier suite E2E estable.

## 8. Defectos

Los defectos se registran en Jira (y se espejan como issue de GitHub cuando son
de repositorio) con: pasos de reproducción, resultado esperado, resultado
obtenido, severidad y evidencia.

Regla: **todo defecto corregido llega con una prueba que falla antes del
arreglo.** Es lo que garantiza que no reaparezca, y deja evidencia verificable
de la corrección.

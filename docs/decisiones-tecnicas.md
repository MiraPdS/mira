# Decisiones técnicas

Registro de las decisiones tomadas antes de escribir código, con su
justificación y las alternativas descartadas. Sirve de base para la página
_Proyecto - Arquitectura y Tecnologías_ de la Wiki.

Formato: qué se decidió, por qué, qué se descartó y qué consecuencia tiene.

---

## D1 — Monorepo con npm workspaces

**Decisión.** Un repositorio con `apps/web`, `apps/api` y `packages/shared`,
enlazados con npm workspaces. En la Entrega 3 se suma `apps/e2e`.

**Por qué.** Una historia de usuario casi siempre toca frontend y backend a la
vez: con un solo repositorio, eso es una rama, un Pull Request y un item de
Jira, que es justamente la trazabilidad que exige la rúbrica. Además permite
compartir el contrato de la API sin publicar paquetes.

**Descartado.** Dos repositorios separados (duplica GitFlow, duplica el pipeline
y parte en dos los PR que cruzan capas). Carpetas independientes sin workspaces
(duplica dependencias y obliga a copiar los tipos a mano).

**Consecuencia.** Los scripts de la raíz son el punto de entrada del proyecto y
hay que mantenerlos ordenados.

---

## D2 — Supabase como PostgreSQL gestionado, con Prisma como ORM

**Decisión.** Supabase aporta el PostgreSQL del ambiente desplegado. Express se
conecta por cadena de conexión y usa Prisma para esquema, migraciones y tipos.
No se usa `supabase-js` ni Row Level Security: la autorización vive en Express.

**Por qué.** Mantiene el backend Node + Express como pieza real del sistema (que
es el stack declarado) y deja la base de datos como un PostgreSQL estándar, lo
que permite levantar uno idéntico en Docker para CI sin tocar la nube.

**Descartado.** BaaS completo con React hablando directo a Supabase y RLS: el
más rápido, pero deja al backend sin superficie que probar, que es lo que evalúa
el ramo. `supabase-js` en el servidor: ata el backend al SDK de un proveedor y
contradice el principio de autonomía del enunciado.

**Consecuencia.** Supabase entrega dos cadenas de conexión y confundirlas es el
error clásico: `DATABASE_URL` apunta al pooler (puerto 6543, con
`?pgbouncer=true&connection_limit=1`) y `DIRECT_URL` a la conexión directa
(puerto 5432), porque `prisma migrate` no funciona a través del pooler.

---

## D3 — JWT en cookie httpOnly

**Decisión.** El login emite un JWT firmado que viaja en una cookie
`httpOnly`, `SameSite` y `Secure` en producción. Contraseñas con bcrypt.

**Por qué.** JavaScript no puede leer la cookie, así que un XSS no puede robar
el token. Y para los E2E de la Entrega 3 es decisivo: el navegador adjunta la
cookie solo, de modo que las pruebas solo tienen que hacer login por la interfaz
y no gestionar cabeceras.

**Descartado.** Token en `localStorage` (vulnerable a XSS y obliga a escribir un
interceptor). Sesiones en servidor con store en Postgres (estado adicional y una
tabla más que limpiar entre pruebas).

**Consecuencia.** CORS debe configurarse con `credentials: true` y un origen
exacto: el comodín `*` es inválido cuando se envían credenciales.

---

## D4 — Pirámide de pruebas de dos niveles en el backend

**Decisión.** Pruebas unitarias de los `service` con el repositorio mockeado
(`vitest-mock-extended`) y pruebas de integración de las rutas con Supertest
contra un PostgreSQL efímero en Docker.

**Por qué.** Los unitarios cubren reglas y casos borde en milisegundos; los de
integración cubren lo que ningún mock puede: SQL real, restricciones únicas,
transacciones, códigos de estado y cookies.

**Descartado.** Solo mocks (no prueba el SQL: los problemas aparecerían recién
en los E2E de la Entrega 3). Solo integración (lento y difícil forzar casos de
error). Testcontainers (más lento de arrancar y exige Docker igual).

**Consecuencia.** El agente de Jenkins de la Entrega 2 **necesita Docker** o un
servicio PostgreSQL disponible. Queda registrado como dependencia desde ahora.

---

## D5 — Esquemas Zod compartidos como contrato de la API

**Decisión.** `packages/shared` exporta los esquemas Zod de cada petición y
respuesta, más los tipos inferidos con `z.infer`. Express valida en runtime con
el mismo esquema que el formulario de React usa vía `zodResolver`.

**Por qué.** Una sola fuente de verdad. Cambiar un campo rompe la compilación en
los dos lados de inmediato, en vez de producir un fallo silencioso.

**Descartado.** Solo tipos TypeScript compartidos (tipo y validador pueden
divergir en silencio). Contrato OpenAPI con tipos generados: mejor documentación
y Swagger navegable, pero es un paso de generación adicional; se puede sumar más
adelante generando el spec desde los mismos esquemas Zod.

---

## D6 — Docker local para desarrollo y pruebas; Supabase para lo desplegado

**Decisión.** `docker-compose` levanta dos PostgreSQL: `mira_dev` (5442) y
`mira_test` (5443, en memoria). Supabase es el ambiente desplegado.

**Por qué.** Con tres personas compartiendo una sola base en la nube, un
`prisma migrate reset` borra el trabajo del resto y las migraciones se pisan
entre sí. Con bases locales cada integrante trabaja aislado y sin conexión.

**Consecuencia.** Docker Desktop es requisito el primer día.

---

## D7 — Roles por proyecto y una función `can()` pura

**Decisión.** El rol vive en `ProjectMember` (no en `User`): OWNER, MEMBER o
VIEWER. Toda la autorización pasa por `can(role, permission)` en
`packages/shared`, usada por el middleware de Express y por el frontend para
ocultar acciones.

**Por qué.** La misma persona puede ser OWNER de un proyecto y VIEWER de otro,
que es como funciona cualquier gestor real. Al ser una función pura sin base de
datos ni HTTP, se cubre exhaustivamente con un test de tabla, y esa matriz rol ×
acción es evidencia directa para la Wiki.

**Descartado.** Solo OWNER/MEMBER (sin rol de lectura no hay historia de
permisos que contar). RBAC configurable en base de datos (sobre-ingeniería para
un MVP de tres personas).

---

## D8 — Estados del tablero como enum fijo

**Decisión.** `BACKLOG · TODO · IN_PROGRESS · IN_REVIEW · DONE`, declarados como
enum de Prisma y como `const` en `packages/shared`.

**Por qué.** Tipado de punta a punta: el frontend no puede inventar un estado y
la validación es gratis vía Zod.

**Descartado.** Columnas configurables por proyecto (`BoardColumn`): más fiel a
Kanban, pero se come tiempo del flujo central en la Entrega 1. Queda **reservado
como requerimiento nuevo de la Entrega 2**, que exige justamente dos.

**Consecuencia.** La migración de enum a tabla ya se sabe que viene; el esquema
se diseñó para que sea aislada.

---

## D9 — Kanban con dnd-kit y un camino alternativo obligatorio

**Decisión.** Arrastrar y soltar con dnd-kit (sensores de puntero y teclado),
**más** un menú "Mover a…" en cada tarjeta que ejecuta exactamente la misma
mutación.

**Por qué.** El drag & drop nativo de HTML5 es notoriamente difícil de
automatizar de forma estable con Selenium, y la Entrega 3 exige automatizar
"mover elementos entre estados". El menú no es un parche: es requisito de
accesibilidad y es el camino determinista que usan las pruebas de RTL y los E2E.

---

## D10 — Historial escrito explícitamente dentro de una transacción

**Decisión.** El `service` ejecuta `prisma.$transaction([cambio, ActivityLog])`.

**Por qué.** O se registran ambos, o ninguno: nunca un cambio sin rastro. Al ser
explícito, el mensaje es semántico ("movió de TODO a IN_PROGRESS") en vez de
técnico, y el actor sale del usuario autenticado sin artificios.

**Descartado.** Extensión de Prisma que registra toda escritura (el actor hay
que propagarlo con `AsyncLocalStorage` y los mensajes quedan genéricos).
Triggers de PostgreSQL (saca la lógica de TypeScript y deja de ser verificable
con Vitest, que es lo contrario de lo que evalúa el ramo).

---

## D11 — GitHub Actions en la Entrega 1, Jenkins en la Entrega 2

**Decisión.** Un workflow de Actions corre formato, lint, tipos, las tres suites
y el build en cada Pull Request, y es el check requerido por la protección de
`main`.

**Por qué.** La rúbrica exige `main` protegida desde la Entrega 1, y una rama
protegida sin verificación automática es una barrera de papel. Actions es
gratuito y no requiere infraestructura, mientras que montar Jenkins compite
directamente con construir el MVP.

**Consecuencia.** En la Entrega 2 hay que evitar que el `Jenkinsfile` y el
workflow se contradigan: Jenkins pasa a ser el CI/CD oficial con build y
despliegue, y Actions queda como verificación rápida de PR.

---

## D12 — Despliegue en Vercel, Render/Fly y Supabase

**Decisión.** Frontend en Vercel, API en Render o Fly.io, base de datos en
Supabase.

**Por qué.** Todo en capa gratuita, con HTTPS y dominio automáticos, sin una
máquina virtual que mantener ni apagar los fines de semana (el propio enunciado
advierte que una VM cuesta 30-40 USD al mes). La URL desplegada es además la
`BASE_URL` contra la que corren los E2E de la Entrega 3.

**Descartado.** VM en GCP/Azure/AWS con Docker Compose: es lo que sugiere el
enunciado y da buen material para explicar infraestructura, pero consume
créditos y exige Nginx, certificados y mantención.

**Consecuencia.** Hay que documentar el arranque en frío de la capa gratuita de
Render, porque afecta la primera petición de una demostración.

---

## Decisiones pendientes

| Tema | Cuándo se decide |
| --- | --- |
| Dónde corre Jenkins (nube o local con ngrok) | Entrega 2 |
| Los dos requerimientos nuevos de la Entrega 2 | candidatos: Sprints (D8) y columnas configurables |
| Herramienta E2E: Selenium o Playwright | Entrega 3 |
| Activar umbral de cobertura que rompa el build | Entrega 2, con línea base real |

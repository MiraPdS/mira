# Como contribuir a Mira

Documento corto y operativo. Si algo aqui contradice lo acordado por el equipo,
gana el equipo, pero actualicen este archivo en el mismo PR.

## 1. Preparar el entorno

```bash
git clone <url-del-repo>
cd mira
cp .env.example .env        # completar JWT_SECRET
npm install                 # instala los tres workspaces
npm run db:up               # Postgres de desarrollo (5442) y de pruebas (5443)
npm run db:migrate -w @mira/api
npm run db:seed             # datos de demostracion
npm run dev                 # api en :3000, web en :5173
```

Requisitos: Node 20.11 o superior, Docker Desktop y npm 10 o superior.

## 2. Flujo de trabajo (GitFlow)

Ramas permanentes:

- `main`: version estable y entregable. Protegida. Nunca se hace push directo.
- `develop`: integracion del trabajo del equipo.

Ramas de trabajo, siempre desde `develop`:

```
<tipo>/MIR-<n>-<descripcion-en-kebab-case>
```

Tipos: `feature`, `fix`, `test`, `ci`, `docs`, `refactor`, `chore`.

```bash
git switch develop && git pull
git switch -c feature/MIR-12-crear-proyecto
```

Una rama persigue **un** item de Jira. Si la rama empieza a resolver dos cosas,
conviene dividirla.

## 3. Commits

Formato obligatorio, verificado por un hook de `commit-msg`:

```
<tipo>(<scope>): MIR-<n> <descripcion en minuscula>
```

Ejemplos validos:

```
feat(work-items): MIR-12 crear historia de usuario
fix(auth): MIR-18 rechazar token expirado
test(projects): MIR-25 cubrir permisos de VIEWER
ci: MIR-31 agregar servicio de postgres al workflow
```

El ID de Jira no es burocracia: es lo que permite recorrer la cadena
`historia -> item de Jira -> rama -> commit -> PR -> pipeline -> release`, que
es exactamente lo que se evalua.

## 4. Pull Requests

- Van siempre contra `develop` (salvo los PR de release, que van a `main`).
- Usar la plantilla: que cambia, como se probo, que item resuelve.
- Requieren al menos **una** revision de otro integrante y el check de CI en verde.
- Quien revisa mira la logica y las pruebas, no el estilo: de eso se encarga
  Prettier.

## 5. Pruebas

| Nivel | Donde vive | Que prueba | Comando |
| --- | --- | --- | --- |
| Unitario | `*.test.ts` junto al codigo | Reglas de negocio con dobles | `npm run test:unit` |
| Integracion | `*.integration.test.ts` | Rutas via Supertest contra Postgres real | `npm run test:integration` |
| Componente | `*.test.tsx` | React con RTL y MSW | `npm test -w @mira/web` |

Todo junto con cobertura: `npm run test:coverage`.

Reglas del equipo:

1. **Nada de datos aleatorios en lo que se asierta.** Un fallo que no se
   reproduce se termina ignorando. Usar las factories de `src/test/factories.ts`.
2. **Los tests de frontend consultan por rol o por etiqueta**
   (`getByRole`, `getByLabelText`), nunca por clase CSS.
3. **El frontend no mockea sus propios modulos**: MSW intercepta la red, de
   modo que el componente real se ejecuta de verdad.
4. **Toda funcionalidad nueva llega con pruebas en su PR**, no en uno posterior.

## 6. Donde va cada cosa

```
apps/api/src/modules/<feature>/    router -> controller -> service -> repository
apps/web/src/features/<feature>/   paginas, hooks y llamadas de ese dominio
packages/shared/src/               esquemas Zod, tipos y permisos compartidos
```

El `service` no sabe de HTTP ni de Prisma: recibe el repositorio por parametro.
Eso es lo que permite testearlo sin base de datos, y no es negociable.

## 7. Que no se commitea

Archivos `.env` reales, credenciales, tokens, capturas con datos personales y
carpetas `dist/`, `coverage/` o `node_modules/`.

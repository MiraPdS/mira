# Plan — MIR-73 · Actions con Node 24

**Rama:** `ci/MIR-73-actions-node24` (desde `develop`)
**PR:** uno solo, base `develop`
**Estimación:** 1 pt · **Prioridad:** Low · **Responsable:** Benjamín
**Alcance:** las líneas `uses:` de `.github/workflows/ci.yml` y
`.github/workflows/wiki.yml`, y la anotación del pendiente en
`docs/wiki/Entrega-2.md`. El agente no toca secretos, Render, Vercel ni la
protección de ramas, y no renombra jobs: `Lint, tipos y pruebas`, `Build` y
`E2E` son checks obligatorios. La verificación de los jobs que corren solo en
`main` ocurre en el release MIR-76.

Fuente: [`docs/backlog.md` §MIR-73](../backlog.md),
[`jira-import.csv`](../jira-import.csv) y
[`wiki/Entrega-2.md`](../wiki/Entrega-2.md) ("Mejoras que quedan
pendientes"). Pendiente desde la Entrega 2.

## Criterios de aceptación (Jira)

| # | Criterio | Verificación en el PR | Verificación posterior |
| --- | --- | --- | --- |
| 1 | `checkout`, `setup-node`, `upload-artifact` y las demás acciones en versiones con Node 24 | `grep -n "uses:" .github/workflows/*.yml` muestra solo `@v7` | — |
| 2 | Pipeline verde y sin advertencias de deprecación | Los checks del PR en verde, y cero anotaciones en sus jobs (D3) | Lo mismo en el push a `develop` tras el merge, y en `Desplegar` y `Humo E2E` del release MIR-76 |
| 3 | Pendiente de la Entrega 2 cerrado en la Wiki | `Entrega-2.md` anota la viñeta como resuelta, con el enlace al PR (D4) | La Wiki publicada muestra la anotación tras el merge |

## Lo que ya existe

- **Acciones en uso:** solo tres, todas de `actions/` y todas en `@v4`:
  - `ci.yml`: `checkout` y `setup-node` en `calidad`, `build`, `e2e` y
    `humo`; `upload-artifact` en `calidad` (2), `e2e` (3) y `humo` (2).
    `deploy` y `notify` no usan acciones.
  - `wiki.yml`: `checkout` y `setup-node` en los dos jobs; `upload-artifact`
    en la vista previa.
- **Advertencia de hoy:** el run 44676923221 (push a `develop`, MIR-72) y el
  run 44675822248 de la Wiki tienen esta anotación en `Lint, tipos y pruebas`,
  `Build`, `E2E`, `Verificar Wiki` y `Vista previa de la Wiki`:
  `Node.js 20 is deprecated. The following actions target Node.js 20 but are
  being forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4,
  actions/upload-artifact@v4.`
- **Versiones con Node 24** (comprobado leyendo `runs.using` en el
  `action.yml` de cada tag mayor, el 2026-11-20):

  | Acción | node20 | node24 | Última |
  | --- | --- | --- | --- |
  | `actions/checkout` | v4 | v5, v6, v7 | v7.0.1 |
  | `actions/setup-node` | v4 | v5, v6, v7 | v7.1.0 |
  | `actions/upload-artifact` | v4, v5 | v6, v7 | v7.0.2 |

- **Cambios incompatibles revisados** (notas de versión de cada mayor). Ninguno
  afecta al proyecto:
  - Todos piden un runner ≥ 2.327.1. `ubuntu-latest` ya lo cumple.
  - `checkout` v6 guarda las credenciales en un archivo aparte. `wiki.yml`
    clona y empuja la Wiki con su propio `x-access-token`, sin usar las
    credenciales de `checkout`. v7 bloquea el checkout de forks en
    `pull_request_target` y `workflow_run`, que no se usan. Además migra a ESM.
  - `setup-node` v5 activa la caché automática si existe `packageManager`, y
    v6 la limita a npm. El repo no declara `packageManager`, y los cuatro jobs
    ya piden `cache: npm` de forma explícita. v7 quita el `NODE_AUTH_TOKEN`
    falso y migra a ESM. No se publica en npm.
  - `upload-artifact` v6 cambia el runtime. v7 agrega `archive` (por defecto
    `true`, que comprime como hoy) y migra a ESM. Los nombres de artefacto,
    `if-no-files-found`, `retention-days` y las exclusiones con `!` se
    mantienen.

## Decisiones (grill del 2026-11-20)

### D1 — Las tres acciones a `@v7`, con tag mayor

`actions/checkout@v7`, `actions/setup-node@v7` y `actions/upload-artifact@v7`.
Se mantiene la convención de tag mayor, sin fijar por SHA. Se descartan las
mínimas con Node 24 (v5, v5 y v6), porque quedarían dos mayores atrás.

### D2 — `NODE_VERSION` sigue en `'20'`

Es el Node con que se compila y prueba MIRA, no el que corre las acciones. El
criterio habla solo de las acciones, y la advertencia desaparece igual.
Cambiar el runtime implica alinear Render, Vercel y `engines`: sería otro ítem.

### D3 — Evidencia con anotaciones, antes y después

En la descripción del PR va una tabla por job: la advertencia del run
44676923221 (y del 44675822248 para la Wiki) contra cero anotaciones en el run
del PR. También va el comando para reproducirlo:

```bash
gh api repos/MiraPdS/mira/actions/runs/<run>/jobs \
  --jq '.jobs[]|[.name,.check_run_url]|@tsv' |
while IFS=$'\t' read -r n u; do
  echo "## $n"; gh api "$u/annotations" --jq '.[]|"\(.annotation_level): \(.message)"'
done
```

Se repite en el push a `develop` tras el merge. `Desplegar`, `Humo E2E` y
`Avisar en Discord` corren solo en `main`: `Humo E2E` se revisa en el release
MIR-76 y el resultado se enlaza aquí.

### D4 — Wiki: anotar, no borrar

En `docs/wiki/Entrega-2.md`, la viñeta se mantiene y se agrega
`**Resuelto en la Entrega 3** ([MIR-73](https://github.com/MiraPdS/mira/pull/N)).`,
igual que con MIR-71. El enlace se agrega en un commit después de abrir el PR.

## Pasos

1. Rama `ci/MIR-73-actions-node24` desde `origin/develop`, sin upstream hacia
   `develop` (ya creada).
2. `ci.yml` y `wiki.yml`: `@v4` → `@v7` en las 20 líneas `uses:` (D1). No se
   toca nada más.
3. Verificar en local: `grep` sin restos de `@v4`, YAML válido y
   `npm run format:check`.
4. Commit `ci: MIR-73 subir checkout, setup-node y upload-artifact a v7`.
5. **Cuando el usuario lo pida:** push y PR a `develop`. Después, un commit
   `docs: MIR-73 ...` con la anotación de D4 y el número del PR.
6. Cuando el CI del PR termine: los checks en verde y la tabla de anotaciones
   (D3) en la descripción del PR.
7. Revisión cruzada (IsaiasACF) y merge. Repetir D3 en el push a `develop`.
8. **Benjamín, en el release MIR-76:** comprobar que `Humo E2E` tampoco tiene
   anotaciones y enlazar el run aquí.

## Fuera de alcance

- Subir el runtime del proyecto a Node 24 (D2).
- Fijar acciones por SHA o configurar Dependabot para actions.
- Cambios en los nombres de jobs, secretos, Render, Vercel o protección de
  ramas.

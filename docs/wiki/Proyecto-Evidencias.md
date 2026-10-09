# Proyecto - Evidencias

Toda afirmación importante de la Wiki debe poder verificarse. Aquí se reúnen
las evidencias, **priorizando enlaces y artefactos reproducibles por sobre
capturas**: una captura muestra un estado puntual; un PR, un run de CI o una
URL viva se pueden revisar.

## Cómo se produce la evidencia

| Evidencia | Dónde vive | Dura |
| --- | --- | --- |
| Pull Requests revisados | [PRs del repositorio](https://github.com/MiraPdS/mira/pulls?q=is%3Apr+is%3Amerged) | permanente |
| Historias con criterios de aceptación | [Jira](https://bolgunn.atlassian.net/jira/software/projects/MIR/boards) y [backlog](https://github.com/MiraPdS/mira/blob/develop/docs/backlog.md) | permanente |
| Trazabilidad historia → PR → pruebas | [Requisitos y trazabilidad](Proyecto-Requisitos-y-trazabilidad.md) | permanente |
| Runs de CI (formato, lint, tipos, pruebas, build) | [GitHub Actions](https://github.com/MiraPdS/mira/actions/workflows/ci.yml) | logs: 90 días |
| Reporte de cobertura HTML | artefacto `cobertura` de cada run | 90 días |
| **Cobertura y resultados de pruebas por entrega** | página `Evidencias-Entrega-N`, congelada desde el run de CI del commit del release | **permanente** |
| Ambiente desplegado | [mira-pds.vercel.app](https://mira-pds.vercel.app) · [`/api/health`](https://mira-pds.vercel.app/api/health) | mientras exista la demo |
| Release y tag de cada entrega | [Releases](https://github.com/MiraPdS/mira/releases) | permanente |

Los artefactos de GitHub Actions expiran. Por eso la cobertura y los resultados
de cada entrega se **congelan** en el repositorio con
`npm run wiki:evidencias -- entrega-N`: el script toma el run de CI verde del
commit actual, descarga su artefacto y escribe las tablas. Así la evidencia
dice "esto lo produjo CI, sobre este commit", y no "funcionaba en mi máquina".

## Protección de `main`

`main` exige Pull Request, una aprobación, conversaciones resueltas y los checks
`Lint, tipos y pruebas` y `Build` en verde; no admite push forzado ni borrado.

Se puede verificar en cualquier momento con la API de GitHub (salida del
2026-10-09, al preparar el release):

```bash
gh api repos/MiraPdS/mira/branches/main/protection
```

```json
{
  "required_status_checks": { "strict": false, "contexts": ["Lint, tipos y pruebas", "Build"] },
  "required_approving_review_count": 1,
  "dismiss_stale_reviews": true,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "enforce_admins": false
}
```

`enforce_admins: false`: un administrador del repositorio podría saltarse la
regla. El equipo no lo hace; todo lo que llegó a `main` entró por el PR de
release.

## Entrega 1

- **Pruebas y cobertura:** [Evidencias de la Entrega 1](Evidencias-Entrega-1.md)
  — 788 pruebas, todas pasan; 97,0 % de líneas. Congeladas desde el
  [run de CI 37905529077](https://github.com/MiraPdS/mira/actions/runs/37905529077) del commit `8fa2c93`.
- **Release y tag:** [`v1.0-entrega1`](https://github.com/MiraPdS/mira/releases/tag/v1.0-entrega1).
- **Trazabilidad, PRs representativos, uso de IA y defectos:** en
  [Entrega 1](Entrega-1.md#evidencia).

## Ambiente desplegado

- Health check con verificación de base:
  [`/api/health`](https://mira-pds.vercel.app/api/health) →
  `{"status":"ok","db":"ok"}`.
- Pruebas que lo cubren: `health.integration.test.ts` (base arriba → 200, base
  caída → 503).
- Cómo se montó: [`docs/despliegue.md`](https://github.com/MiraPdS/mira/blob/develop/docs/despliegue.md);
  PR [#24](https://github.com/MiraPdS/mira/pull/24).

<!-- Generado desde docs/wiki/ en MiraPdS/mira. No editar aquí: se sobrescribe en el próximo sync. -->

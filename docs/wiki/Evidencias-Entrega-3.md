# Evidencias - Entrega 3

Resultados de pruebas y cobertura **congelados** desde la integración continua.
No se editan a mano: se regeneran con `npm run wiki:evidencias -- entrega-3`.

| | |
| --- | --- |
| Commit | [`4c612d4`](https://github.com/MiraPdS/mira/commit/4c612d4e93627bdf53eb9d6cfe241c5521808d4b) |
| Run de CI | [44683341339](https://github.com/MiraPdS/mira/actions/runs/44683341339) (pull_request, `docs/MIR-76-release`) |
| Fecha de la corrida | 2026-11-20 |
| Resultado | ✅ todas las pruebas pasan |

## Pruebas por proyecto

Proyectos de Vitest: `shared` y `api-unit` son unitarias, `api-integration`
corre contra PostgreSQL real y `web` son pruebas de componente con React
Testing Library. Ver [Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

| Proyecto | Archivos | Pasan | Fallan | Omitidas |
| --- | --- | --- | --- | --- |
| `shared` | 10 | 224 | 0 | 0 |
| `api-unit` | 11 | 254 | 0 | 0 |
| `api-integration` | 17 | 348 | 0 | 0 |
| `web` | 34 | 396 | 0 | 0 |
| **Total** | **72** | **1222** | **0** | **0** |

## Cobertura por paquete

Cobertura v8 de todo el código fuente (sin pruebas, tipos ni puntos de entrada).
En la Entrega 3 este run aplicó los umbrales bloqueantes de MIR-55; ver [Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

| Paquete | Líneas | Sentencias | Funciones | Ramas |
| --- | --- | --- | --- | --- |
| `apps/api` | 97.1 % | 97.1 % | 100.0 % | 90.7 % |
| `apps/web` | 97.1 % | 97.1 % | 95.2 % | 90.2 % |
| `packages/shared` | 100.0 % | 100.0 % | 100.0 % | 100.0 % |
| **Total** | **97.3 %** | **97.3 %** | **97.1 %** | **90.5 %** |

El reporte HTML completo es el artefacto `cobertura` del run (expira a los 90 días).

## Pruebas E2E

Playwright contra el stack que el job `E2E` levanta en el runner: `setup`
inicia sesión con los usuarios del seed, `chromium` corre las specs en
escritorio y `mobile` las etiquetadas `@movil` a 375 px. En el total, cada
archivo cuenta una vez aunque corra en dos proyectos. Ver
[Entrega 3](Entrega-3.md#3-set-de-pruebas).

| Proyecto | Archivos | Pasan | Fallan | Omitidas |
| --- | --- | --- | --- | --- |
| `setup` | 1 | 3 | 0 | 0 |
| `chromium` | 9 | 32 | 0 | 0 |
| `mobile` | 2 | 3 | 0 | 0 |
| **Total** | **11** | **38** | **0** | **0** |

Duración de la corrida: 23,5 s, en paralelo y sin contar la compilación
ni la instalación de Chromium. El reporte HTML es el artefacto `reporte-e2e`
del run y el JUnit, `reporte-junit-e2e` (expiran a los 90 días).

<!-- Generado por scripts/wiki-evidencias.mjs. No editar a mano. -->

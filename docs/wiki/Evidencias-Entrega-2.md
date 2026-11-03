# Evidencias - Entrega 2

Resultados de pruebas y cobertura **congelados** desde la integración continua.
No se editan a mano: se regeneran con `npm run wiki:evidencias -- entrega-2`.

| | |
| --- | --- |
| Commit | [`fa5f0c7`](https://github.com/MiraPdS/mira/commit/fa5f0c77e72aa6ab43577803915aca05f4354526) |
| Run de CI | [41553706231](https://github.com/MiraPdS/mira/actions/runs/41553706231) (push, `develop`) |
| Fecha de la corrida (UTC) | 2026-11-03 |
| Resultado | ✅ todas las pruebas pasan |

## Pruebas por proyecto

Proyectos de Vitest: `shared` y `api-unit` son unitarias, `api-integration`
corre contra PostgreSQL real y `web` son pruebas de componente con React
Testing Library. Ver [Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

| Proyecto | Archivos | Pasan | Fallan | Omitidas |
| --- | --- | --- | --- | --- |
| `shared` | 10 | 224 | 0 | 0 |
| `api-unit` | 11 | 254 | 0 | 0 |
| `api-integration` | 17 | 342 | 0 | 0 |
| `web` | 34 | 395 | 0 | 0 |
| **Total** | **72** | **1215** | **0** | **0** |

## Cobertura por paquete

Cobertura v8 de todo el código fuente (sin pruebas, tipos ni puntos de entrada).
En la Entrega 2 este run aplicó los umbrales bloqueantes de MIR-55; ver [Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

| Paquete | Líneas | Sentencias | Funciones | Ramas |
| --- | --- | --- | --- | --- |
| `apps/api` | 97.1 % | 97.1 % | 100.0 % | 90.7 % |
| `apps/web` | 97.1 % | 97.1 % | 95.2 % | 90.2 % |
| `packages/shared` | 100.0 % | 100.0 % | 100.0 % | 100.0 % |
| **Total** | **97.2 %** | **97.2 %** | **97.1 %** | **90.5 %** |

El reporte HTML completo es el artefacto `cobertura` del run (expira a los 90 días).

<!-- Generado por scripts/wiki-evidencias.mjs. No editar a mano. -->

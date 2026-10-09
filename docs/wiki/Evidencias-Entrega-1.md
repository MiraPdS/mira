# Evidencias - Entrega 1

Resultados de pruebas y cobertura **congelados** desde la integración continua.
No se editan a mano: se regeneran con `npm run wiki:evidencias -- entrega-1`.

| | |
| --- | --- |
| Commit | [`1c94e87`](https://github.com/MiraPdS/mira/commit/1c94e87e671b97db77cdf876051d349c8d0dc6ff) |
| Run de CI | [37910246418](https://github.com/MiraPdS/mira/actions/runs/37910246418) (pull_request, `feature/MIR-30-navegacion-creacion-elementos`) |
| Fecha de la corrida | 2026-10-09 |
| Resultado | ✅ todas las pruebas pasan |

## Pruebas por proyecto

Proyectos de Vitest: `shared` y `api-unit` son unitarias, `api-integration`
corre contra PostgreSQL real y `web` son pruebas de componente con React
Testing Library. Ver [Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

| Proyecto | Archivos | Pasan | Fallan | Omitidas |
| --- | --- | --- | --- | --- |
| `shared` | 5 | 107 | 0 | 0 |
| `api-unit` | 5 | 155 | 0 | 0 |
| `api-integration` | 10 | 212 | 0 | 0 |
| `web` | 28 | 320 | 0 | 0 |
| **Total** | **48** | **794** | **0** | **0** |

## Cobertura por paquete

Cobertura v8 de todo el código fuente (sin pruebas, tipos ni puntos de entrada).
En la Entrega 1 se reporta sin umbral bloqueante.

| Paquete | Líneas | Sentencias | Funciones | Ramas |
| --- | --- | --- | --- | --- |
| `apps/api` | 95.7 % | 95.7 % | 100.0 % | 87.6 % |
| `apps/web` | 97.5 % | 97.5 % | 96.4 % | 90.0 % |
| `packages/shared` | 100.0 % | 100.0 % | 100.0 % | 100.0 % |
| **Total** | **97.0 %** | **97.0 %** | **97.8 %** | **89.3 %** |

El reporte HTML completo es el artefacto `cobertura` del run (expira a los 90 días).

<!-- Generado por scripts/wiki-evidencias.mjs. No editar a mano. -->

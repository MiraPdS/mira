# Evidencias - Entrega 1

Resultados de pruebas y cobertura **congelados** desde la integración continua.
No se editan a mano: se regeneran con `npm run wiki:evidencias -- entrega-1`.

| | |
| --- | --- |
| Commit | [`8fa2c93`](https://github.com/MiraPdS/mira/commit/8fa2c937b5966e781fd831bd0d91f93d4150cb68) |
| Run de CI | [37905529077](https://github.com/MiraPdS/mira/actions/runs/37905529077) (push, `develop`) |
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
| `web` | 27 | 314 | 0 | 0 |
| **Total** | **47** | **788** | **0** | **0** |

## Cobertura por paquete

Cobertura v8 de todo el código fuente (sin pruebas, tipos ni puntos de entrada).
En la Entrega 1 se reporta sin umbral bloqueante.

| Paquete | Líneas | Sentencias | Funciones | Ramas |
| --- | --- | --- | --- | --- |
| `apps/api` | 95.7 % | 95.7 % | 100.0 % | 87.6 % |
| `apps/web` | 97.5 % | 97.5 % | 96.4 % | 89.9 % |
| `packages/shared` | 100.0 % | 100.0 % | 100.0 % | 100.0 % |
| **Total** | **97.0 %** | **97.0 %** | **97.8 %** | **89.2 %** |

El reporte HTML completo es el artefacto `cobertura` del run (expira a los 90 días).

<!-- Generado por scripts/wiki-evidencias.mjs. No editar a mano. -->

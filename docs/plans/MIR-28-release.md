# MIR-28 · Release `v1.0-entrega1` — plan

Decisiones de la sesión de preguntas (2026-10-09).

## Alcance

Entrega 1 completa: MIR-17 (#27) y MIR-22 (#29) ya están en `develop`.

## Flujo

1. Rama `docs/MIR-28-release` desde `develop`: completar todas las secciones ⏳
   (salvo Entrega 2 y 3), trazabilidad con estado final, plantilla de PR.
2. Push → CI verde sobre el commit X.
3. `npm run wiki:evidencias -- entrega-1` sobre X → commit Y (solo docs).
4. PR a `develop`, aprobado por el equipo, merge → se publica la Wiki.
5. PR de release `develop` → `main`, merge **con merge commit** (no squash).
6. Benjamín apunta el Blueprint de Render a `main`; esperar deploy de Render y
   Vercel del merge commit.
7. Verificar producción: `/api/health` 200 + `db: ok`, login `ada@mira.dev`,
   asignar responsable (MIR-17) y ver historial (MIR-22).
8. Recién entonces: tag anotado `v1.0-entrega1` sobre el merge commit de `main`
   y GitHub Release. Si el deploy falla: `hotfix/` a `main` y se etiqueta ese.

La evidencia describe X; el tag difiere solo en documentación (se dice en el
Release).

## Contenido

- **Sin capturas.** Evidencia por enlaces (Jira, PRs, run de CI, release, tag)
  y salida de `gh api .../branches/main/protection` como bloque de código. Se
  quita el pedido de "PR bloqueado por un check en rojo": no existe ninguno.
- **Uso de IA:** solo lo declarado en los PRs, agrupado en declarado / solo pie
  de página / sin declaración (la plantilla permitía omitir la sección). La
  plantilla de PR pasa a exigir la sección (o `Ninguna`).
- **Defectos:** no hay bugs en Jira ni issues; se listan los ~9 defectos reales
  de los commits `fix:` (no las rondas de revisión), con la aclaración de que
  se corrigieron dentro del PR de cada historia.
- **Aprobaciones:** las hace el equipo; no se piden revisores.

## GitHub Release

- Tag anotado, título `v1.0-entrega1 — Entrega 1`, no pre-release, latest.
- Secciones: Funcionalidades (por épica), Defectos corregidos, Pruebas
  ejecutadas (totales de `Evidencias-Entrega-1.md` + run de CI), Despliegue,
  Limitaciones conocidas, enlaces a Wiki y Uso de IA.
- Limitaciones: plan free de Render (arranque en frío ~1 min, pinger cada
  10 min); credenciales de demo públicas y datos compartidos; MIR-29 (video)
  queda fuera del tag.

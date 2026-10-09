# Plan — MIR-26 · Wiki del proyecto

**Rama:** `docs/MIR-26-wiki` (desde `origin/develop`)
**Estimacion:** 5 pts · **Prioridad:** High
**Alcance:** contenido de la Wiki versionado en `docs/wiki/`, workflow que lo
sincroniza a la Wiki de GitHub, script de evidencias por entrega y ajustes de
CI, plantilla de PR y documentacion. Crear la primera pagina de la Wiki en la
UI y verificar la Wiki real lo hace una persona.

## Criterios de aceptacion

Originales (se reescriben, ver decision 2):

1. ~~Home + Resumen, Tecnologias y Stack, Arquitectura, Estrategia de Pruebas,
   Supuestos y Dependencias, Evidencias~~ -> **Home como indice + las paginas
   de `entregas.md` §4.7** (tabla de la decision 2).
2. La pagina `Entrega 1` tiene H1 exactamente `Entrega 1`.
3. El contenido base esta en `docs/` del repositorio (`docs/wiki/` es la fuente).

Definicion de terminado (lo que cierra MIR-26; ver decision 7 para lo que
queda a MIR-28):

- [ ] `docs/wiki/` con los 11 archivos, enlaces relativos con `.md`, sin `[[...]]`.
- [ ] Completas, sin ⏳: Resumen y alcance, Arquitectura y tecnologias,
      Estrategia de pruebas, Supuestos y dependencias.
- [ ] Con estructura completa y secciones ⏳ explicitas: Entrega 1 (plantilla
      del Anexo C + "Uso de IA"), Evidencias, Requisitos y trazabilidad (tabla
      de historias ya llena, columna de pruebas por completar).
- [ ] Entrega 2 y Entrega 3 como placeholder.
- [ ] `wiki.yml`: job `verificar` verde en el PR y dry-run con artefacto
      `wiki-preview` + diff en el resumen del job.
- [ ] `scripts/wiki-evidencias.mjs` probado contra un run real de CI de
      `develop` (salida descartada; la de verdad se congela en MIR-28).
- [ ] `ci.yml`: reporter JSON de Vitest y `retention-days: 90`.
- [ ] PR template con las lineas de trazabilidad y de uso de IA.
- [ ] `CONTRIBUTING.md` (la Wiki se edita solo por PR), README (enlace a la
      Wiki en lugar de `_(pendiente)_`), `.gitignore` (`docs/.obsidian/`).
- [ ] MIR-26 reescrito en `backlog.md`, `jira-import.csv` y Jira; MIR-28 suma
      "Entrega 1 y Evidencias sin ⏳ + correr `wiki:evidencias`".
- [ ] Al menos un integrante ademas del autor revisa los supuestos (decision 10).
- [ ] Tras el merge a `develop`: el run de `sincronizar` hace push, y en la
      Wiki real Home -> cada pagina navega, el sidebar aparece, las imagenes
      cargan y `Entrega 1` tiene su H1.

Fuera de alcance: contenido final de Entrega 1 y Evidencias (MIR-28), video
(MIR-29), GitHub Pages, umbrales de cobertura (E2).

## Lo que ya existe y se reutiliza

- `docs/decisiones-tecnicas.md` (D1–D13): base de "Arquitectura y tecnologias".
- `docs/estrategia-pruebas.md` (8 secciones): base de "Estrategia de pruebas".
- `docs/despliegue.md`, D12/D13: dependencias externas del ambiente demo.
- `docs/backlog.md` + `jira-import.csv`: historias con Dado/Cuando/Entonces
  para la trazabilidad; MIR-30..33 reservados para E2 (supuestos de alcance).
- `requirements/tema2.md`, README: resumen, mision, alcance, stack, equipo.
- `vitest.config.ts` ya emite `json-summary` en `coverage/`.
- `ci.yml` ya sube el artefacto `cobertura` (hoy con `retention-days: 14`).
- Wiki habilitada en el repo (publico), pero vacia: `mira.wiki.git` no existe
  hasta que se crea la primera pagina en la UI.

## Decisiones

1. **`docs/wiki/` es la fuente de verdad; un GitHub Action la sincroniza.**
   Todo cambio a la Wiki pasa por PR revisado (§4.4) y queda como evidencia
   (§4.9). Editar directo en la Wiki o con un script manual se descarto
   (deriva, sin revision).
2. **Lista de paginas de `entregas.md` §4.7.** Nombres de archivo sin tildes
   (URLs limpias); los H1 si llevan tildes.

   | Archivo en `docs/wiki/` | Contenido | Fuente |
   | --- | --- | --- |
   | `Home.md` | Solo indice (Anexo C) | nuevo |
   | `_Sidebar.md` | Navegacion persistente | nuevo |
   | `Proyecto-Resumen-y-alcance.md` | Objetivo, alcance, usuarios, problema | `tema2.md`, README |
   | `Proyecto-Requisitos-y-trazabilidad.md` | Historia -> criterios -> PR -> pruebas | `backlog.md` |
   | `Proyecto-Arquitectura-y-tecnologias.md` | Diagrama, stack, relacion con pruebas, herramientas de IA | `decisiones-tecnicas.md`, README |
   | `Proyecto-Estrategia-de-pruebas.md` | Niveles, ejecucion, cobertura, evolucion E1–E3 | `estrategia-pruebas.md` |
   | `Proyecto-Supuestos-y-dependencias.md` | `S-xx`, `D-EXT-xx` (decision 10) | nuevo |
   | `Proyecto-Evidencias.md` | PRs, CI, cobertura, despliegue, release | nuevo |
   | `Entrega-1.md` | H1 `# Entrega 1`, plantilla Anexo C + "Uso de IA" | nuevo |
   | `Entrega-2.md`, `Entrega-3.md` | Placeholder | nuevo |

3. **Disparador: push a `develop` + `workflow_dispatch`.** La Wiki sigue el
   trabajo en curso; el tag `v1.0-entrega1` es la foto congelada y la pagina
   Entrega 1 lo enlaza. Push a `main` se descarto (Wiki congelada entre
   entregas). Ojo: `workflow_dispatch` solo existe cuando el workflow llega
   a `main` (MIR-28); antes, solo el push a `develop`.
   Workflow propio `wiki.yml` (no en `ci.yml`), `paths: docs/wiki/**` y el
   propio workflow, `GITHUB_TOKEN` con `contents: write`, sin secretos nuevos.
4. **Espejo exacto.** `rsync --delete` excluyendo `.git`: borrar o renombrar
   en el repo borra en la Wiki, sin huerfanas en "Pages".
   - Imagenes en `docs/wiki/images/`, referenciadas como `images/x.png`.
   - Commit en la Wiki: `sync: <sha corto> <asunto del commit de origen>`.
   - Cada pagina cierra con `<!-- Generado desde docs/wiki/ en MiraPdS/mira. No
     editar aqui: se sobrescribe en el proximo sync. -->` (al final y no al
     inicio, para que `Entrega-N.md` abra con su H1), y la regla va en
     `CONTRIBUTING.md`.
5. **Enlaces: Markdown estandar con `.md` en la fuente.**
   `[Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md)` funciona en
   Obsidian, en la vista del repo y en el diff del PR. El sync quita `.md`
   solo de enlaces relativos (sin `://`). `[[...]]` prohibido: la sintaxis de
   alias de Obsidian (`[[pagina|texto]]`) es la inversa de la de GitHub Wiki.
   Desactivar "Use [[Wikilinks]]" en Obsidian (configuracion local, no versionada).
6. **Paginas = resumen autosuficiente + enlaces a `docs/`.** Nada se copia:
   cada D-n es una linea con enlace a su ancla en `decisiones-tecnicas.md`.
   Los enlaces de la Wiki a `docs/` son absolutos y apuntan a `develop`
   (`https://github.com/MiraPdS/mira/blob/develop/docs/...`), porque uno
   relativo se rompe al sincronizar. Los `docs/*.md` siguen donde estan; el
   README no cambia sus enlaces.
7. **MIR-26 entrega la estructura; el contenido de hito se completa despues.**
   Secciones pendientes marcadas `> ⏳ Se completa en MIR-28.` (o el item que
   corresponda).
   - MIR-28 agrega a su checklist: Entrega 1 y Evidencias sin ⏳, correr
     `wiki:evidencias`, enlazar release/tag.
   - Cada historia agrega su fila de trazabilidad en su propio PR: linea nueva
     en el PR template.
8. **`wiki.yml` con dos jobs.**

   ```
   verificar      # pull_request y push que toquen docs/wiki/** o el workflow
     - falla si hay [[...]] en docs/wiki/
     - falla si un enlace relativo apunta a un .md o imagen inexistente
     - falla si Entrega-1.md no abre con exactamente "# Entrega 1"
     - SOLO en PRs con base main: falla si hay ⏳ en Home, Proyecto-*,
       Entrega-1.md  (Entrega-2/3 exentas; en E2 la exencion pasa a solo
       Entrega-3: comentario en el workflow indica la linea)
   sincronizar    # needs: verificar
     - clona mira.wiki.git (error claro si no existe: "crea la primera
       pagina en la UI de la Wiki")
     - rsync --delete docs/wiki/ -> wiki/, sed de enlaces .md
     - pull_request: DRY_RUN -> artefacto wiki-preview + git diff --stat
       en $GITHUB_STEP_SUMMARY, sin push
     - push a develop / workflow_dispatch: commit "sync: ..." y push
       (sin commit si no hay cambios)
   concurrency: wiki-sync, sin cancelar en curso (los push se serializan)
   ```

   Opcional (lo hace una persona): marcar `verificar` como check requerido en
   la proteccion de `main`.
9. **Uso de IA (§4.8): seccion "Uso de IA" en cada `Entrega-N.md`.**
   Herramientas y proposito general en un parrafo de "Arquitectura y
   tecnologias". El PR template suma una linea: herramienta, que se genero o
   modifico, como se valido. La seccion de cada entrega se arma leyendo esos
   PRs; en Entrega 1 queda ⏳ hasta MIR-28 (la cubre el gate).
10. **Supuestos `S-xx` y dependencias externas `D-EXT-xx`** (no `D-n`, que ya
    son decisiones tecnicas). Tablas con columna **"Riesgo si no se cumple /
    mitigacion"** y fuente verificable (Tema 2, D-n, `despliegue.md`). El
    agente redacta el borrador; el equipo lo valida en el PR (Isaias:
    elementos, Mauro: Kanban, Diego: permisos). Semilla del borrador:
    - Alcance: Sprints (MIR-30), columnas configurables (MIR-31) y
      organizaciones (MIR-32) diferidas a E2, aunque Tema 2 pide Sprints.
    - Producto: UI solo en espanol; sin verificacion de correo ni
      recuperacion de clave; roles por proyecto fijos (D7); estados fijos (D8).
    - Ambiente demo: capas gratuitas, arranque en frio de Render (~50 s,
      mitigado por pinger), pausa de Supabase por inactividad, datos del seed
      con credenciales publicas a proposito.
    - Externas: Vercel, Render, Supabase, UptimeRobot, GitHub Actions, Jira,
      librerias clave (Prisma, dnd-kit, shadcn/ui, Vitest).
11. **Evidencia de pruebas congelada por entrega en el repo.**
    `docs/wiki/Evidencias-Entrega-N.md` con tabla de cobertura, pruebas
    por proyecto, SHA y enlace al run. Los artefactos de Actions expiran; el
    dato versionado no. Ademas `retention-days: 90` en `ci.yml` (complemento).
    GitHub Pages se descarto (segundo despliegue, solo guarda la ultima).
12. **`scripts/wiki-evidencias.mjs` lee el run de CI del commit, no local.**
    `npm run wiki:evidencias -- entrega-1`:
    1. `gh run list --commit <HEAD> --workflow CI`: falla si no hay run o no
       esta verde.
    2. `gh run download` del artefacto `cobertura`.
    3. Escribe la tabla de cobertura (lineas, ramas, funciones, sentencias por
       paquete desde `coverage-summary.json`) y las pruebas por proyecto
       (shared, api-unit, api-integration, web) desde `test-results.json`.
    Node y no bash: el equipo trabaja en Windows. `ci.yml` suma
    `--reporter=default --reporter=json --outputFile.json=coverage/test-results.json`
    para que el JSON viaje en el mismo artefacto.
13. **Verificacion: dry-run en PR + verificacion real tras el merge.** Empujar
    a la Wiki real desde la rama del PR se descarto (publica sin revision).
    El dry-run queda util para siempre: cada PR que toca la Wiki muestra su diff.

## Ajustes durante la implementacion

- **Paginas planas.** GitHub Wiki resuelve paginas por nombre de archivo e
  ignora carpetas, asi que la evidencia va en `Evidencias-Entrega-N.md` en la
  raiz (no en `evidencias/entrega-N/`). `verificar` solo admite la subcarpeta
  `images/`.
- **Node en vez de rsync + sed.** `scripts/wiki.mjs` hace la verificacion y el
  espejo (`verificar`, `construir`); el workflow solo lo llama. Asi se corre
  igual en Windows (`npm run wiki:verificar`).
- **`pull_request` sin filtro de rutas** en `wiki.yml`: el gate de ⏳ debe
  correr en todo PR de release aunque no toque `docs/wiki/`. No instala
  dependencias, es barato.
- **Trazabilidad ya llena** con los PRs fusionados y las pruebas de cada item
  (sacadas del historial de commits de cada archivo de prueba); quedan ⏳
  MIR-17, MIR-22, MIR-28 y MIR-29.

## Pasos

1. Rama y base: `.gitignore` con `docs/.obsidian/`.
2. `docs/wiki/`: esqueleto de los 11 archivos con cabecera "no editar aqui",
   `_Sidebar.md` y Home segun el Anexo C (incluye enlaces a Jira, demo,
   README de instalacion y release/tag como ⏳).
3. Paginas completas: Resumen y alcance, Arquitectura y tecnologias (Mermaid
   del monorepo y de capas, tabla stack -> aporte a las pruebas, D1–D13 en
   una linea c/u, herramientas de IA), Estrategia de pruebas (resumen de las
   8 secciones con enlaces).
4. Supuestos y dependencias: borrador `S-xx` / `D-EXT-xx` con riesgo y fuente.
5. Paginas con ⏳: Requisitos y trazabilidad (MIR-1..29 con estado y
   criterios enlazados), Evidencias, Entrega 1 (plantilla Anexo C completa +
   "Uso de IA"), Entrega 2/3 placeholder.
6. `.github/workflows/wiki.yml` (decision 8).
7. `ci.yml`: reporter JSON y `retention-days: 90`. `scripts/wiki-evidencias.mjs`
   + script `wiki:evidencias` en `package.json`; probarlo contra un run verde
   de `develop` y descartar la salida.
8. PR template (lineas de trazabilidad y uso de IA), `CONTRIBUTING.md` (Wiki
   solo por PR, como regenerar evidencias), README (enlace a la Wiki).
9. `backlog.md` y `jira-import.csv`: MIR-26 reescrito; MIR-28 con el checklist
   nuevo.
10. Manual (persona): crear una pagina cualquiera en la UI de la Wiki ->
    abrir PR -> revisar `wiki-preview` -> revision de supuestos por un
    integrante -> merge a `develop` -> verificar la Wiki real -> actualizar
    MIR-26 y MIR-28 en Jira.

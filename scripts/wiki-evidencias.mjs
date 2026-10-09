// Congela la evidencia de pruebas de una entrega en la Wiki (MIR-26).
//
//   npm run wiki:evidencias -- entrega-1
//
// Busca el run de CI del commit actual, exige que este verde, descarga su
// artefacto `cobertura` y escribe docs/wiki/Evidencias-Entrega-1.md con la
// cobertura por paquete y las pruebas por proyecto. La evidencia sale de CI y
// no de la maquina de quien lo corre: dice "esto produjo CI sobre este commit".
//
// Los artefactos de Actions expiran; esta pagina queda versionada. Se corre en
// el PR de release (MIR-28), sobre el commit que se va a etiquetar.
//
// Requiere `gh` autenticado y el commit ya empujado con su run de CI terminado.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { FUENTE } from './wiki.mjs';

const REPO = 'MiraPdS/mira';
const WORKFLOW = 'ci.yml';
const ARTEFACTO = 'cobertura';

function fallar(mensaje) {
  console.error(`✗ ${mensaje}`);
  process.exit(1);
}

function ejecutar(comando, args) {
  return execFileSync(comando, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function main() {
  const entrega = process.argv[2];
  const numero = entrega?.match(/^entrega-(\d+)$/)?.[1];
  if (!numero) fallar('Uso: npm run wiki:evidencias -- entrega-<n>');

  const sha = ejecutar('git', ['rev-parse', 'HEAD']);
  if (ejecutar('git', ['status', '--porcelain', '--untracked-files=no']) !== '') {
    console.warn(
      '! Hay cambios sin commitear: la evidencia corresponde a HEAD, no a tu copia local.',
    );
  }

  let runs;
  try {
    runs = JSON.parse(
      ejecutar('gh', [
        'run',
        'list',
        '--repo',
        REPO,
        '--workflow',
        WORKFLOW,
        '--commit',
        sha,
        '--json',
        'databaseId,status,conclusion,url,event,headBranch',
        '--limit',
        '20',
      ]),
    );
  } catch (error) {
    fallar(`No se pudo consultar GitHub con gh (¿gh auth login?): ${error.message}`);
  }

  const terminados = runs.filter((r) => r.status === 'completed');
  if (runs.length === 0)
    fallar(`No hay runs de ${WORKFLOW} para ${sha.slice(0, 7)}. ¿Empujaste el commit?`);
  if (terminados.length === 0)
    fallar(`El run de CI de ${sha.slice(0, 7)} aun no termina. Reintenta cuando termine.`);
  const run = terminados.find((r) => r.conclusion === 'success');
  if (!run)
    fallar(`El CI de ${sha.slice(0, 7)} no esta verde: no se congela evidencia de un build roto.`);

  const temporal = mkdtempSync(join(tmpdir(), 'mira-evidencias-'));
  try {
    ejecutar('gh', [
      'run',
      'download',
      String(run.databaseId),
      '--repo',
      REPO,
      '--name',
      ARTEFACTO,
      '--dir',
      temporal,
    ]);
    const cobertura = JSON.parse(readFileSync(join(temporal, 'coverage-summary.json'), 'utf8'));
    let resultados;
    try {
      resultados = JSON.parse(readFileSync(join(temporal, 'test-results.json'), 'utf8'));
    } catch {
      fallar(
        'El artefacto no trae test-results.json: ese run es anterior al reporter JSON de ci.yml.',
      );
    }

    const pagina = renderizar({ numero, sha, run, cobertura, resultados });
    const destino = join(FUENTE, `Evidencias-Entrega-${numero}.md`);
    writeFileSync(destino, pagina);
    console.info(`✓ ${destino} (run ${run.url})`);
    console.info(`  Enlazala desde Entrega-${numero}.md y Proyecto-Evidencias.md, y commitea.`);
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------

/** apps/api, apps/web o packages/shared a partir de una ruta absoluta del runner. */
function paquete(ruta) {
  return ruta.replaceAll('\\', '/').match(/(apps\/[^/]+|packages\/[^/]+)\//)?.[1] ?? 'otro';
}

/** Mismo criterio que los proyectos de vitest.config.ts. */
function proyecto(ruta) {
  const r = ruta.replaceAll('\\', '/');
  if (r.includes('/packages/shared/')) return 'shared';
  if (r.includes('/apps/api/'))
    return r.includes('.integration.test.') ? 'api-integration' : 'api-unit';
  if (r.includes('/apps/web/')) return 'web';
  return 'otro';
}

const METRICAS = ['lines', 'statements', 'functions', 'branches'];

function porcentaje(cubierto, total) {
  return total === 0 ? '—' : `${((cubierto / total) * 100).toFixed(1)} %`;
}

function tablaCobertura(cobertura) {
  const grupos = new Map();
  for (const [ruta, datos] of Object.entries(cobertura)) {
    if (ruta === 'total') continue;
    const clave = paquete(ruta);
    const acumulado =
      grupos.get(clave) ?? Object.fromEntries(METRICAS.map((m) => [m, { covered: 0, total: 0 }]));
    for (const m of METRICAS) {
      acumulado[m].covered += datos[m].covered;
      acumulado[m].total += datos[m].total;
    }
    grupos.set(clave, acumulado);
  }
  const filas = [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([clave, d]) =>
        `| \`${clave}\` | ${METRICAS.map((m) => porcentaje(d[m].covered, d[m].total)).join(' | ')} |`,
    );
  const t = cobertura.total;
  filas.push(
    `| **Total** | ${METRICAS.map((m) => `**${porcentaje(t[m].covered, t[m].total)}**`).join(' | ')} |`,
  );
  return [
    '| Paquete | Líneas | Sentencias | Funciones | Ramas |',
    '| --- | --- | --- | --- | --- |',
    ...filas,
  ].join('\n');
}

function tablaPruebas(resultados) {
  const orden = ['shared', 'api-unit', 'api-integration', 'web', 'otro'];
  const grupos = new Map();
  for (const archivo of resultados.testResults) {
    const clave = proyecto(archivo.name);
    const g = grupos.get(clave) ?? { archivos: 0, passed: 0, failed: 0, skipped: 0 };
    g.archivos += 1;
    for (const prueba of archivo.assertionResults) {
      if (prueba.status === 'passed') g.passed += 1;
      else if (prueba.status === 'failed') g.failed += 1;
      else g.skipped += 1;
    }
    grupos.set(clave, g);
  }
  const filas = orden
    .filter((clave) => grupos.has(clave))
    .map((clave) => {
      const g = grupos.get(clave);
      return `| \`${clave}\` | ${g.archivos} | ${g.passed} | ${g.failed} | ${g.skipped} |`;
    });
  filas.push(
    `| **Total** | **${resultados.testResults.length}** | **${resultados.numPassedTests}** | ` +
      `**${resultados.numFailedTests}** | **${resultados.numPendingTests + resultados.numTodoTests}** |`,
  );
  return [
    '| Proyecto | Archivos | Pasan | Fallan | Omitidas |',
    '| --- | --- | --- | --- | --- |',
    ...filas,
  ].join('\n');
}

export function renderizar({ numero, sha, run, cobertura, resultados }) {
  const fecha = new Date(resultados.startTime).toISOString().slice(0, 10);
  return `# Evidencias - Entrega ${numero}

Resultados de pruebas y cobertura **congelados** desde la integración continua.
No se editan a mano: se regeneran con \`npm run wiki:evidencias -- entrega-${numero}\`.

| | |
| --- | --- |
| Commit | [\`${sha.slice(0, 7)}\`](https://github.com/${REPO}/commit/${sha}) |
| Run de CI | [${run.databaseId}](${run.url}) (${run.event}, \`${run.headBranch}\`) |
| Fecha de la corrida | ${fecha} |
| Resultado | ${resultados.success ? '✅ todas las pruebas pasan' : '❌ hay pruebas fallando'} |

## Pruebas por proyecto

Proyectos de Vitest: \`shared\` y \`api-unit\` son unitarias, \`api-integration\`
corre contra PostgreSQL real y \`web\` son pruebas de componente con React
Testing Library. Ver [Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

${tablaPruebas(resultados)}

## Cobertura por paquete

Cobertura v8 de todo el código fuente (sin pruebas, tipos ni puntos de entrada).
En la Entrega ${numero} se reporta sin umbral bloqueante.

${tablaCobertura(cobertura)}

El reporte HTML completo es el artefacto \`${ARTEFACTO}\` del run (expira a los 90 días).

<!-- Generado por scripts/wiki-evidencias.mjs. No editar a mano. -->
`;
}

const esPrincipal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) main();

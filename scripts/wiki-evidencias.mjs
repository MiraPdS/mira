// Congela la evidencia de pruebas de una entrega en la Wiki (MIR-26).
//
//   npm run wiki:evidencias -- entrega-1
//
// Busca el run de CI del commit actual, exige que este verde, descarga su
// artefacto `cobertura` y escribe docs/wiki/Evidencias-Entrega-1.md con la
// cobertura por paquete y las pruebas por proyecto. Desde la Entrega 3 exige
// `reporte-junit-e2e` (MIR-76); en las entregas 1 y 2 sigue siendo opcional.
// La evidencia sale de CI y
// no de la maquina de quien lo corre: dice "esto produjo CI sobre este commit".
//
// Los artefactos de Actions expiran; esta pagina queda versionada. Se corre en
// la preparacion del release, sobre el commit verde que se quiere documentar.
// La pagina identifica esa fuente; por si sola no acredita un tag ni un despliegue.
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
const ARTEFACTO_E2E = 'reporte-junit-e2e';

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

    const e2e = descargarE2E(run, join(temporal, 'e2e'), numero);

    const pagina = renderizar({ numero, sha, run, cobertura, resultados, e2e });
    const destino = join(FUENTE, `Evidencias-Entrega-${numero}.md`);
    writeFileSync(destino, pagina);
    console.info(`✓ ${destino} (run ${run.url})`);
    console.info(`  Enlazala desde Entrega-${numero}.md y Proyecto-Evidencias.md, y commitea.`);
  } catch (error) {
    // Los errores lanzados aqui (p. ej. falta el JUnit E2E) salen en una linea,
    // como los de `fallar`. No se usa `fallar`: su process.exit saltaria el
    // finally y dejaria la carpeta temporal.
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  } finally {
    rmSync(temporal, { recursive: true, force: true });
  }
}

/**
 * JUnit de Playwright del run. Solo las entregas 1 y 2, anteriores al job E2E,
 * permiten generar la pagina sin ese artefacto.
 */
function descargarE2E(run, directorio, numero) {
  try {
    ejecutar('gh', [
      'run',
      'download',
      String(run.databaseId),
      '--repo',
      REPO,
      '--name',
      ARTEFACTO_E2E,
      '--dir',
      directorio,
    ]);
  } catch (error) {
    if (Number(numero) >= 3) {
      throw new Error(
        `No se pudo descargar ${ARTEFACTO_E2E}, obligatorio desde la Entrega 3. No se sobrescribe la evidencia.`,
        { cause: error },
      );
    }
    console.warn(`! El run no trae ${ARTEFACTO_E2E}: la pagina sale sin pruebas E2E.`);
    return null;
  }
  return parsearJunit(readFileSync(join(directorio, 'junit-e2e.xml'), 'utf8'));
}

// ---------------------------------------------------------------------------

function atributos(etiqueta) {
  return Object.fromEntries(
    [...etiqueta.matchAll(/(\w+)="([^"]*)"/g)].map(([, clave, valor]) => [clave, valor]),
  );
}

/**
 * Lo minimo del JUnit de Playwright: los totales de <testsuites> y, por cada
 * <testsuite> (un archivo dentro de un proyecto), el proyecto (`hostname`) y
 * sus conteos.
 */
export function parsearJunit(xml) {
  const raiz = xml.match(/<testsuites\b[^>]*>/);
  if (!raiz) throw new Error('El JUnit E2E no tiene <testsuites>.');
  const total = atributos(raiz[0]);
  const suites = [...xml.matchAll(/<testsuite\b[^>]*>/g)].map(([etiqueta]) => {
    const a = atributos(etiqueta);
    return {
      archivo: a.name,
      proyecto: a.hostname || 'otro',
      tests: Number(a.tests),
      fallan: Number(a.failures) + Number(a.errors),
      omitidas: Number(a.skipped),
    };
  });
  return {
    tests: Number(total.tests),
    fallan: Number(total.failures) + Number(total.errors),
    omitidas: Number(total.skipped),
    segundos: Number(total.time),
    suites,
  };
}

/** Mismo orden que los proyectos de e2e/playwright.config.ts. */
const PROYECTOS_E2E = ['setup', 'chromium', 'mobile'];

function tablaE2E(e2e) {
  const grupos = new Map();
  for (const s of e2e.suites) {
    const g = grupos.get(s.proyecto) ?? { archivos: 0, pasan: 0, fallan: 0, omitidas: 0 };
    g.archivos += 1;
    g.pasan += s.tests - s.fallan - s.omitidas;
    g.fallan += s.fallan;
    g.omitidas += s.omitidas;
    grupos.set(s.proyecto, g);
  }
  const posicion = (clave) => {
    const i = PROYECTOS_E2E.indexOf(clave);
    return i === -1 ? PROYECTOS_E2E.length : i;
  };
  const filas = [...grupos.keys()]
    .sort((a, b) => posicion(a) - posicion(b) || a.localeCompare(b))
    .map((clave) => {
      const g = grupos.get(clave);
      return `| \`${clave}\` | ${g.archivos} | ${g.pasan} | ${g.fallan} | ${g.omitidas} |`;
    });
  const archivos = new Set(e2e.suites.map((s) => s.archivo)).size;
  filas.push(
    `| **Total** | **${archivos}** | **${e2e.tests - e2e.fallan - e2e.omitidas}** | ` +
      `**${e2e.fallan}** | **${e2e.omitidas}** |`,
  );
  return [
    '| Proyecto | Archivos | Pasan | Fallan | Omitidas |',
    '| --- | --- | --- | --- | --- |',
    ...filas,
  ].join('\n');
}

function seccionE2E(e2e) {
  if (!e2e) return '';
  const segundos = e2e.segundos.toFixed(1).replace('.', ',');
  return `
## Pruebas E2E

Playwright contra el stack que el job \`E2E\` levanta en el runner: \`setup\`
inicia sesión con los usuarios del seed, \`chromium\` corre las specs en
escritorio y \`mobile\` las etiquetadas \`@movil\` a 375 px. En el total, cada
archivo cuenta una vez aunque corra en dos proyectos. Ver
[Entrega 3](Entrega-3.md#3-set-de-pruebas).

${tablaE2E(e2e)}

Duración de la corrida: ${segundos} s, en paralelo y sin contar la compilación
ni la instalación de Chromium. El reporte HTML es el artefacto \`reporte-e2e\`
del run y el JUnit, \`${ARTEFACTO_E2E}\` (expiran a los 90 días).
`;
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

export function renderizar({ numero, sha, run, cobertura, resultados, e2e = null }) {
  const verde = resultados.success && (!e2e || e2e.fallan === 0);
  const fecha = new Date(resultados.startTime).toISOString().slice(0, 10);
  return `# Evidencias - Entrega ${numero}

Resultados de pruebas y cobertura **congelados** desde la integración continua.
No se editan a mano: se regeneran con \`npm run wiki:evidencias -- entrega-${numero}\`.

| | |
| --- | --- |
| Commit | [\`${sha.slice(0, 7)}\`](https://github.com/${REPO}/commit/${sha}) |
| Run de CI | [${run.databaseId}](${run.url}) (${run.event}, \`${run.headBranch}\`) |
| Fecha de la corrida${Number(numero) >= 2 ? ' (UTC)' : ''} | ${fecha} |
| Resultado | ${verde ? '✅ todas las pruebas pasan' : '❌ hay pruebas fallando'} |

## Pruebas por proyecto

Proyectos de Vitest: \`shared\` y \`api-unit\` son unitarias, \`api-integration\`
corre contra PostgreSQL real y \`web\` son pruebas de componente con React
Testing Library. Ver [Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).

${tablaPruebas(resultados)}

## Cobertura por paquete

Cobertura v8 de todo el código fuente (sin pruebas, tipos ni puntos de entrada).
${Number(numero) >= 2 ? `En la Entrega ${numero} este run aplicó los umbrales bloqueantes de MIR-55; ver [Estrategia de pruebas](Proyecto-Estrategia-de-pruebas.md).` : `En la Entrega ${numero} se reporta sin umbral bloqueante.`}

${tablaCobertura(cobertura)}

El reporte HTML completo es el artefacto \`${ARTEFACTO}\` del run (expira a los 90 días).
${seccionE2E(e2e)}
<!-- Generado por scripts/wiki-evidencias.mjs. No editar a mano. -->
`;
}

const esPrincipal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) main();

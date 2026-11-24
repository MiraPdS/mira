import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scripts = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidenciaAnterior = '# Evidencia ya publicada\n';

// Solo se simulan los comandos externos. El CLI real lee sus artefactos,
// renderiza la pagina y la escribe dentro de una copia temporal aislada.
const precarga = `
import childProcess from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import process from 'node:process';

childProcess.execFileSync = (comando, args) => {
  if (comando === 'git' && args[0] === 'rev-parse') return 'a'.repeat(40);
  if (comando === 'git' && args[0] === 'status') return '';
  if (comando === 'gh' && args[1] === 'list') {
    return JSON.stringify([{
      databaseId: 123, status: 'completed', conclusion: 'success',
      url: 'https://example.com/run/123', event: 'push', headBranch: 'develop',
    }]);
  }
  if (comando === 'gh' && args[1] === 'download') {
    const nombre = args[args.indexOf('--name') + 1];
    const destino = args[args.indexOf('--dir') + 1];
    if (nombre === 'reporte-junit-e2e' && process.env.MIRA_TEST_E2E === 'fallo') {
      throw new Error('Fallo simulado al descargar el JUnit E2E');
    }
    mkdirSync(destino, { recursive: true });
    const archivos = nombre === 'cobertura'
      ? ['coverage-summary.json', 'test-results.json'] : ['junit-e2e.xml'];
    for (const archivo of archivos) {
      copyFileSync(join(process.cwd(), 'artefactos', archivo), join(destino, archivo));
    }
    return '';
  }
  throw new Error('Comando externo inesperado: ' + comando + ' ' + args.join(' '));
};
syncBuiltinESMExports();
`;

function ejecutarCLI(t, numero, modoE2E) {
  const temporal = mkdtempSync(join(tmpdir(), 'mira-test-evidencias-'));
  t.after(() => {
    assert.equal(dirname(temporal), resolve(tmpdir()));
    rmSync(temporal, { recursive: true, force: true });
  });
  const carpetaScripts = join(temporal, 'scripts');
  const wiki = join(temporal, 'docs', 'wiki');
  const artefactos = join(temporal, 'artefactos');
  for (const carpeta of [carpetaScripts, wiki, artefactos]) {
    mkdirSync(carpeta, { recursive: true });
  }
  for (const archivo of ['wiki-evidencias.mjs', 'wiki.mjs']) {
    copyFileSync(join(scripts, archivo), join(carpetaScripts, archivo));
  }
  const metrica = { total: 1, covered: 1 };
  writeFileSync(
    join(artefactos, 'coverage-summary.json'),
    JSON.stringify({
      total: Object.fromEntries(
        ['lines', 'statements', 'functions', 'branches'].map((clave) => [clave, metrica]),
      ),
    }),
  );
  writeFileSync(
    join(artefactos, 'test-results.json'),
    JSON.stringify({
      success: true,
      startTime: Date.UTC(2026, 10, 20),
      numPassedTests: 1,
      numFailedTests: 0,
      numPendingTests: 0,
      numTodoTests: 0,
      testResults: [
        {
          name: '/repo/packages/shared/src/ejemplo.test.ts',
          assertionResults: [{ status: 'passed' }],
        },
      ],
    }),
  );
  writeFileSync(
    join(artefactos, 'junit-e2e.xml'),
    '<testsuites tests="1" failures="0" errors="0" skipped="0" time="1">' +
      '<testsuite name="ejemplo.spec.ts" hostname="chromium" tests="1" ' +
      'failures="0" errors="0" skipped="0"></testsuite></testsuites>',
  );
  const pagina = join(wiki, `Evidencias-Entrega-${numero}.md`);
  writeFileSync(pagina, evidenciaAnterior);
  const cargador = join(temporal, 'simular-comandos.mjs');
  writeFileSync(cargador, precarga);
  const resultado = spawnSync(
    process.execPath,
    [
      '--import',
      pathToFileURL(cargador).href,
      join(carpetaScripts, 'wiki-evidencias.mjs'),
      `entrega-${numero}`,
    ],
    {
      cwd: temporal,
      encoding: 'utf8',
      env: { ...process.env, MIRA_TEST_E2E: modoE2E },
    },
  );
  assert.ifError(resultado.error);
  return { ...resultado, pagina: readFileSync(pagina, 'utf8') };
}

for (const numero of [3, 4]) {
  test(`Entrega ${numero}: una descarga E2E fallida no sobrescribe la evidencia`, (t) => {
    const resultado = ejecutarCLI(t, numero, 'fallo');
    assert.notEqual(resultado.status, 0);
    assert.match(resultado.stderr, /reporte-junit-e2e/);
    assert.equal(resultado.pagina, evidenciaAnterior);
  });
}

for (const numero of [1, 2]) {
  test(`Entrega ${numero}: conserva la compatibilidad sin artefacto E2E`, (t) => {
    const resultado = ejecutarCLI(t, numero, 'fallo');
    assert.equal(resultado.status, 0, resultado.stderr);
    assert.match(resultado.pagina, /todas las pruebas pasan/);
    assert.doesNotMatch(resultado.pagina, /## Pruebas E2E/);
  });
}

test('Entrega 3: incluye el JUnit descargado en la evidencia', (t) => {
  const resultado = ejecutarCLI(t, 3, 'correcto');
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.match(resultado.pagina, /## Pruebas E2E/);
  assert.match(resultado.pagina, /\| `chromium` \| 1 \| 1 \| 0 \| 0 \|/);
  assert.match(resultado.pagina, /todas las pruebas pasan/);
});

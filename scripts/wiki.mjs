// Verifica y construye la Wiki a partir de docs/wiki/ (MIR-26).
//
// docs/wiki/ es la fuente de verdad; .github/workflows/wiki.yml la copia al
// repositorio de la Wiki de GitHub. Este script es lo que corre ese workflow,
// y se puede correr igual en local (Windows incluido):
//
//   node scripts/wiki.mjs verificar            reglas de forma de las paginas
//   node scripts/wiki.mjs verificar --release  ademas: nada pendiente (⏳)
//   node scripts/wiki.mjs construir <destino>  espejo exacto en <destino>
//
// Los enlaces entre paginas se escriben con `.md` para que funcionen en
// Obsidian y en la vista del repo; `construir` les quita la extension, que es
// como los resuelve GitHub Wiki.
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  mkdirSync,
  cpSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FUENTE = join(RAIZ, 'docs', 'wiki');

// Paginas que pueden seguir con ⏳ en un PR de release. En la Entrega 2 queda
// solo Entrega-3.md; en la Entrega 3, ninguna.
const PENDIENTES_PERMITIDOS_EN_RELEASE = new Set(['Entrega-2.md', 'Entrega-3.md']);

// Unica subcarpeta admitida: GitHub Wiki resuelve las paginas por nombre de
// archivo e ignora las carpetas, asi que una pagina en una subcarpeta no se
// puede enlazar de forma que funcione en el repo y en la Wiki a la vez.
const CARPETA_IMAGENES = 'images';

const ENLACE_EN_LINEA = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const ENLACE_REFERENCIA = /^\s*\[[^\]]+\]:\s*(\S+)/gm;

function listarArchivos(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(dir, entrada.name);
    return entrada.isDirectory() ? listarArchivos(ruta, base) : [relative(base, ruta)];
  });
}

/** Quita bloques de codigo cercados: su contenido no son enlaces ni wikilinks. */
function sinBloquesDeCodigo(texto) {
  return texto.replace(/^```[\s\S]*?^```/gm, '');
}

function esExterno(destino) {
  return /^[a-z][a-z0-9+.-]*:/i.test(destino) || destino.startsWith('#');
}

function destinosRelativos(texto) {
  const limpio = sinBloquesDeCodigo(texto);
  const destinos = [
    ...[...limpio.matchAll(ENLACE_EN_LINEA)].map((m) => m[1]),
    ...[...limpio.matchAll(ENLACE_REFERENCIA)].map((m) => m[1]),
  ];
  return destinos.filter((d) => !esExterno(d)).map((d) => decodeURI(d.split('#')[0]));
}

export function verificar({ release = false, fuente = FUENTE } = {}) {
  const errores = [];
  if (!existsSync(fuente)) return [`No existe ${fuente}`];

  const archivos = listarArchivos(fuente);
  for (const archivo of archivos) {
    const partes = archivo.split(sep);
    if (partes.length > 1 && partes[0] !== CARPETA_IMAGENES) {
      errores.push(
        `${archivo}: solo se admite la subcarpeta ${CARPETA_IMAGENES}/ (la Wiki ignora carpetas)`,
      );
    }
    if (partes[0] === CARPETA_IMAGENES && archivo.endsWith('.md')) {
      errores.push(`${archivo}: las paginas van en la raiz de docs/wiki/`);
    }
  }

  for (const pagina of archivos.filter((a) => a.endsWith('.md') && !a.includes(sep))) {
    const texto = readFileSync(join(fuente, pagina), 'utf8');
    const limpio = sinBloquesDeCodigo(texto);

    if (limpio.includes('[[')) {
      errores.push(`${pagina}: usa [[wikilinks]]; escribe [texto](Pagina.md)`);
    }

    for (const destino of destinosRelativos(texto)) {
      if (destino === '') continue;
      if (!existsSync(join(fuente, destino))) {
        errores.push(`${pagina}: enlace roto -> ${destino}`);
      }
    }

    const entrega = pagina.match(/^Entrega-(\d+)\.md$/);
    if (entrega) {
      const primeraLinea = texto.split(/\r?\n/, 1)[0];
      const esperado = `# Entrega ${entrega[1]}`;
      if (primeraLinea !== esperado) {
        errores.push(`${pagina}: la primera linea debe ser exactamente "${esperado}"`);
      }
    }

    if (release && !PENDIENTES_PERMITIDOS_EN_RELEASE.has(pagina) && texto.includes('⏳')) {
      errores.push(`${pagina}: tiene secciones pendientes (⏳) y este PR va a main`);
    }
  }

  if (!archivos.includes('Home.md')) errores.push('Falta Home.md');
  return errores;
}

/** `Pagina.md` y `Pagina.md#ancla` -> `Pagina` y `Pagina#ancla`, solo en enlaces relativos. */
export function reescribirEnlaces(texto) {
  const quitarMd = (destino) => (esExterno(destino) ? destino : destino.replace(/\.md(?=#|$)/, ''));
  return texto
    .replace(ENLACE_EN_LINEA, (completo, destino) => completo.replace(destino, quitarMd(destino)))
    .replace(ENLACE_REFERENCIA, (completo, destino) =>
      completo.replace(destino, quitarMd(destino)),
    );
}

/** Espejo exacto de docs/wiki/ en `destino`, conservando solo su `.git`. */
export function construir(destino, fuente = FUENTE) {
  mkdirSync(destino, { recursive: true });
  for (const entrada of readdirSync(destino)) {
    if (entrada !== '.git') rmSync(join(destino, entrada), { recursive: true, force: true });
  }
  cpSync(fuente, destino, { recursive: true });
  for (const archivo of listarArchivos(destino).filter((a) => a.endsWith('.md'))) {
    if (archivo.split(sep)[0] === '.git') continue;
    const ruta = join(destino, archivo);
    writeFileSync(ruta, reescribirEnlaces(readFileSync(ruta, 'utf8')));
  }
}

const esPrincipal = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const [comando, ...args] = process.argv.slice(2);
  if (comando === 'verificar') {
    const errores = verificar({ release: args.includes('--release') });
    if (errores.length > 0) {
      for (const error of errores) console.error(`✗ ${error}`);
      process.exit(1);
    }
    console.info('✓ docs/wiki/ cumple las reglas de la Wiki');
  } else if (comando === 'construir' && args[0]) {
    const errores = verificar();
    if (errores.length > 0) {
      for (const error of errores) console.error(`✗ ${error}`);
      process.exit(1);
    }
    construir(resolve(args[0]));
    console.info(`✓ Wiki construida en ${args[0]}`);
  } else {
    console.error('Uso: node scripts/wiki.mjs verificar [--release] | construir <destino>');
    process.exit(2);
  }
}

// Instala los git hooks (commitlint y lint-staged) al hacer `npm install`.
//
// En CI y en los builds de despliegue no hay hooks que instalar, y ahi husky
// puede ni siquiera estar instalado (en Vercel `prepare` fallaba con
// "husky: command not found"; lo mismo pasa con `npm ci --omit=dev`). Por eso
// se salta en esos casos. En local corre husky sin red de seguridad: si falla
// la instalacion de los hooks, el error se ve.
// Patron recomendado por husky: https://typicode.github.io/husky/how-to.html
import process from 'node:process';

if (process.env.CI === 'true' || process.env.VERCEL === '1' || process.env.RENDER === 'true') {
  process.exit(0);
}

let husky;
try {
  husky = (await import('husky')).default;
} catch (error) {
  // Solo se salta si falta el paquete husky (devDependencies omitidas). Un
  // husky instalado pero roto debe fallar a la vista.
  const faltaHusky = error?.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes("'husky'");
  if (faltaHusky) process.exit(0);
  throw error;
}

process.stdout.write(husky());

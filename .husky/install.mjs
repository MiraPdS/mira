// Instala los git hooks (commitlint y lint-staged) al hacer `npm install`.
//
// En CI y en los builds de despliegue no hay hooks que instalar, y en Vercel
// el binario de husky ni siquiera esta disponible al correr `prepare`
// ("husky: command not found"). Por eso ahi se salta. En local se ejecuta
// husky sin red de seguridad: si falla, el error se ve.
// Patron recomendado por husky: https://typicode.github.io/husky/how-to.html
import process from 'node:process';

if (process.env.CI || process.env.VERCEL || process.env.RENDER) {
  process.exit(0);
}

const husky = (await import('husky')).default;
process.stdout.write(husky());

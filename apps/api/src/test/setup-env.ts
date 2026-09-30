/**
 * Variables de entorno minimas para los tests UNITARIOS.
 *
 * Se ejecuta como setupFile, es decir ANTES de que cualquier test importe
 * src/env.ts.  Sin esto, env.ts no encontraria JWT_SECRET y haria
 * process.exit(1), matando la suite completa en una maquina recien clonada.
 *
 * Solo se asignan valores si no vienen ya definidos, para no pisar la
 * configuracion real en CI.
 */
process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'secreto-de-pruebas-suficientemente-largo-1234567890';
process.env.DATABASE_URL ??= 'postgresql://mira:mira@localhost:5442/mira_dev?schema=public';
// 4 rondas = el minimo que acepta bcrypt. En unitarios no probamos la
// fortaleza del hash, solo el flujo, y esto ahorra segundos en cada corrida.
process.env.BCRYPT_ROUNDS ??= '4';

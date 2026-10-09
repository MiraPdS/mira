import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';

// El .env vive en la raiz del monorepo, no junto al schema: sin esto, Prisma
// arranca sin DATABASE_URL. Mismo motivo que prisma.config.ts.
loadEnv({ path: path.resolve(import.meta.dirname, '../../../.env') });

/**
 * Datos de demostracion, DETERMINISTAS.
 *
 * Tres usos:
 *  1. Poblar la base local para desarrollar sin crear todo a mano.
 *  2. Dar credenciales fijas a la capsula de video y a la demo en clases.
 *  3. Servir de estado inicial conocido para los E2E de la Entrega 3.
 *
 * Es idempotente (usa upsert): se puede correr las veces que haga falta.
 *
 *   npm run db:seed
 */

const prisma = new PrismaClient();

const PASSWORD_DEMO = 'demo1234';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 10);

  const [ada, alan, grace] = await Promise.all([
    prisma.user.upsert({
      where: { email: 'ada@mira.dev' },
      update: {},
      create: { name: 'Ada Lovelace', email: 'ada@mira.dev', passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'alan@mira.dev' },
      update: {},
      create: { name: 'Alan Turing', email: 'alan@mira.dev', passwordHash },
    }),
    prisma.user.upsert({
      where: { email: 'grace@mira.dev' },
      update: {},
      create: { name: 'Grace Hopper', email: 'grace@mira.dev', passwordHash },
    }),
  ]);

  const proyecto = await prisma.project.upsert({
    where: { key: 'MIR' },
    update: {},
    create: {
      name: 'Plataforma Mira',
      key: 'MIR',
      description: 'Proyecto de demostracion con datos de ejemplo.',
      members: {
        create: [
          { userId: ada.id, role: 'OWNER' },
          { userId: alan.id, role: 'MEMBER' },
          { userId: grace.id, role: 'VIEWER' },
        ],
      },
    },
  });

  // Un item por columna, para que el tablero se vea poblado de inmediato.
  const items = [
    {
      n: 1,
      title: 'Como usuario quiero registrarme para acceder a mis proyectos',
      type: 'STORY',
      status: 'DONE',
      priority: 'HIGH',
      estimate: 5,
      assignee: ada.id,
    },
    {
      n: 2,
      title: 'Como usuario quiero ver el tablero Kanban de mi proyecto',
      type: 'STORY',
      status: 'IN_REVIEW',
      priority: 'HIGH',
      estimate: 8,
      assignee: alan.id,
    },
    {
      n: 3,
      title: 'Mover una tarjeta entre columnas',
      type: 'TASK',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      estimate: 3,
      assignee: ada.id,
    },
    {
      n: 4,
      title: 'Buscar items del backlog por titulo',
      type: 'TASK',
      status: 'TODO',
      priority: 'MEDIUM',
      estimate: 3,
      assignee: null,
    },
    {
      n: 5,
      title: 'El filtro por prioridad no limpia la pagina actual',
      type: 'BUG',
      status: 'BACKLOG',
      priority: 'LOW',
      estimate: 1,
      assignee: null,
    },
  ] as const;

  // Los items de demo se crean UNA vez, cuando el proyecto es nuevo (contador
  // en 0). El seed corre en cada deploy de Render (MIR-27): recrearlos
  // resucitaria items borrados en la demo con posiciones viejas, y mover el
  // contador podria repetir referencias ya usadas. El contador se reclama con
  // una escritura condicional en la base, sin leer antes, para no competir con
  // items creados mientras corre el seed.
  const reclamado = await prisma.project.updateMany({
    where: { id: proyecto.id, itemCounter: 0 },
    data: { itemCounter: items.length },
  });

  if (reclamado.count === 1) {
    for (const item of items) {
      await prisma.workItem.upsert({
        where: { reference: `MIR-${item.n}` },
        update: {},
        create: {
          reference: `MIR-${item.n}`,
          projectId: proyecto.id,
          createdById: ada.id,
          assigneeId: item.assignee,
          title: item.title,
          type: item.type,
          status: item.status,
          priority: item.priority,
          estimate: item.estimate,
          position: item.n,
        },
      });
    }
  }

  console.info(
    [
      '',
      'Seed aplicado.',
      reclamado.count === 1
        ? `  Proyecto: ${proyecto.name} (${proyecto.key}) creado con ${items.length} items`
        : `  Proyecto: ${proyecto.name} (${proyecto.key}) ya existia: sus items no se tocan`,
      '  Usuarios de demostracion (misma contrasena para los tres):',
      '    ada@mira.dev    OWNER',
      '    alan@mira.dev   MEMBER',
      '    grace@mira.dev  VIEWER',
      `    contrasena:     ${PASSWORD_DEMO}`,
      '',
    ].join('\n'),
  );
}

main()
  .catch((error) => {
    console.error('Fallo el seed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

-- MIR-31: los estados del tablero pasan a ser columnas por proyecto.
--
-- Escrita a mano: la que genera Prisma borra work_items.status antes de
-- traspasarlo y se perderia en que columna estaba cada elemento. Aqui el
-- orden es: crear las columnas, copiar el estado a la columna equivalente,
-- verificar que no se perdio ninguno y recien entonces borrar el estado.
-- El esquema final es identico al que genera Prisma (mismos nombres de
-- indices y llaves), asi `prisma migrate diff` no reporta diferencias.
--
-- Todo corre en una transaccion: si la verificacion falla, no cambia nada.

-- CreateEnum
CREATE TYPE "ColumnCategory" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "board_columns" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "category" "ColumnCategory" NOT NULL,
    "legacyStatus" "WorkItemStatus",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "board_columns_projectId_position_idx" ON "board_columns"("projectId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "board_columns_id_projectId_key" ON "board_columns"("id", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "board_columns_projectId_legacyStatus_key" ON "board_columns"("projectId", "legacyStatus");

-- AddForeignKey
ALTER TABLE "board_columns" ADD CONSTRAINT "board_columns_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Datos: las cuatro columnas por defecto en cada proyecto existente. Mismos
-- nombres, orden y categorias que DEFAULT_BOARD_COLUMNS (packages/shared).
-- Los id son UUID y no cuid: Postgres no sabe generar cuid, y para Prisma
-- ambos son texto opaco.
INSERT INTO "board_columns" ("id", "projectId", "name", "position", "category", "legacyStatus", "updatedAt")
SELECT
    gen_random_uuid()::text,
    p."id",
    d."name",
    d."position",
    d."category"::"ColumnCategory",
    d."legacyStatus"::"WorkItemStatus",
    CURRENT_TIMESTAMP
FROM "projects" p
CROSS JOIN (
    VALUES
        ('Por hacer',   0, 'TODO',        'TODO'),
        ('En progreso', 1, 'IN_PROGRESS', 'IN_PROGRESS'),
        ('En revision', 2, 'IN_PROGRESS', 'IN_REVIEW'),
        ('Hecho',       3, 'DONE',        'DONE')
) AS d("name", "position", "category", "legacyStatus");

-- AlterTable
ALTER TABLE "work_items" ADD COLUMN "columnId" TEXT;

-- Datos: cada elemento a la columna de su estado anterior. BACKLOG no tiene
-- columna equivalente y queda en null, que es como se representa ahora.
UPDATE "work_items" w
SET "columnId" = c."id"
FROM "board_columns" c
WHERE c."projectId" = w."projectId"
  AND c."legacyStatus" = w."status";

-- Verificacion: ningun elemento fuera del backlog puede quedar sin columna.
DO $$
DECLARE
    sin_columna INTEGER;
BEGIN
    SELECT COUNT(*) INTO sin_columna
    FROM "work_items"
    WHERE "status" <> 'BACKLOG' AND "columnId" IS NULL;

    IF sin_columna > 0 THEN
        RAISE EXCEPTION 'MIR-31: % elementos quedarian sin columna', sin_columna;
    END IF;
END $$;

-- DropIndex
DROP INDEX "work_items_projectId_status_idx";

-- AlterTable
ALTER TABLE "work_items" DROP COLUMN "status";

-- CreateIndex
CREATE INDEX "work_items_projectId_columnId_idx" ON "work_items"("projectId", "columnId");

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_columnId_projectId_fkey" FOREIGN KEY ("columnId", "projectId") REFERENCES "board_columns"("id", "projectId") ON DELETE NO ACTION ON UPDATE CASCADE;

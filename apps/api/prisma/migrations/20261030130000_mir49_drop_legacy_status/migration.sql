-- MIR-49: la web ya trabaja con columnas, asi que se quita el puente de
-- MIR-31 (board_columns.legacyStatus y el enum WorkItemStatus).
--
-- Antes de borrarlo, el historial: ITEM_STATUS_CHANGED guardaba el estado
-- antiguo (TODO, IN_REVIEW...) cuando la columna era una de las por defecto.
-- Desde MIR-49 guarda siempre el nombre de la columna, asi que esos valores
-- pasan al nombre de su columna por defecto (DEFAULT_BOARD_COLUMNS en
-- packages/shared). BACKLOG se queda igual: sigue nombrando "sin columna".
--
-- El resto es lo que genera Prisma.

UPDATE "activity_log"
SET "fromValue" = CASE "fromValue"
        WHEN 'TODO'        THEN 'Por hacer'
        WHEN 'IN_PROGRESS' THEN 'En progreso'
        WHEN 'IN_REVIEW'   THEN 'En revision'
        WHEN 'DONE'        THEN 'Hecho'
        ELSE "fromValue"
    END,
    "toValue" = CASE "toValue"
        WHEN 'TODO'        THEN 'Por hacer'
        WHEN 'IN_PROGRESS' THEN 'En progreso'
        WHEN 'IN_REVIEW'   THEN 'En revision'
        WHEN 'DONE'        THEN 'Hecho'
        ELSE "toValue"
    END
WHERE "action" = 'ITEM_STATUS_CHANGED';

-- DropIndex
DROP INDEX "board_columns_projectId_legacyStatus_key";

-- AlterTable
ALTER TABLE "board_columns" DROP COLUMN "legacyStatus";

-- DropEnum
DROP TYPE "WorkItemStatus";

-- MIR-46: no se inventan metricas finales para sprints abiertos o cierres heredados.
BEGIN;
ALTER TABLE "sprints" ADD COLUMN "committedPoints" INTEGER,
                      ADD COLUMN "completedPoints" INTEGER;
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_closing_points_check" CHECK (
  ("committedPoints" IS NULL AND "completedPoints" IS NULL) OR
  (status = 'CLOSED' AND "committedPoints" IS NOT NULL AND "completedPoints" IS NOT NULL
   AND "committedPoints" >= "completedPoints" AND "completedPoints" >= 0)
);
COMMIT;

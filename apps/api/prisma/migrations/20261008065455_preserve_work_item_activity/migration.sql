-- DropForeignKey
ALTER TABLE "activity_log" DROP CONSTRAINT "activity_log_workItemId_fkey";

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

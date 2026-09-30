-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('EPIC', 'STORY', 'TASK', 'BUG');

-- CreateEnum
CREATE TYPE "WorkItemStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');

-- CreateEnum
CREATE TYPE "WorkItemPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('ITEM_CREATED', 'ITEM_UPDATED', 'ITEM_STATUS_CHANGED', 'ITEM_ASSIGNED', 'ITEM_DELETED', 'COMMENT_ADDED', 'MEMBER_ADDED', 'MEMBER_ROLE_CHANGED', 'MEMBER_REMOVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "itemCounter" INTEGER NOT NULL DEFAULT 0,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_items" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "WorkItemType" NOT NULL DEFAULT 'TASK',
    "status" "WorkItemStatus" NOT NULL DEFAULT 'BACKLOG',
    "priority" "WorkItemPriority" NOT NULL DEFAULT 'MEDIUM',
    "estimate" INTEGER,
    "dueDate" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "createdById" TEXT NOT NULL,
    "sprintId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "projectId" TEXT NOT NULL,
    "workItemId" TEXT,
    "actorId" TEXT NOT NULL,
    "field" TEXT,
    "fromValue" TEXT,
    "toValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "projects_key_key" ON "projects"("key");

-- CreateIndex
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");

-- CreateIndex
CREATE INDEX "project_members_projectId_idx" ON "project_members"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_userId_projectId_key" ON "project_members"("userId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "work_items_reference_key" ON "work_items"("reference");

-- CreateIndex
CREATE INDEX "work_items_projectId_status_idx" ON "work_items"("projectId", "status");

-- CreateIndex
CREATE INDEX "work_items_projectId_sprintId_idx" ON "work_items"("projectId", "sprintId");

-- CreateIndex
CREATE INDEX "work_items_assigneeId_idx" ON "work_items"("assigneeId");

-- CreateIndex
CREATE INDEX "comments_workItemId_createdAt_idx" ON "comments"("workItemId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_log_projectId_createdAt_idx" ON "activity_log"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_log_workItemId_createdAt_idx" ON "activity_log"("workItemId", "createdAt");

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

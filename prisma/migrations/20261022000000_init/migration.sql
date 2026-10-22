CREATE TABLE "Manual" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "genericName" TEXT NOT NULL,
 "tradeName" TEXT NOT NULL DEFAULT '',
 "pinyin" TEXT NOT NULL DEFAULT '',
 "pinyinInitials" TEXT NOT NULL DEFAULT '',
 "manufacturer" TEXT NOT NULL,
 "approvalNumber" TEXT NOT NULL,
 "specification" TEXT NOT NULL DEFAULT '',
 "dosageForm" TEXT NOT NULL DEFAULT '',
 "indications" TEXT NOT NULL DEFAULT '',
 "dosage" TEXT NOT NULL DEFAULT '',
 "pediatric" TEXT NOT NULL DEFAULT '',
 "contraindications" TEXT NOT NULL DEFAULT '',
 "adverseReactions" TEXT NOT NULL DEFAULT '',
 "precautions" TEXT NOT NULL DEFAULT '',
 "interactions" TEXT NOT NULL DEFAULT '',
 "pregnancy" TEXT NOT NULL DEFAULT '',
 "geriatric" TEXT NOT NULL DEFAULT '',
 "storage" TEXT NOT NULL DEFAULT '',
 "sourceName" TEXT NOT NULL DEFAULT '',
 "sourceUrl" TEXT NOT NULL DEFAULT '',
 "revisionDate" TEXT NOT NULL DEFAULT '',
 "reviewedBy" TEXT NOT NULL DEFAULT '',
 "reviewedAt" TEXT NOT NULL DEFAULT '',
 "isDemo" BOOLEAN NOT NULL DEFAULT false,
 "status" TEXT NOT NULL DEFAULT 'draft',
 "version" INTEGER NOT NULL DEFAULT 1,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "Manual_approvalNumber_key" ON "Manual"("approvalNumber");
CREATE INDEX "Manual_genericName_idx" ON "Manual"("genericName");
CREATE INDEX "Manual_manufacturer_idx" ON "Manual"("manufacturer");
CREATE INDEX "Manual_status_idx" ON "Manual"("status");

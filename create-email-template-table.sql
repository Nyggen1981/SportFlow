-- SQL script to create EmailTemplate table
-- Run this in Supabase SQL Editor or via psql

CREATE TABLE IF NOT EXISTS "EmailTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- Create unique index for organizationId + templateType
CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplate_organizationId_templateType_key" 
ON "EmailTemplate"("organizationId", "templateType");

-- Create index for organizationId
CREATE INDEX IF NOT EXISTS "EmailTemplate_organizationId_idx" 
ON "EmailTemplate"("organizationId");

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'EmailTemplate_organizationId_fkey'
    ) THEN
        ALTER TABLE "EmailTemplate" 
        ADD CONSTRAINT "EmailTemplate_organizationId_fkey" 
        FOREIGN KEY ("organizationId") 
        REFERENCES "Organization"("id") 
        ON DELETE CASCADE 
        ON UPDATE CASCADE;
    END IF;
END $$;

-- Verify table was created
SELECT 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'EmailTemplate'
ORDER BY ordinal_position;


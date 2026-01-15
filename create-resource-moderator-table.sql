-- Create ResourceModerator table for moderator functionality
-- This table links users with "moderator" role to specific resources they can approve bookings for

CREATE TABLE IF NOT EXISTS "ResourceModerator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceModerator_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint: a user can only be moderator for a resource once
CREATE UNIQUE INDEX IF NOT EXISTS "ResourceModerator_userId_resourceId_key" 
ON "ResourceModerator"("userId", "resourceId");

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS "ResourceModerator_userId_idx" 
ON "ResourceModerator"("userId");

CREATE INDEX IF NOT EXISTS "ResourceModerator_resourceId_idx" 
ON "ResourceModerator"("resourceId");

-- Add foreign key constraints
ALTER TABLE "ResourceModerator" 
ADD CONSTRAINT "ResourceModerator_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "User"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResourceModerator" 
ADD CONSTRAINT "ResourceModerator_resourceId_fkey" 
FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") 
ON DELETE CASCADE ON UPDATE CASCADE;


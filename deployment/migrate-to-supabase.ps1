# Migrasjonsskript for Supabase database
# Bruk: .\deployment\migrate-to-supabase.ps1

# ============================================
# KONFIGURASJON
# ============================================

# NY DATABASE (Supabase) - Mål
# Supabase krever SSL, så legg til ?sslmode=require
$TARGET_DATABASE_URL = "postgresql://postgres:L3n0v02025!@db.tvlxngbuzkmavtjqjpje.supabase.co:5432/postgres?sslmode=require"
$TARGET_DIRECT_URL = $TARGET_DATABASE_URL  # Supabase bruker samme URL for både pooled og direct

# GAMMEL DATABASE (Kilde) - Neon database
$SOURCE_DATABASE_URL = "postgresql://neondb_owner:npg_P8EQOzuFk6ZI@ep-falling-recipe-abe3sr4d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
# For Neon, DIRECT_URL er vanligvis uten "-pooler" i hostnavnet
$SOURCE_DIRECT_URL = "postgresql://neondb_owner:npg_P8EQOzuFk6ZI@ep-falling-recipe-abe3sr4d.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# ============================================
# STEG 1: Sett opp schema i ny database
# ============================================

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Steg 1: Setter opp schema i ny database" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════`n" -ForegroundColor Cyan

$env:DATABASE_URL = $TARGET_DATABASE_URL
$env:DIRECT_URL = $TARGET_DIRECT_URL

Write-Host "Pusher schema til ny database..." -ForegroundColor Yellow
npx prisma db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Feil ved oppsett av schema!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Schema pushet til ny database`n" -ForegroundColor Green

# ============================================
# STEG 2: Migrer data (hvis kilde-database er satt)
# ============================================

if ($SOURCE_DATABASE_URL) {
    Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Steg 2: Migrerer data fra gammel database" -ForegroundColor Cyan
    Write-Host "════════════════════════════════════════════`n" -ForegroundColor Cyan

    $env:SOURCE_DATABASE_URL = $SOURCE_DATABASE_URL
    $env:SOURCE_DIRECT_URL = $SOURCE_DIRECT_URL
    $env:TARGET_DATABASE_URL = $TARGET_DATABASE_URL
    $env:TARGET_DIRECT_URL = $TARGET_DIRECT_URL
    $env:AUTO_CONFIRM = "true"

    Write-Host "Starter migrering..." -ForegroundColor Yellow
    npx tsx deployment/migrate-database.ts

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n❌ Feil ved migrering av data!" -ForegroundColor Red
        exit 1
    }

    Write-Host "`n✅ Data migrert`n" -ForegroundColor Green
} else {
    Write-Host "`n════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "  Steg 2: Hopper over migrering" -ForegroundColor Yellow
    Write-Host "════════════════════════════════════════════" -ForegroundColor Yellow
    Write-Host "`nIngen kilde-database satt. Hoppet over migrering." -ForegroundColor Yellow
    Write-Host "Hvis du vil migrere data, sett SOURCE_DATABASE_URL i scriptet.`n" -ForegroundColor Yellow
}

# ============================================
# OPPSUMERING
# ============================================

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Migrasjon fullført!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "📝 Neste steg:" -ForegroundColor Blue
Write-Host "   1. Oppdater .env filen med ny DATABASE_URL" -ForegroundColor Yellow
Write-Host "   2. Oppdater miljøvariabler i Vercel" -ForegroundColor Yellow
Write-Host "   3. Test applikasjonen`n" -ForegroundColor Yellow

Write-Host "📋 Connection string for Vercel:" -ForegroundColor Blue
Write-Host "   DATABASE_URL: $TARGET_DATABASE_URL" -ForegroundColor Gray
Write-Host "   DIRECT_URL: $TARGET_DIRECT_URL`n" -ForegroundColor Gray


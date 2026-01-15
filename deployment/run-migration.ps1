# Migrasjonsskript: Neon → Supabase
# Kjør: .\deployment\run-migration.ps1

Write-Host "`n════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Migrasjon: Neon → Supabase" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════`n" -ForegroundColor Cyan

# KILDE: Neon database (gammel)
$env:SOURCE_DATABASE_URL = 'postgresql://neondb_owner:npg_P8EQOzuFk6ZI@ep-falling-recipe-abe3sr4d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
$env:SOURCE_DIRECT_URL = 'postgresql://neondb_owner:npg_P8EQOzuFk6ZI@ep-falling-recipe-abe3sr4d.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# MÅL: Supabase database (ny) - Session Pooler (IPv4-kompatibel)
# Bruk single quotes for å unngå problemer med spesialtegn i passord
$env:TARGET_DATABASE_URL = 'postgresql://postgres.tvlxngbuzkmavtjqjpje:L3n0v02025!@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require'
$env:TARGET_DIRECT_URL = $env:TARGET_DATABASE_URL

# Auto-bekreft migrering
$env:AUTO_CONFIRM = "true"

Write-Host "Steg 1: Setter opp schema i Supabase..." -ForegroundColor Yellow
$env:DATABASE_URL = $env:TARGET_DATABASE_URL
$env:DIRECT_URL = $env:TARGET_DIRECT_URL

npx prisma db push

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Feil ved oppsett av schema i Supabase!" -ForegroundColor Red
    Write-Host "`nSjekk:" -ForegroundColor Yellow
    Write-Host "  1. Er Supabase-prosjektet aktivt?" -ForegroundColor Gray
    Write-Host "  2. Er IP-adressen whitelistet i Supabase?" -ForegroundColor Gray
    Write-Host "  3. Er connection string riktig?" -ForegroundColor Gray
    Write-Host "`nPrøv å hente connection string fra Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "  Settings → Database → Connection string (Connection Pooling)`n" -ForegroundColor Gray
    exit 1
}

Write-Host "`n✅ Schema pushet til Supabase`n" -ForegroundColor Green

Write-Host "Steg 2: Migrerer data fra Neon til Supabase..." -ForegroundColor Yellow
npx tsx deployment/migrate-database.ts

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Feil ved migrering av data!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Migrasjon fullført!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Neste steg:" -ForegroundColor Blue
Write-Host "  1. Oppdater .env filen med Supabase connection string" -ForegroundColor Yellow
Write-Host "  2. Oppdater miljøvariabler i Vercel" -ForegroundColor Yellow
Write-Host "  3. Test applikasjonen" -ForegroundColor Yellow
Write-Host ""


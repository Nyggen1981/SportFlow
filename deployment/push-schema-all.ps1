# Push Prisma schema to all customer databases
# Usage: .\deployment\push-schema-all.ps1

$ErrorActionPreference = "Stop"

# Check if local config exists
$configPath = "$PSScriptRoot\databases.local.json"
if (-not (Test-Path $configPath)) {
    Write-Host "ERROR: databases.local.json ikke funnet!" -ForegroundColor Red
    Write-Host "Kopier databases.local.example.json til databases.local.json og fyll inn credentials." -ForegroundColor Yellow
    exit 1
}

# Read config
$config = Get-Content $configPath | ConvertFrom-Json

Write-Host "=== Sportflow Booking - Push Schema til alle databaser ===" -ForegroundColor Cyan
Write-Host ""

$successCount = 0
$failCount = 0
$databases = $config.databases.PSObject.Properties

foreach ($db in $databases) {
    $name = $db.Name
    $urls = $db.Value
    
    Write-Host "[$name] Pusher schema..." -ForegroundColor Yellow
    
    try {
        $env:DATABASE_URL = $urls.DATABASE_URL
        $env:DIRECT_URL = $urls.DIRECT_URL
        
        # Run prisma db push
        $result = & npm exec prisma db push -- --skip-generate 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$name] OK!" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "[$name] FEIL: $result" -ForegroundColor Red
            $failCount++
        }
    }
    catch {
        Write-Host "[$name] FEIL: $_" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

# Clean up env vars
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:DIRECT_URL -ErrorAction SilentlyContinue

Write-Host "=== Ferdig ===" -ForegroundColor Cyan
Write-Host "Vellykket: $successCount" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "Feilet: $failCount" -ForegroundColor Red
}


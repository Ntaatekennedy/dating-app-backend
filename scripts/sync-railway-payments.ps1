# Sync PesaPal + subscription vars from backend/.env to Railway (api service).
# Usage: cd backend; .\scripts\sync-railway-payments.ps1

$ErrorActionPreference = "Stop"
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env"
if (-not (Test-Path $envFile)) {
  Write-Error "Missing $envFile"
}

function Read-EnvValue($key) {
  $line = Get-Content $envFile | Where-Object { $_ -match "^$key=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split "=", 2)[1]
}

$productionBase = "https://api-production-4f51.up.railway.app"
$keys = @(
  @{ Name = "BASE_URL"; Value = $productionBase },
  @{ Name = "PESAPAL_CONSUMER_KEY"; Value = (Read-EnvValue "PESAPAL_CONSUMER_KEY") },
  @{ Name = "PESAPAL_CONSUMER_SECRET"; Value = (Read-EnvValue "PESAPAL_CONSUMER_SECRET") },
  @{ Name = "PESAPAL_SANDBOX"; Value = (Read-EnvValue "PESAPAL_SANDBOX") },
  @{ Name = "PESAPAL_CURRENCY"; Value = (Read-EnvValue "PESAPAL_CURRENCY") },
  @{ Name = "PESAPAL_COUNTRY_CODE"; Value = (Read-EnvValue "PESAPAL_COUNTRY_CODE") },
  @{ Name = "PESAPAL_IPN_ID"; Value = (Read-EnvValue "PESAPAL_IPN_ID") },
  @{ Name = "MOBILE_MONEY_SIMULATE"; Value = "false" },
  @{ Name = "SUBSCRIPTIONS_ENABLED"; Value = "true" }
)

foreach ($entry in $keys) {
  if ([string]::IsNullOrWhiteSpace($entry.Value)) {
    Write-Warning "Skipping $($entry.Name) - not set in .env"
    continue
  }
  Write-Host "Setting $($entry.Name)..."
  railway variable set "$($entry.Name)=$($entry.Value)" --service api | Out-Null
}

Write-Host "Done. Railway will redeploy. Production API: $productionBase"
Write-Host "Test on APK - mobile money should open PesaPal in-app."

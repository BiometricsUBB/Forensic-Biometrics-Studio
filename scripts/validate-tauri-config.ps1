param(
    [string]$ConfigPath = "src-tauri\\tauri.conf.json"
)

if (-not (Test-Path $ConfigPath)) {
    Write-Error "Tauri config not found: ${ConfigPath}"
    exit 1
}

try {
    $raw = Get-Content -Path $ConfigPath -Raw
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($ConfigPath, $raw, $utf8NoBom)
    $raw | ConvertFrom-Json | Out-Null
} catch {
    Write-Error "Invalid JSON in ${ConfigPath}: $($_.Exception.Message)"
    exit 1
}

Write-Host "Tauri config JSON OK: $ConfigPath"

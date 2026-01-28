param(
    [string]$ConfigPath = $env:TAURI_CONFIG
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$binDir = Join-Path $repoRoot "src-tauri\\bin"

if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $ConfigPath = "src-tauri\\tauri.conf.json"
}

Write-Host "TAURI_CONFIG: $ConfigPath"

if (-not (Test-Path $ConfigPath)) {
    Write-Error "Tauri config not found: $ConfigPath"
    exit 1
}

$configJson = Get-Content -Path $ConfigPath -Raw | ConvertFrom-Json
$externalBin = $configJson.bundle.externalBin
Write-Host "externalBin: $($externalBin -join ', ')"

$targetTriple = (& rustc -vV 2>$null | Select-String -Pattern "^host:" | ForEach-Object { $_.Line.Split(":", 2)[1].Trim() })
if ([string]::IsNullOrWhiteSpace($targetTriple)) {
    Write-Error "Failed to detect Rust target triple. Ensure rustc is on PATH."
    exit 1
}

$expected = Join-Path $binDir "sourceafis_cli-$targetTriple.exe"
if (-not (Test-Path $expected)) {
    Write-Error "Missing sidecar: $expected`nRun: dotnet publish ..\\sourceafis-net\\SourceAFIS.Cli\\SourceAFIS.Cli.csproj -c Release -r win-x64 -p:PublishSingleFile=true -p:SelfContained=false`nThen: powershell .\\scripts\\copy-sourceafis-sidecar.ps1"
    exit 1
}

Write-Host "Sidecar OK: $expected"

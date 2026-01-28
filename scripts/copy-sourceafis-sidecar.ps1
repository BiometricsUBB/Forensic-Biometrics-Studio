param()

# Copies SourceAFIS.Cli.exe to src-tauri/bin and renames it to match the active Tauri target triple.
$repoRoot = Split-Path -Parent $PSScriptRoot
$cliRoot = Join-Path $repoRoot "..\\sourceafis-net\\SourceAFIS.Cli"
$dstDir = Join-Path $repoRoot "src-tauri\\bin"

if (-not (Test-Path $cliRoot)) {
    Write-Error "SourceAFIS.Cli project not found at: $cliRoot"
    exit 1
}

$targetTriple = (& rustc -vV 2>$null | Select-String -Pattern "^host:" | ForEach-Object { $_.Line.Split(":", 2)[1].Trim() })
if ([string]::IsNullOrWhiteSpace($targetTriple)) {
    Write-Error "Failed to detect Rust target triple. Ensure rustc is on PATH."
    exit 1
}

if (-not (Test-Path $dstDir)) {
    New-Item -ItemType Directory -Path $dstDir | Out-Null
}

$publishDir = Join-Path $cliRoot "bin\\Release\\net7.0\\win-x64\\publish"
$exe = Join-Path $publishDir "SourceAFIS.Cli.exe"

if (-not (Test-Path $exe)) {
    Write-Error "SourceAFIS.Cli.exe not found at: $exe`nBuild it with: dotnet publish ..\\sourceafis-net\\SourceAFIS.Cli\\SourceAFIS.Cli.csproj -c Release -r win-x64 -p:PublishSingleFile=true -p:SelfContained=false"
    exit 1
}

Write-Host "Found publish output: $exe"

$dstName = "sourceafis_cli-$targetTriple.exe"
$dst = Join-Path $dstDir $dstName
Copy-Item -Path $exe -Destination $dst -Force
Write-Host "Copied sidecar to: $dst"

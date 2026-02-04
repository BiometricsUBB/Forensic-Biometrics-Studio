param()

# Copies SourceAFIS.Cli.exe to src-tauri/bin and renames it to match the active Tauri target triple.
$repoRoot = Split-Path -Parent $PSScriptRoot
$cliRoot = Join-Path $repoRoot "..\\sourceafis-net\\SourceAFIS.Cli"
if (-not (Test-Path $cliRoot)) {
    $cliRoot = Join-Path $repoRoot "..\\SourceAFIS\\SourceAFIS.Cli"
}
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

$exe = Get-ChildItem -Path (Join-Path $cliRoot "bin\\Release") -Recurse -Filter "SourceAFIS.Cli.exe" |
    Where-Object { $_.FullName -like "*\win-x64\publish\SourceAFIS.Cli.exe" } |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $exe) {
    Write-Error "SourceAFIS.Cli.exe publish output not found under: $cliRoot`nBuild it with: dotnet publish ..\\SourceAFIS\\SourceAFIS.Cli\\SourceAFIS.Cli.csproj -c Release -r win-x64 -p:PublishSingleFile=true -p:SelfContained=false"
    exit 1
}

Write-Host "Found publish output: $exe"

$dstName = "sourceafis_cli-$targetTriple.exe"
$dst = Join-Path $dstDir $dstName
Copy-Item -Path $exe -Destination $dst -Force
Write-Host "Copied sidecar to: $dst"

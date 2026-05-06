# Check if Microsoft.UI.Xaml.2.8 is already installed
if (Get-AppxPackage -Name Microsoft.UI.Xaml.2.8 -ErrorAction SilentlyContinue) {
    Write-Host "Microsoft.UI.Xaml.2.8 is already installed. Skipping download and installation."
} else {
    # Download missing dependency Microsoft.UI.Xaml.2.8
    Write-Host "Downloading dependency: Microsoft.UI.Xaml.2.8..."
    Invoke-WebRequest -Uri "https://github.com/microsoft/microsoft-ui-xaml/releases/download/v2.8.6/Microsoft.UI.Xaml.2.8.x64.appx" -OutFile "Microsoft.UI.Xaml.2.8.appx" -UseBasicParsing
    if (!(Test-Path "Microsoft.UI.Xaml.2.8.appx")) {
        Write-Host "Failed to download Microsoft.UI.Xaml.2.8."
        exit 1
    }

    # Install missing dependency
    try {
        Add-AppxPackage -Path "Microsoft.UI.Xaml.2.8.appx"
    } catch {
        Write-Host "Failed to install Microsoft.UI.Xaml.2.8."
        exit 1
    }

    # Clean up installer file
    Remove-Item -Force "Microsoft.UI.Xaml.2.8.appx"
}


# Define temporary file for GitHub API response
$tempFile = "$env:TEMP\winget_latest.json"

# Check if Winget is already installed
if (Get-Command winget -ErrorAction SilentlyContinue) {
    Write-Host "Winget is already installed. Skipping Winget installation."
} else {
    # Clear the console
    Clear-Host

    # Download the latest release metadata
    Invoke-WebRequest -Uri "https://api.github.com/repos/microsoft/winget-cli/releases/latest" -OutFile $tempFile -UseBasicParsing
    if (!(Test-Path $tempFile)) {
        Write-Host "Failed to fetch Winget release metadata."
        exit 1
    }

    # Extract the download URL for the .msixbundle
    $wingetUrl = (Get-Content $tempFile | ConvertFrom-Json).assets | Where-Object { $_.browser_download_url -like '*.msixbundle' } | Select-Object -ExpandProperty browser_download_url
    if (-not $wingetUrl) {
        Write-Host "Failed to extract the Winget .msixbundle URL."
        exit 1
    }

    # Print the Winget download URL
    Write-Host "Winget will be downloaded from: $wingetUrl"

    # Download the Winget installer
    Invoke-WebRequest -Uri $wingetUrl -OutFile "Setup.msix" -UseBasicParsing
    if (!(Test-Path "Setup.msix")) {
        Write-Host "Failed to download Setup.msix."
        exit 1
    }

    # Install Winget
    try {
        Add-AppxPackage -Path "Setup.msix"
    } catch {
        Write-Host "Failed to install Winget."
        Remove-Item -Force "Setup.msix"
        exit 1
    }

    # Clean up installer file
    Remove-Item -Force "Setup.msix"
    # Clean up temporary file
    Remove-Item -Force $tempFile
}

winget install -e --id OpenJS.NodeJS --accept-source-agreements --accept-package-agreements
winget install -e --id Rustlang.Rust.MSVC --accept-source-agreements --accept-package-agreements
powershell -c "irm bun.com/install.ps1 | iex"
winget install Microsoft.VisualStudio.2022.Community --accept-source-agreements --accept-package-agreements --override "--wait --quiet --add ProductLang Pl-pl --add Microsoft.VisualStudio.Workload.NativeDesktop --includeRecommended"
winget install -e --id Microsoft.VCRedist.2015+.x64 --accept-source-agreements --accept-package-agreements

Write-Host "Installation complete!"
#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Thinkathon Security Vulnerability Scanner
.DESCRIPTION
    Scans system for vulnerabilities and submits data to Thinkathon platform
.NOTES
    Requires Administrator privileges
    Generated for: {{USER_EMAIL}}
#>

$ErrorActionPreference = "Stop"

# Configuration
$API_ENDPOINT = "{{API_ENDPOINT}}"
$API_KEY = "{{API_KEY}}"
$USER_EMAIL = "{{USER_EMAIL}}"

function Get-StableDeviceID {
    try {
        $bios = Get-CimInstance Win32_BIOS
        $cs = Get-CimInstance Win32_ComputerSystem
        $mb = Get-CimInstance Win32_BaseBoard
        
        $combined = "$($bios.SerialNumber)_$($cs.Model)_$($mb.SerialNumber)"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($combined)
        $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
        return [System.BitConverter]::ToString($hash).Replace("-","")
    }
    catch {
        Write-Warning "Could not generate stable device ID: $_"
        return "UNAVAILABLE"
    }
}

function Get-InstalledSoftware {
    $software = @()
    $regPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    foreach ($path in $regPaths) {
        try {
            $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                if ($item.DisplayName) {
                    $software += [PSCustomObject]@{
                        name = $item.DisplayName
                        version = if ($item.DisplayVersion) { $item.DisplayVersion } else { "Unknown" }
                        publisher = if ($item.Publisher) { $item.Publisher } else { "Unknown" }
                        installDate = if ($item.InstallDate) { $item.InstallDate } else { "" }
                    }
                }
            }
        }
        catch {
            Write-Warning "Could not access registry path: $path"
        }
    }
    
    return $software | Sort-Object name -Unique
}

function Get-BrowserExtensions {
    $extensions = @()
    
    # Chrome extensions
    $chromePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"
    if (Test-Path $chromePath) {
        Get-ChildItem $chromePath -Directory | ForEach-Object {
            $manifestPath = Join-Path $_.FullName "manifest.json"
            if (Test-Path $manifestPath) {
                try {
                    $manifest = Get-Content $manifestPath | ConvertFrom-Json
                    $extensions += [PSCustomObject]@{
                        browser = "Chrome"
                        name = $manifest.name
                        version = $manifest.version
                        extensionId = $_.Name
                    }
                }
                catch {
                    # Skip invalid manifests
                }
            }
        }
    }
    
    # Edge extensions
    $edgePath = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Extensions"
    if (Test-Path $edgePath) {
        Get-ChildItem $edgePath -Directory | ForEach-Object {
            $manifestPath = Join-Path $_.FullName "manifest.json"
            if (Test-Path $manifestPath) {
                try {
                    $manifest = Get-Content $manifestPath | ConvertFrom-Json
                    $extensions += [PSCustomObject]@{
                        browser = "Edge"
                        name = $manifest.name
                        version = $manifest.version
                        extensionId = $_.Name
                    }
                }
                catch {
                    # Skip invalid manifests
                }
            }
        }
    }
    
    return $extensions
}

function Get-PatchStatus {
    try {
        $hotfixes = Get-HotFix | Sort-Object InstalledOn -Descending
        $lastPatch = $hotfixes | Select-Object -First 1
        
        return [PSCustomObject]@{
            totalPatches = $hotfixes.Count
            latestPatchId = if ($lastPatch) { $lastPatch.HotFixID } else { "" }
            latestPatchDate = if ($lastPatch) { $lastPatch.InstalledOn } else { Get-Date }
        }
    }
    catch {
        Write-Warning "Could not retrieve patch information: $_"
        return [PSCustomObject]@{
            totalPatches = 0
            latestPatchId = ""
            latestPatchDate = Get-Date
        }
    }
}

# Main execution
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Thinkathon Security Scanner" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"
Write-Host "Scan started: $timestamp" -ForegroundColor Green
Write-Host ""

# Gather system information
Write-Host "[1/5] Gathering Device Identity..." -ForegroundColor Yellow
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$deviceID = Get-StableDeviceID

Write-Host "[2/5] Gathering OS Information..." -ForegroundColor Yellow
$os = Get-CimInstance Win32_OperatingSystem

Write-Host "[3/5] Scanning Installed Software..." -ForegroundColor Yellow
$software = Get-InstalledSoftware

Write-Host "[4/5] Gathering Browser Extensions..." -ForegroundColor Yellow
$browserExtensions = Get-BrowserExtensions

Write-Host "[5/5] Analyzing Patch Status..." -ForegroundColor Yellow
$patchInfo = Get-PatchStatus

# Prepare scan data
$scanData = @{
    deviceId = $deviceID
    scanTimestamp = $timestamp
    systemInfo = @{
        computerName = $env:COMPUTERNAME
        osName = $os.Caption
        osVersion = $os.Version
        osBuild = $os.BuildNumber
        architecture = $os.OSArchitecture
        manufacturer = $cs.Manufacturer
        model = $cs.Model
    }
    software = $software
    browserExtensions = $browserExtensions
    patches = @{
        totalPatches = $patchInfo.totalPatches
        latestPatchId = $patchInfo.latestPatchId
        latestPatchDate = $patchInfo.latestPatchDate.ToString("yyyy-MM-ddTHH:mm:ssZ")
    }
} | ConvertTo-Json -Depth 10

# Submit scan
Write-Host ""
Write-Host "Submitting scan data..." -ForegroundColor Yellow

try {
    $headers = @{
        "Authorization" = "Bearer $API_KEY"
        "X-User-Email" = $USER_EMAIL
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri $API_ENDPOINT -Method Post -Headers $headers -Body $scanData -ErrorAction Stop
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "Scan submitted successfully!" -ForegroundColor Green
    Write-Host "Scan ID: $($response.scanId)" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Check your dashboard for results: https://thinkathon.app/dashboard" -ForegroundColor Cyan
}
catch {
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Red
    Write-Host "Error submitting scan:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "=====================================" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Scan completed!" -ForegroundColor Green


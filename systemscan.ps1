#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Comprehensive Windows System Inventory Scanner
.DESCRIPTION
    Scans system for device identity, OS info, architecture, installed software,
    patches, and generates a privacy-safe device identifier.
.NOTES
    Requires Administrator privileges for complete system access
#>

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
                        Name = $item.DisplayName
                        Version = $item.DisplayVersion
                        Publisher = $item.Publisher
                        InstallDate = $item.InstallDate
                    }
                }
            }
        }
        catch {
            Write-Warning "Could not access registry path: $path"
        }
    }
    
    return $software | Sort-Object Name -Unique
}

function Get-PatchStatus {
    try {
        $hotfixes = Get-HotFix | Sort-Object InstalledOn -Descending
        $lastPatch = $hotfixes | Select-Object -First 1
        
        return [PSCustomObject]@{
            TotalPatches = $hotfixes.Count
            LatestPatchID = $lastPatch.HotFixID
            LatestPatchDate = $lastPatch.InstalledOn
            LatestPatchDescription = $lastPatch.Description
            RecentPatches = $hotfixes | Select-Object -First 10
        }
    }
    catch {
        Write-Warning "Could not retrieve patch information: $_"
        return $null
    }
}

# Main execution
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Windows System Inventory Scanner" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
Write-Host "Scan started: $timestamp" -ForegroundColor Green
Write-Host ""

# Device Identity
Write-Host "[1/6] Gathering Device Identity..." -ForegroundColor Yellow
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$deviceID = Get-StableDeviceID

$deviceInfo = [PSCustomObject]@{
    ComputerName = $env:COMPUTERNAME
    Domain = $cs.Domain
    Manufacturer = $cs.Manufacturer
    Model = $cs.Model
    BIOSVersion = $bios.SMBIOSBIOSVersion
    SerialNumber = $bios.SerialNumber
    StableDeviceID = $deviceID
}

# OS Version & Build
Write-Host "[2/6] Gathering OS Information..." -ForegroundColor Yellow
$os = Get-CimInstance Win32_OperatingSystem
$osInfo = [PSCustomObject]@{
    OSName = $os.Caption
    Version = $os.Version
    BuildNumber = $os.BuildNumber
    OSArchitecture = $os.OSArchitecture
    InstallDate = $os.InstallDate
    LastBootUpTime = $os.LastBootUpTime
}

# Architecture
Write-Host "[3/6] Gathering Architecture Details..." -ForegroundColor Yellow
$proc = Get-CimInstance Win32_Processor | Select-Object -First 1
$archInfo = [PSCustomObject]@{
    ProcessorName = $proc.Name
    Architecture = $proc.AddressWidth
    Cores = $proc.NumberOfCores
    LogicalProcessors = $proc.NumberOfLogicalProcessors
    MaxClockSpeed = "$($proc.MaxClockSpeed) MHz"
}

# Installed Software
Write-Host "[4/6] Scanning Installed Software (this may take a moment)..." -ForegroundColor Yellow
$software = Get-InstalledSoftware

# Patch Status
Write-Host "[5/6] Analyzing Patch/Update Posture..." -ForegroundColor Yellow
$patchInfo = Get-PatchStatus

# Compile Report
Write-Host "[6/6] Compiling Report..." -ForegroundColor Yellow

$report = [PSCustomObject]@{
    ScanTimestamp = $timestamp
    DeviceIdentity = $deviceInfo
    OSInformation = $osInfo
    Architecture = $archInfo
    InstalledSoftwareCount = $software.Count
    InstalledSoftware = $software
    PatchPosture = $patchInfo
}

# Display Summary
Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "SCAN SUMMARY" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Device Identity:" -ForegroundColor Green
Write-Host "  Computer Name: $($deviceInfo.ComputerName)"
Write-Host "  Model: $($deviceInfo.Manufacturer) $($deviceInfo.Model)"
Write-Host "  Stable Device ID: $($deviceInfo.StableDeviceID)"
Write-Host ""
Write-Host "OS Information:" -ForegroundColor Green
Write-Host "  OS: $($osInfo.OSName)"
Write-Host "  Version: $($osInfo.Version)"
Write-Host "  Build: $($osInfo.BuildNumber)"
Write-Host ""
Write-Host "Architecture:" -ForegroundColor Green
Write-Host "  Processor: $($archInfo.ProcessorName)"
Write-Host "  Architecture: $($archInfo.Architecture)-bit"
Write-Host "  Cores: $($archInfo.Cores) ($($archInfo.LogicalProcessors) logical)"
Write-Host ""
Write-Host "Software:" -ForegroundColor Green
Write-Host "  Total Installed: $($software.Count) applications"
Write-Host ""
Write-Host "Patch Status:" -ForegroundColor Green
Write-Host "  Total Patches: $($patchInfo.TotalPatches)"
Write-Host "  Latest Patch: $($patchInfo.LatestPatchID) ($($patchInfo.LatestPatchDate))"
Write-Host ""

# Export Options
$exportPath = Join-Path $env:USERPROFILE "Desktop\SystemScan_$($env:COMPUTERNAME)_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "EXPORT OPTIONS" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Exporting to: $exportPath" -ForegroundColor Yellow

# Export as JSON
$jsonPath = "$exportPath.json"
$report | ConvertTo-Json -Depth 5 | Out-File $jsonPath
Write-Host "[OK] JSON report saved: $jsonPath" -ForegroundColor Green

# Export as CSV (software list)
$csvPath = "$exportPath`_Software.csv"
$software | Export-Csv $csvPath -NoTypeInformation
Write-Host "[OK] Software CSV saved: $csvPath" -ForegroundColor Green

# Export as HTML
$htmlPath = "$exportPath.html"
$html = @"
<!DOCTYPE html>
<html>
<head>
    <title>System Scan Report - $($deviceInfo.ComputerName)</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #0066cc; border-bottom: 2px solid #0066cc; padding-bottom: 10px; }
        h2 { color: #333; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #0066cc; color: white; }
        tr:hover { background-color: #f5f5f5; }
        .info-grid { display: grid; grid-template-columns: 200px 1fr; gap: 10px; margin: 10px 0; }
        .label { font-weight: bold; color: #555; }
        .timestamp { color: #666; font-style: italic; }
    </style>
</head>
<body>
    <div class="container">
        <h1>System Scan Report</h1>
        <p class="timestamp">Scan Date: $timestamp</p>
        
        <h2>Device Identity</h2>
        <div class="info-grid">
            <div class="label">Computer Name:</div><div>$($deviceInfo.ComputerName)</div>
            <div class="label">Manufacturer:</div><div>$($deviceInfo.Manufacturer)</div>
            <div class="label">Model:</div><div>$($deviceInfo.Model)</div>
            <div class="label">Serial Number:</div><div>$($deviceInfo.SerialNumber)</div>
            <div class="label">Stable Device ID:</div><div style="font-family: monospace; font-size: 0.9em;">$($deviceInfo.StableDeviceID)</div>
        </div>
        
        <h2>Operating System</h2>
        <div class="info-grid">
            <div class="label">OS Name:</div><div>$($osInfo.OSName)</div>
            <div class="label">Version:</div><div>$($osInfo.Version)</div>
            <div class="label">Build Number:</div><div>$($osInfo.BuildNumber)</div>
            <div class="label">Architecture:</div><div>$($osInfo.OSArchitecture)</div>
            <div class="label">Install Date:</div><div>$($osInfo.InstallDate)</div>
        </div>
        
        <h2>Architecture</h2>
        <div class="info-grid">
            <div class="label">Processor:</div><div>$($archInfo.ProcessorName)</div>
            <div class="label">Architecture:</div><div>$($archInfo.Architecture)-bit</div>
            <div class="label">Cores:</div><div>$($archInfo.Cores) physical, $($archInfo.LogicalProcessors) logical</div>
            <div class="label">Max Speed:</div><div>$($archInfo.MaxClockSpeed)</div>
        </div>
        
        <h2>Patch Status</h2>
        <div class="info-grid">
            <div class="label">Total Patches:</div><div>$($patchInfo.TotalPatches)</div>
            <div class="label">Latest Patch:</div><div>$($patchInfo.LatestPatchID)</div>
            <div class="label">Installed:</div><div>$($patchInfo.LatestPatchDate)</div>
        </div>
        
        <h2>Installed Software ($($software.Count) applications)</h2>
        <table>
            <thead>
                <tr>
                    <th>Application Name</th>
                    <th>Version</th>
                    <th>Publisher</th>
                    <th>Install Date</th>
                </tr>
            </thead>
            <tbody>
"@

foreach ($app in $software | Select-Object -First 100) {
    $html += @"
                <tr>
                    <td>$($app.Name)</td>
                    <td>$($app.Version)</td>
                    <td>$($app.Publisher)</td>
                    <td>$($app.InstallDate)</td>
                </tr>
"@
}

$html += @"
            </tbody>
        </table>
    </div>
</body>
</html>
"@

$html | Out-File $htmlPath -Encoding UTF8
Write-Host "[OK] HTML report saved: $htmlPath" -ForegroundColor Green

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Scan completed successfully!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
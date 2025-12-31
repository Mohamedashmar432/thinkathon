#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Secure Habit - Endpoint Security Agent
.DESCRIPTION
    Scans system for vulnerabilities and submits data to Secure Habit platform
.NOTES
    Requires Administrator privileges
    Generated for: {{USER_EMAIL}}
#>

$ErrorActionPreference = "Stop"

# Configuration
$API_ENDPOINT = "{{API_ENDPOINT}}"
$API_KEY = "{{API_KEY}}"
$USER_EMAIL = "{{USER_EMAIL}}"
$AGENT_VERSION = "2.0.0"

function Get-StableDeviceID {
    try {
        $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        $mb = Get-CimInstance Win32_BaseBoard -ErrorAction SilentlyContinue
        
        $combined = "$($bios.SerialNumber)_$($cs.Model)_$($mb.SerialNumber)"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($combined)
        $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
        return [System.BitConverter]::ToString($hash).Replace("-","").Substring(0, 32)
    }
    catch {
        Write-Warning "Could not generate stable device ID: $_"
        return "DEVICE_$(Get-Random -Maximum 999999)"
    }
}

function Get-InstalledSoftware {
    $software = @()
    $regPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    $processedNames = @{}
    
    foreach ($path in $regPaths) {
        try {
            $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
            foreach ($item in $items) {
                if ($item.DisplayName -and $item.DisplayName.Trim() -ne "") {
                    $displayName = $item.DisplayName.Trim()
                    
                    # Skip system updates and duplicates
                    if ($displayName -match "^(KB\d+|Update for|Security Update|Hotfix|Microsoft Visual C\+\+ \d+ x\d+ Redistributable)") {
                        continue
                    }
                    
                    # Avoid duplicates
                    $key = "$displayName|$($item.DisplayVersion)"
                    if ($processedNames.ContainsKey($key)) {
                        continue
                    }
                    $processedNames[$key] = $true
                    
                    $software += [PSCustomObject]@{
                        name = $displayName
                        version = if ($item.DisplayVersion) { $item.DisplayVersion.Trim() } else { "Unknown" }
                        publisher = if ($item.Publisher) { $item.Publisher.Trim() } else { "Unknown" }
                        installDate = if ($item.InstallDate) { $item.InstallDate } else { "" }
                    }
                }
            }
        }
        catch {
            Write-Warning "Could not access registry path: $path - $_"
        }
    }
    
    return $software | Sort-Object name
}

function Get-BrowserExtensions {
    $extensions = @()
    
    # Chrome extensions
    $chromePath = "$env:LOCALAPPDATA\Google\Chrome\User Data\Default\Extensions"
    if (Test-Path $chromePath) {
        try {
            Get-ChildItem $chromePath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                $extensionDir = $_.FullName
                $versionDirs = Get-ChildItem $extensionDir -Directory -ErrorAction SilentlyContinue
                foreach ($versionDir in $versionDirs) {
                    $manifestPath = Join-Path $versionDir.FullName "manifest.json"
                    if (Test-Path $manifestPath) {
                        try {
                            $content = Get-Content $manifestPath -Raw | ConvertFrom-Json
                            $extensions += [PSCustomObject]@{
                                browser = "Chrome"
                                name = $content.name
                                version = $content.version
                                extensionId = $_.Name
                            }
                            break # Only need one version
                        }
                        catch {
                            # Skip invalid manifests
                        }
                    }
                }
            }
        }
        catch {
            Write-Warning "Error scanning Chrome extensions: $_"
        }
    }
    
    # Edge extensions
    $edgePath = "$env:LOCALAPPDATA\Microsoft\Edge\User Data\Default\Extensions"
    if (Test-Path $edgePath) {
        try {
            Get-ChildItem $edgePath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                $extensionDir = $_.FullName
                $versionDirs = Get-ChildItem $extensionDir -Directory -ErrorAction SilentlyContinue
                foreach ($versionDir in $versionDirs) {
                    $manifestPath = Join-Path $versionDir.FullName "manifest.json"
                    if (Test-Path $manifestPath) {
                        try {
                            $content = Get-Content $manifestPath -Raw | ConvertFrom-Json
                            $extensions += [PSCustomObject]@{
                                browser = "Edge"
                                name = $content.name
                                version = $content.version
                                extensionId = $_.Name
                            }
                            break # Only need one version
                        }
                        catch {
                            # Skip invalid manifests
                        }
                    }
                }
            }
        }
        catch {
            Write-Warning "Error scanning Edge extensions: $_"
        }
    }
    
    return $extensions
}

function Get-PatchStatus {
    try {
        $hotfixes = Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending
        $lastPatch = $hotfixes | Select-Object -First 1
        
        return [PSCustomObject]@{
            totalPatches = $hotfixes.Count
            latestPatchId = if ($lastPatch) { $lastPatch.HotFixID } else { "" }
            latestPatchDate = if ($lastPatch -and $lastPatch.InstalledOn) { 
                $lastPatch.InstalledOn.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") 
            } else { 
                (Get-Date).AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") 
            }
        }
    }
    catch {
        Write-Warning "Could not retrieve patch information: $_"
        return [PSCustomObject]@{
            totalPatches = 0
            latestPatchId = ""
            latestPatchDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
}

# Main execution
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Secure Habit Security Scanner" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$timestamp = Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ"
Write-Host "Scan started: $timestamp" -ForegroundColor Green
Write-Host "Agent version: $AGENT_VERSION" -ForegroundColor Green
Write-Host ""

# Gather system information
Write-Host "[1/5] Gathering Device Identity..." -ForegroundColor Yellow
$cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
$bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
$deviceID = Get-StableDeviceID

Write-Host "[2/5] Gathering OS Information..." -ForegroundColor Yellow
$os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue

Write-Host "[3/5] Scanning Installed Software..." -ForegroundColor Yellow
$software = Get-InstalledSoftware
Write-Host "Found $($software.Count) installed applications" -ForegroundColor Green

Write-Host "[4/5] Gathering Browser Extensions..." -ForegroundColor Yellow
$browserExtensions = Get-BrowserExtensions
Write-Host "Found $($browserExtensions.Count) browser extensions" -ForegroundColor Green

Write-Host "[5/5] Analyzing Patch Status..." -ForegroundColor Yellow
$patchInfo = Get-PatchStatus
Write-Host "Found $($patchInfo.totalPatches) installed patches" -ForegroundColor Green

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
        serialNumber = $bios.SerialNumber
    }
    software = $software
    browserExtensions = $browserExtensions
    patches = @{
        totalPatches = $patchInfo.totalPatches
        latestPatchId = $patchInfo.latestPatchId
        latestPatchDate = $patchInfo.latestPatchDate
    }
    agentVersion = $AGENT_VERSION
    scanType = "inventory"
} | ConvertTo-Json -Depth 10

# Submit scan with retry logic
Write-Host ""
Write-Host "Submitting scan data..." -ForegroundColor Yellow

$maxRetries = 3
$retryDelay = 5

for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
    try {
        $headers = @{
            "Authorization" = "Bearer $API_KEY"
            "X-User-Email" = $USER_EMAIL
            "Content-Type" = "application/json; charset=utf-8"
            "User-Agent" = "SecureHabit-Agent/$AGENT_VERSION"
        }
        
        Write-Host "Attempt $attempt of $maxRetries..." -ForegroundColor Yellow
        $response = Invoke-RestMethod -Uri $API_ENDPOINT -Method Post -Headers $headers -Body $scanData -TimeoutSec 120 -ErrorAction Stop
        
        Write-Host ""
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host "Scan submitted successfully!" -ForegroundColor Green
        Write-Host "Scan ID: $($response.scanId)" -ForegroundColor Green
        Write-Host "=====================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Check your dashboard for results: https://secure-habit.onrender.com/dashboard" -ForegroundColor Cyan
        
        # Register agent after successful scan
        try {
            $agentData = @{
                deviceId = $deviceID
                deviceName = $env:COMPUTERNAME
                version = $AGENT_VERSION
                systemInfo = @{
                    computerName = $env:COMPUTERNAME
                    osName = $os.Caption
                    osVersion = $os.Version
                    architecture = $os.OSArchitecture
                    manufacturer = $cs.Manufacturer
                    model = $cs.Model
                }
                status = "active"
                timestamp = $timestamp
            } | ConvertTo-Json -Depth 10
            
            $agentEndpoint = $API_ENDPOINT.Replace("/scan/submit", "/agent/register")
            Invoke-RestMethod -Uri $agentEndpoint -Method Post -Headers $headers -Body $agentData -TimeoutSec 30 -ErrorAction SilentlyContinue
        }
        catch {
            # Agent registration failure is not critical
            Write-Warning "Agent registration failed: $_"
        }
        
        break # Success, exit retry loop
    }
    catch {
        $errorMessage = $_.Exception.Message
        Write-Host "Attempt $attempt failed: $errorMessage" -ForegroundColor Red
        
        if ($attempt -eq $maxRetries) {
            Write-Host ""
            Write-Host "=====================================" -ForegroundColor Red
            Write-Host "Error submitting scan after $maxRetries attempts:" -ForegroundColor Red
            Write-Host $errorMessage -ForegroundColor Red
            Write-Host "=====================================" -ForegroundColor Red
            Write-Host ""
            Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
            exit 1
        }
        
        Write-Host "Waiting $retryDelay seconds before retry..." -ForegroundColor Yellow
        Start-Sleep -Seconds $retryDelay
        $retryDelay *= 2 # Exponential backoff
    }
}

Write-Host ""
Write-Host "Scan completed!" -ForegroundColor Green


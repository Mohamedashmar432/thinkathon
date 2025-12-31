@echo off
REM Secure Habit Agent - Self-Extracting Installer
REM This file contains the PowerShell agent embedded within it

title Secure Habit - Security Agent Installer

echo.
echo ==========================================
echo    Secure Habit - Security Agent
echo ==========================================
echo.
echo Welcome to Secure Habit Security Agent
echo.
echo This agent will:
echo  - Scan your system for security vulnerabilities
echo  - Identify outdated software and patches  
echo  - Send encrypted results to your dashboard
echo  - Complete in 2-5 minutes
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% == 0 (
    echo ✓ Administrator privileges confirmed
    goto :extract_and_run
) else (
    echo ⚠ Administrator privileges required
    echo.
    echo Requesting administrator access...
    echo Please click "Yes" when prompted.
    echo.
    REM Re-run this batch file as administrator
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:extract_and_run
echo.
echo ==========================================
echo        Starting Security Scan
echo ==========================================
echo.

REM Create temporary directory for agent
set TEMP_DIR=%TEMP%\SecureHabitAgent_%RANDOM%
mkdir "%TEMP_DIR%" 2>nul

REM Extract PowerShell script from this batch file (after the marker)
echo Extracting agent components...
for /f "tokens=1* delims=:" %%a in ('findstr /n "REM_POWERSHELL_START" "%~f0"') do set START_LINE=%%a
set /a START_LINE+=1
more +%START_LINE% "%~f0" > "%TEMP_DIR%\agent.ps1"

REM Execute the PowerShell agent
echo Running security scan...
echo.
powershell -ExecutionPolicy Bypass -WindowStyle Normal -File "%TEMP_DIR%\agent.ps1" -Silent

REM Check execution result
if %errorLevel% == 0 (
    echo.
    echo ==========================================
    echo   ✓ Security Scan Completed Successfully
    echo ==========================================
    echo.
    echo Your device has been scanned and the results
    echo have been securely sent to your Secure Habit
    echo dashboard.
    echo.
    echo 🌐 Visit your dashboard to view:
    echo   - Security score and recommendations
    echo   - Detected vulnerabilities  
    echo   - Software inventory
    echo   - Improvement suggestions
    echo.
) else (
    echo.
    echo ==========================================
    echo      ⚠ Security Scan Error
    echo ==========================================
    echo.
    echo The security scan encountered an issue.
    echo This could be due to:
    echo   - Network connectivity problems
    echo   - Firewall blocking the connection
    echo   - Antivirus interference
    echo.
    echo Please try again or contact support.
    echo.
)

REM Cleanup
del /q "%TEMP_DIR%\agent.ps1" 2>nul
rmdir "%TEMP_DIR%" 2>nul

echo Press any key to close this window...
pause >nul
exit /b

REM_POWERSHELL_START
#Requires -RunAsAdministrator

<#
.SYNOPSIS
    Secure Habit - Endpoint Security Agent
.DESCRIPTION
    Silent background agent that scans for vulnerabilities and sends data to Secure Habit platform
.NOTES
    Requires Administrator privileges
    Generated for: {{USER_EMAIL}}
#>

param(
    [switch]$Silent = $true
)

# Hide PowerShell window for silent execution
Add-Type -Name Window -Namespace Console -MemberDefinition '
[DllImport("Kernel32.dll")]
public static extern IntPtr GetConsoleWindow();
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, Int32 nCmdShow);
'

if ($Silent) {
    $consolePtr = [Console.Window]::GetConsoleWindow()
    [Console.Window]::ShowWindow($consolePtr, 0) # 0 = Hide
}

# Configuration - These will be replaced with actual user credentials at download time
$API_ENDPOINT = "{{API_ENDPOINT}}"
$API_KEY = "{{API_KEY}}"
$USER_EMAIL = "{{USER_EMAIL}}"
$AGENT_VERSION = "2.0.0"

# Logging
$LOG_DIR = "$env:TEMP\SecureHabit"
if (!(Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}
$LOG_FILE = "$LOG_DIR\agent.log"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

function Show-Notification {
    param(
        [string]$Title,
        [string]$Message,
        [string]$Icon = "Info"
    )
    
    try {
        Add-Type -AssemblyName System.Windows.Forms
        $notification = New-Object System.Windows.Forms.NotifyIcon
        $notification.Icon = [System.Drawing.SystemIcons]::Information
        $notification.BalloonTipIcon = $Icon
        $notification.BalloonTipText = $Message
        $notification.BalloonTipTitle = $Title
        $notification.Visible = $true
        $notification.ShowBalloonTip(5000)
        
        Start-Sleep -Seconds 2
        $notification.Dispose()
    }
    catch {
        Write-Log "Failed to show notification: $_"
    }
}

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
        Write-Log "Could not generate stable device ID: $_"
        return "DEVICE_$(Get-Random -Maximum 999999)"
    }
}

function Get-SystemInfo {
    try {
        $cs = Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        $bios = Get-CimInstance Win32_BIOS -ErrorAction SilentlyContinue
        
        return @{
            computerName = $env:COMPUTERNAME
            osName = $os.Caption
            osVersion = $os.Version
            osBuild = $os.BuildNumber
            architecture = $os.OSArchitecture
            manufacturer = $cs.Manufacturer
            model = $cs.Model
            serialNumber = $bios.SerialNumber
        }
    }
    catch {
        Write-Log "Error getting system info: $_"
        return @{
            computerName = $env:COMPUTERNAME
            osName = "Windows"
            osVersion = "Unknown"
            osBuild = "Unknown"
            architecture = "x64"
            manufacturer = "Unknown"
            model = "Unknown"
            serialNumber = "Unknown"
        }
    }
}

function Get-InstalledSoftware {
    Write-Log "Scanning installed software..."
    $software = @()
    $regPaths = @(
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Wow6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    
    $processedNames = @{}
    
    foreach ($path in $regPaths) {
        try {
            Write-Log "Scanning registry path: $path"
            $items = Get-ItemProperty $path -ErrorAction SilentlyContinue
            
            if ($items) {
                Write-Log "Found $($items.Count) registry entries in $path"
                
                foreach ($item in $items) {
                    if ($item.DisplayName -and $item.DisplayName.Trim() -ne "") {
                        $displayName = $item.DisplayName.Trim()
                        
                        # Skip system updates and duplicates
                        if ($displayName -match "^(KB\d+|Update for|Security Update|Hotfix|Microsoft Visual C\+\+ \d+ x\d+ Redistributable)") {
                            continue
                        }
                        
                        # Avoid duplicates by checking if we've already processed this software
                        $key = "$displayName|$($item.DisplayVersion)"
                        if ($processedNames.ContainsKey($key)) {
                            continue
                        }
                        $processedNames[$key] = $true
                        
                        $softwareItem = @{
                            name = $displayName
                            version = if ($item.DisplayVersion) { $item.DisplayVersion.Trim() } else { "Unknown" }
                            publisher = if ($item.Publisher) { $item.Publisher.Trim() } else { "Unknown" }
                            installDate = if ($item.InstallDate) { 
                                try {
                                    # Convert YYYYMMDD format to readable date
                                    $dateStr = $item.InstallDate.ToString()
                                    if ($dateStr.Length -eq 8) {
                                        $year = $dateStr.Substring(0, 4)
                                        $month = $dateStr.Substring(4, 2)
                                        $day = $dateStr.Substring(6, 2)
                                        "$year-$month-$day"
                                    } else {
                                        $dateStr
                                    }
                                } catch {
                                    $item.InstallDate.ToString()
                                }
                            } else { "" }
                            uninstallString = if ($item.UninstallString) { $item.UninstallString } else { "" }
                        }
                        
                        $software += $softwareItem
                    }
                }
            }
        }
        catch {
            Write-Log "Could not access registry path: $path - $_"
        }
    }
    
    # Additional software detection via WMI (for better coverage)
    try {
        Write-Log "Scanning WMI for additional software..."
        $wmiSoftware = Get-CimInstance -ClassName Win32_Product -ErrorAction SilentlyContinue | Where-Object { 
            $_.Name -and $_.Name.Trim() -ne "" 
        }
        
        foreach ($wmiItem in $wmiSoftware) {
            $displayName = $wmiItem.Name.Trim()
            $version = if ($wmiItem.Version) { $wmiItem.Version.Trim() } else { "Unknown" }
            $key = "$displayName|$version"
            
            if (-not $processedNames.ContainsKey($key)) {
                $processedNames[$key] = $true
                
                $softwareItem = @{
                    name = $displayName
                    version = $version
                    publisher = if ($wmiItem.Vendor) { $wmiItem.Vendor.Trim() } else { "Unknown" }
                    installDate = if ($wmiItem.InstallDate) { 
                        try {
                            $wmiItem.InstallDate.ToString("yyyy-MM-dd")
                        } catch {
                            ""
                        }
                    } else { "" }
                    uninstallString = ""
                }
                
                $software += $softwareItem
            }
        }
    }
    catch {
        Write-Log "WMI software scan failed: $_"
    }
    
    # Sort and ensure we have valid data
    $uniqueSoftware = $software | Sort-Object name | Where-Object { 
        $_.name -and $_.name.Length -gt 2 
    }
    
    Write-Log "Found $($uniqueSoftware.Count) unique installed applications"
    
    # Log first few items for debugging
    if ($uniqueSoftware.Count -gt 0) {
        Write-Log "Sample software items:"
        for ($i = 0; $i -lt [Math]::Min(5, $uniqueSoftware.Count); $i++) {
            Write-Log "  - $($uniqueSoftware[$i].name) v$($uniqueSoftware[$i].version)"
        }
    }
    
    return $uniqueSoftware
}

function Get-BrowserExtensions {
    Write-Log "Scanning browser extensions..."
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
                            $extensions += @{
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
            Write-Log "Error scanning Chrome extensions: $_"
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
                            $extensions += @{
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
            Write-Log "Error scanning Edge extensions: $_"
        }
    }
    
    Write-Log "Found $($extensions.Count) browser extensions"
    return $extensions
}

function Get-PatchInfo {
    Write-Log "Scanning system patches..."
    try {
        $patches = Get-HotFix -ErrorAction SilentlyContinue | Sort-Object InstalledOn -Descending
        $latest = $patches | Select-Object -First 1
        
        $patchInfo = @{
            totalPatches = $patches.Count
            latestPatchId = if ($latest) { $latest.HotFixID } else { "" }
            latestPatchDate = if ($latest -and $latest.InstalledOn) { 
                $latest.InstalledOn.ToString("yyyy-MM-ddTHH:mm:ss.fffZ") 
            } else { 
                (Get-Date).AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ss.fffZ") 
            }
        }
        
        Write-Log "Found $($patchInfo.totalPatches) installed patches"
        return $patchInfo
    }
    catch {
        Write-Log "Error getting patch info: $_"
        return @{
            totalPatches = 0
            latestPatchId = ""
            latestPatchDate = (Get-Date).AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
    }
}

function Submit-InventoryData {
    param($InventoryData)
    
    Write-Log "Submitting inventory data to Secure Habit platform..."
    
    try {
        # Validate data before submission
        Write-Log "Validating inventory data..."
        if (-not $InventoryData.deviceId) {
            throw "Device ID is missing"
        }
        if (-not $InventoryData.systemInfo) {
            throw "System info is missing"
        }
        
        # Ensure arrays are properly formatted
        if (-not $InventoryData.software) {
            $InventoryData.software = @()
        }
        if (-not $InventoryData.browserExtensions) {
            $InventoryData.browserExtensions = @()
        }
        
        # Convert to JSON with proper formatting for production
        Write-Log "Converting data to JSON..."
        $jsonData = $InventoryData | ConvertTo-Json -Depth 10 -Compress:$false
        
        # Validate JSON is not empty or malformed
        if (-not $jsonData -or $jsonData.Length -lt 50) {
            throw "Generated JSON is too small or empty"
        }
        
        # Log the data being sent for debugging (first 500 chars)
        $jsonPreview = if ($jsonData.Length -gt 500) { 
            $jsonData.Substring(0, 500) + "..." 
        } else { 
            $jsonData 
        }
        Write-Log "JSON preview: $jsonPreview"
        Write-Log "Software count: $($InventoryData.software.Count)"
        Write-Log "Browser extensions count: $($InventoryData.browserExtensions.Count)"
        Write-Log "JSON payload size: $($jsonData.Length) bytes"
        
        # Prepare headers with proper encoding
        $headers = @{
            "Authorization" = "Bearer $API_KEY"
            "X-User-Email" = $USER_EMAIL
            "Content-Type" = "application/json; charset=utf-8"
            "User-Agent" = "SecureHabit-Agent/$AGENT_VERSION"
            "Accept" = "application/json"
        }
        
        Write-Log "Sending data to: $API_ENDPOINT"
        Write-Log "Using API key: $($API_KEY.Substring(0, 8))..."
        Write-Log "User email: $USER_EMAIL"
        
        # Make request with extended timeout and retry logic
        $maxRetries = 3
        $retryDelay = 5
        $response = $null
        
        for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
            try {
                Write-Log "Attempt $attempt of $maxRetries..."
                
                # Use Invoke-WebRequest for better error handling
                $webResponse = Invoke-WebRequest -Uri $API_ENDPOINT -Method POST -Body $jsonData -Headers $headers -TimeoutSec 120 -UseBasicParsing
                
                # Parse response
                $response = $webResponse.Content | ConvertFrom-Json
                
                Write-Log "HTTP Status: $($webResponse.StatusCode)"
                Write-Log "Response: $($response | ConvertTo-Json -Compress)"
                
                # If we get here, the request succeeded
                break
            }
            catch {
                $statusCode = $_.Exception.Response.StatusCode.value__
                $errorBody = ""
                
                try {
                    if ($_.Exception.Response) {
                        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                        $errorBody = $reader.ReadToEnd()
                        $reader.Close()
                    }
                }
                catch {
                    $errorBody = "Could not read error response"
                }
                
                Write-Log "Attempt $attempt failed"
                Write-Log "Status Code: $statusCode"
                Write-Log "Error: $($_.Exception.Message)"
                Write-Log "Error Body: $errorBody"
                
                if ($attempt -eq $maxRetries) {
                    # Last attempt failed, re-throw the error
                    throw $_
                }
                
                # Wait before retry
                Write-Log "Waiting $retryDelay seconds before retry..."
                Start-Sleep -Seconds $retryDelay
                $retryDelay *= 2 # Exponential backoff
            }
        }
        
        # Process successful response
        if ($response -and $response.success) {
            Write-Log "✅ Inventory data submitted successfully. Scan ID: $($response.scanId)"
            Write-Log "Response: $($response | ConvertTo-Json -Compress)"
            
            # Register agent with backend after successful scan submission
            Register-Agent -DeviceId $InventoryData.deviceId -SystemInfo $InventoryData.systemInfo
            
            Show-Notification -Title "Secure Habit" -Message "Security scan completed successfully! Check your dashboard for results." -Icon "Info"
            
            # Wait for analysis to complete
            Write-Log "Waiting for vulnerability analysis to complete..."
            Start-Sleep -Seconds 5
            
            return $true
        } else {
            $errorMsg = if ($response.message) { $response.message } else { "Unknown error - no response received" }
            Write-Log "❌ Failed to submit inventory data: $errorMsg"
            Write-Log "Full response: $($response | ConvertTo-Json -Compress)"
            Show-Notification -Title "Secure Habit" -Message "Security scan failed: $errorMsg" -Icon "Warning"
            return $false
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
        $statusCode = $_.Exception.Response.StatusCode.value__ 
        
        Write-Log "❌ Error submitting inventory data: $errorMessage"
        Write-Log "Status code: $statusCode"
        Write-Log "Stack trace: $($_.ScriptStackTrace)"
        
        # Provide specific error messages based on status code
        if ($statusCode -eq 401) {
            $userMessage = "Authentication failed. Please re-download the agent from your dashboard."
        } elseif ($statusCode -eq 400) {
            $userMessage = "Invalid data format. Please contact support."
        } elseif ($statusCode -eq 429) {
            $userMessage = "Too many requests. Please wait a few minutes and try again."
        } elseif ($statusCode -eq 500) {
            $userMessage = "Server error. Please try again later."
        } elseif ($errorMessage -match "timeout|network|connection") {
            $userMessage = "Network timeout. Please check your internet connection and try again."
        } else {
            $userMessage = "Unable to connect to Secure Habit platform. Please check your internet connection."
        }
        
        Show-Notification -Title "Secure Habit" -Message $userMessage -Icon "Error"
        return $false
    }
}

function Register-Agent {
    param(
        [string]$DeviceId,
        [hashtable]$SystemInfo
    )
    
    Write-Log "Registering agent with backend..."
    
    try {
        $agentData = @{
            deviceId = $DeviceId
            deviceName = $SystemInfo.computerName
            version = $AGENT_VERSION
            systemInfo = $SystemInfo
            status = "active"
            timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        }
        
        $jsonData = $agentData | ConvertTo-Json -Depth 10 -Compress
        
        $headers = @{
            "Authorization" = "Bearer $API_KEY"
            "X-User-Email" = $USER_EMAIL
            "Content-Type" = "application/json"
            "User-Agent" = "SecureHabit-Agent/$AGENT_VERSION"
        }
        
        $agentEndpoint = $API_ENDPOINT.Replace("/scan/submit", "/agent/register")
        Write-Log "Registering agent at: $agentEndpoint"
        
        $response = Invoke-RestMethod -Uri $agentEndpoint -Method POST -Body $jsonData -Headers $headers -TimeoutSec 30
        
        if ($response.success) {
            Write-Log "✅ Agent registered successfully"
            Write-Log "Agent ID: $($response.agentId)"
        } else {
            Write-Log "⚠️ Agent registration failed: $($response.message)"
        }
    }
    catch {
        Write-Log "⚠️ Error registering agent: $($_.Exception.Message)"
        # Don't fail the entire process if agent registration fails
    }
}

# Main execution
try {
    Write-Log "=== Secure Habit Agent Started ==="
    Write-Log "Version: $AGENT_VERSION"
    Write-Log "User: $USER_EMAIL"
    
    Show-Notification -Title "Secure Habit" -Message "Starting security scan..." -Icon "Info"
    
    # Get device information
    $deviceId = Get-StableDeviceID
    $systemInfo = Get-SystemInfo
    Write-Log "Device ID: $deviceId"
    Write-Log "System: $($systemInfo.osName) $($systemInfo.osVersion)"
    
    # Collect inventory data with detailed logging
    Write-Log "Starting software inventory collection..."
    $software = Get-InstalledSoftware
    Write-Log "Software collection completed: $($software.Count) items"
    
    Write-Log "Starting browser extension scan..."
    $browserExtensions = Get-BrowserExtensions
    Write-Log "Browser extension scan completed: $($browserExtensions.Count) items"
    
    Write-Log "Starting patch information collection..."
    $patches = Get-PatchInfo
    Write-Log "Patch information collected: $($patches.totalPatches) patches"
    
    # Validate collected data before submission
    if ($software.Count -eq 0) {
        Write-Log "⚠️ WARNING: No software detected! This may indicate a collection issue."
        Write-Log "Attempting alternative software collection method..."
        
        # Try alternative collection using Get-ItemProperty directly
        try {
            $altSoftware = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | 
                Where-Object { $_.DisplayName -and $_.DisplayName.Trim() -ne "" } | 
                Select-Object @{Name="name";Expression={$_.DisplayName.Trim()}}, 
                             @{Name="version";Expression={if($_.DisplayVersion){$_.DisplayVersion.Trim()}else{"Unknown"}}}, 
                             @{Name="publisher";Expression={if($_.Publisher){$_.Publisher.Trim()}else{"Unknown"}}}, 
                             @{Name="installDate";Expression={if($_.InstallDate){$_.InstallDate}else{""}}}
            
            if ($altSoftware -and $altSoftware.Count -gt 0) {
                $software = @($altSoftware)
                Write-Log "Alternative collection found $($software.Count) software items"
            } else {
                Write-Log "Alternative collection also failed - proceeding with empty software list"
                $software = @()
            }
        }
        catch {
            Write-Log "Alternative collection failed: $_"
            $software = @()
        }
    }
    
    # Prepare inventory payload with explicit array conversion and validation
    # Ensure software is always a proper JSON array
    $softwareArray = if ($software -and $software.Count -gt 0) { 
        @($software) 
    } else { 
        @() # Empty array
    }
    
    # Ensure browser extensions is always a proper JSON array
    $extensionsArray = if ($browserExtensions -and $browserExtensions.Count -gt 0) { 
        @($browserExtensions) 
    } else { 
        @() # Empty array
    }
    
    $inventoryData = @{
        deviceId = $deviceId
        scanTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.000Z")
        systemInfo = $systemInfo
        software = $softwareArray
        browserExtensions = $extensionsArray
        patches = $patches
        agentVersion = $AGENT_VERSION
        scanType = "inventory"
    }
    
    Write-Log "Inventory collection completed:"
    Write-Log "- Software: $($inventoryData.software.Count) applications"
    Write-Log "- Browser Extensions: $($inventoryData.browserExtensions.Count) extensions"
    Write-Log "- Patches: $($patches.totalPatches) patches"
    Write-Log "- System Info: $($systemInfo.osName) $($systemInfo.osVersion)"
    
    # Validate payload before submission
    if ($inventoryData.software.Count -eq 0) {
        Write-Log "⚠️ CRITICAL: Software array is empty before submission!"
        # Try alternative collection method
        Write-Log "Attempting alternative software collection..."
        try {
            $altSoftware = Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" | 
                Where-Object { $_.DisplayName } | 
                Select-Object @{Name="name";Expression={$_.DisplayName}}, 
                             @{Name="version";Expression={$_.DisplayVersion}}, 
                             @{Name="publisher";Expression={$_.Publisher}}, 
                             @{Name="installDate";Expression={$_.InstallDate}}
            
            if ($altSoftware.Count -gt 0) {
                $inventoryData.software = @($altSoftware)
                Write-Log "Alternative collection found $($altSoftware.Count) software items"
            }
        }
        catch {
            Write-Log "Alternative collection also failed: $_"
        }
    }
    
    # Submit to backend
    $success = Submit-InventoryData -InventoryData $inventoryData
    
    if ($success) {
        Write-Log "=== Secure Habit Agent Completed Successfully ==="
    } else {
        Write-Log "=== Secure Habit Agent Completed with Errors ==="
    }
}
catch {
    Write-Log "❌ Fatal error in Secure Habit Agent: $_"
    Write-Log "Stack trace: $($_.ScriptStackTrace)"
    Show-Notification -Title "Secure Habit" -Message "Security scan encountered an error." -Icon "Error"
}

# Clean exit
if ($Silent) {
    Start-Sleep -Seconds 3 # Allow notification to show
}

Write-Log "Agent execution finished"
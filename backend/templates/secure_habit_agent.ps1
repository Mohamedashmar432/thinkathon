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

# Configuration
$API_ENDPOINT = "{{API_ENDPOINT}}"
$API_KEY = "{{API_KEY}}"
$USER_EMAIL = "{{USER_EMAIL}}"
$AGENT_VERSION = "1.0.0"

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
        # Convert to JSON with proper depth and formatting
        $jsonData = $InventoryData | ConvertTo-Json -Depth 20 -Compress
        
        # Log the data being sent for debugging
        Write-Log "Software count: $($InventoryData.software.Count)"
        Write-Log "Browser extensions count: $($InventoryData.browserExtensions.Count)"
        Write-Log "JSON payload size: $($jsonData.Length) bytes"
        
        # Debug: Log first few software items
        if ($InventoryData.software.Count -gt 0) {
            Write-Log "First software item: $($InventoryData.software[0].name)"
            if ($InventoryData.software.Count -gt 1) {
                Write-Log "Second software item: $($InventoryData.software[1].name)"
            }
        }
        
        $headers = @{
            "Authorization" = "Bearer $API_KEY"
            "X-User-Email" = $USER_EMAIL
            "Content-Type" = "application/json"
            "User-Agent" = "SecureHabit-Agent/$AGENT_VERSION"
        }
        
        Write-Log "Sending data to: $API_ENDPOINT"
        
        $response = Invoke-RestMethod -Uri $API_ENDPOINT -Method POST -Body $jsonData -Headers $headers -TimeoutSec 60
        
        if ($response.success) {
            Write-Log "✅ Inventory data submitted successfully. Scan ID: $($response.scanId)"
            
            # Register agent with backend after successful scan submission
            Register-Agent -DeviceId $InventoryData.deviceId -SystemInfo $InventoryData.systemInfo
            
            Show-Notification -Title "Secure Habit" -Message "Security scan completed successfully! Check your dashboard for results." -Icon "Info"
            
            # Wait for analysis to complete
            Write-Log "Waiting for vulnerability analysis to complete..."
            Start-Sleep -Seconds 5
            
            return $true
        } else {
            Write-Log "❌ Failed to submit inventory data: $($response.message)"
            Show-Notification -Title "Secure Habit" -Message "Security scan failed: $($response.message)" -Icon "Warning"
            return $false
        }
    }
    catch {
        $errorMessage = $_.Exception.Message
        Write-Log "❌ Error submitting inventory data: $errorMessage"
        
        if ($errorMessage -match "401|Unauthorized") {
            Show-Notification -Title "Secure Habit" -Message "Authentication failed. Please re-download the agent." -Icon "Error"
        } elseif ($errorMessage -match "timeout|network") {
            Show-Notification -Title "Secure Habit" -Message "Network timeout. Please check your internet connection." -Icon "Error"
        } else {
            Show-Notification -Title "Secure Habit" -Message "Unable to connect to Secure Habit platform. Please try again." -Icon "Error"
        }
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
    
    # Validate collected data
    if ($software.Count -eq 0) {
        Write-Log "⚠️ WARNING: No software detected! This may indicate a collection issue."
    }
    
    # Prepare inventory payload with explicit array conversion
    $inventoryData = @{
        deviceId = $deviceId
        scanTimestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
        systemInfo = $systemInfo
        software = @($software)  # Ensure it's an array
        browserExtensions = @($browserExtensions)  # Ensure it's an array
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
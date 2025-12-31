#!/bin/bash

# Secure Habit - macOS Security Agent
# Requires administrator privileges for comprehensive system scanning
# Generated for: {{USER_EMAIL}}

set -euo pipefail

# Configuration
API_ENDPOINT="{{API_ENDPOINT}}"
API_KEY="{{API_KEY}}"
USER_EMAIL="{{USER_EMAIL}}"
AGENT_VERSION="1.0.0"

# Logging
LOG_DIR="/tmp/secure-habit"
LOG_FILE="$LOG_DIR/agent.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create log directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" >> "$LOG_FILE"
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $message"
}

# Error logging
log_error() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] ERROR: $message" >> "$LOG_FILE"
    echo -e "${RED}[ERROR]${NC} $message" >&2
}

# Success logging
log_success() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] SUCCESS: $message" >> "$LOG_FILE"
    echo -e "${GREEN}[SUCCESS]${NC} $message"
}

# Warning logging
log_warning() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] WARNING: $message" >> "$LOG_FILE"
    echo -e "${YELLOW}[WARNING]${NC} $message"
}

# Check if running with admin privileges
check_admin() {
    if [[ $EUID -ne 0 ]]; then
        log "Requesting administrator privileges..."
        echo -e "${YELLOW}Administrator privileges required for comprehensive scanning.${NC}"
        echo "Please enter your password when prompted."
        
        # Re-run script with sudo
        exec sudo "$0" "$@"
    fi
}

# Show macOS notification
show_notification() {
    local title="$1"
    local message="$2"
    local sound="${3:-default}"
    
    osascript -e "display notification \"$message\" with title \"$title\" sound name \"$sound\"" 2>/dev/null || true
}

# Generate stable device ID
get_device_id() {
    local hardware_uuid=""
    
    # Try to get hardware UUID
    if command -v system_profiler >/dev/null 2>&1; then
        hardware_uuid=$(system_profiler SPHardwareDataType | grep "Hardware UUID" | awk '{print $3}' 2>/dev/null || echo "")
    fi
    
    # Fallback to IOPlatformUUID
    if [[ -z "$hardware_uuid" ]]; then
        hardware_uuid=$(ioreg -d2 -c IOPlatformExpertDevice | awk -F\" '/IOPlatformUUID/{print $(NF-1)}' 2>/dev/null || echo "")
    fi
    
    # Final fallback
    if [[ -z "$hardware_uuid" ]]; then
        local hostname=$(hostname 2>/dev/null || echo "unknown")
        local serial=$(system_profiler SPHardwareDataType | grep "Serial Number" | awk '{print $4}' 2>/dev/null || echo "unknown")
        hardware_uuid="${hostname}_${serial}"
    fi
    
    # Generate final device ID
    echo "MACOS_$(echo "$hardware_uuid" | shasum -a 256 | cut -d' ' -f1 | head -c 32)"
}

# Get system information
get_system_info() {
    local os_name="macOS"
    local os_version=$(sw_vers -productVersion 2>/dev/null || echo "Unknown")
    local build_version=$(sw_vers -buildVersion 2>/dev/null || echo "Unknown")
    local architecture=$(uname -m 2>/dev/null || echo "unknown")
    local hostname=$(hostname 2>/dev/null || echo "unknown")
    
    # Get hardware information
    local manufacturer="Apple Inc."
    local model="Unknown"
    
    if command -v system_profiler >/dev/null 2>&1; then
        model=$(system_profiler SPHardwareDataType | grep "Model Name" | cut -d: -f2 | xargs 2>/dev/null || echo "Unknown")
        if [[ -z "$model" || "$model" == "Unknown" ]]; then
            model=$(system_profiler SPHardwareDataType | grep "Model Identifier" | cut -d: -f2 | xargs 2>/dev/null || echo "Unknown")
        fi
    fi
    
    cat << EOF
{
    "computerName": "$hostname",
    "osName": "$os_name",
    "osVersion": "$os_version",
    "osBuild": "$build_version",
    "architecture": "$architecture",
    "manufacturer": "$manufacturer",
    "model": "$model"
}
EOF
}

# Get installed applications
get_installed_software() {
    log "Scanning installed applications..."
    
    local packages_json="["
    local first=true
    
    # Function to add application to JSON
    add_application() {
        local name="$1"
        local version="$2"
        local bundle_id="$3"
        local source="$4"
        
        # Skip empty names
        [[ -z "$name" ]] && return
        
        # Escape JSON strings
        name=$(echo "$name" | sed 's/"/\\"/g' | sed "s/'/\\'/g")
        version=$(echo "$version" | sed 's/"/\\"/g')
        bundle_id=$(echo "$bundle_id" | sed 's/"/\\"/g')
        source=$(echo "$source" | sed 's/"/\\"/g')
        
        if [[ "$first" == true ]]; then
            first=false
        else
            packages_json+=","
        fi
        
        packages_json+="{\"name\":\"$name\",\"version\":\"$version\",\"publisher\":\"$source\",\"bundleId\":\"$bundle_id\",\"installDate\":\"\",\"uninstallString\":\"\"}"
    }
    
    # Scan /Applications directory
    log "Scanning /Applications directory..."
    if [[ -d "/Applications" ]]; then
        find /Applications -name "*.app" -maxdepth 2 -type d 2>/dev/null | while read -r app_path; do
            local app_name=$(basename "$app_path" .app)
            local info_plist="$app_path/Contents/Info.plist"
            local version="Unknown"
            local bundle_id="Unknown"
            
            if [[ -f "$info_plist" ]]; then
                # Extract version using plutil or defaults
                if command -v plutil >/dev/null 2>&1; then
                    version=$(plutil -extract CFBundleShortVersionString raw "$info_plist" 2>/dev/null || echo "Unknown")
                    bundle_id=$(plutil -extract CFBundleIdentifier raw "$info_plist" 2>/dev/null || echo "Unknown")
                elif command -v defaults >/dev/null 2>&1; then
                    version=$(defaults read "$info_plist" CFBundleShortVersionString 2>/dev/null || echo "Unknown")
                    bundle_id=$(defaults read "$info_plist" CFBundleIdentifier 2>/dev/null || echo "Unknown")
                fi
            fi
            
            add_application "$app_name" "$version" "$bundle_id" "Applications"
        done || true
    fi
    
    # Scan user Applications directory
    log "Scanning ~/Applications directory..."
    if [[ -d "$HOME/Applications" ]]; then
        find "$HOME/Applications" -name "*.app" -maxdepth 2 -type d 2>/dev/null | while read -r app_path; do
            local app_name=$(basename "$app_path" .app)
            local info_plist="$app_path/Contents/Info.plist"
            local version="Unknown"
            local bundle_id="Unknown"
            
            if [[ -f "$info_plist" ]]; then
                if command -v plutil >/dev/null 2>&1; then
                    version=$(plutil -extract CFBundleShortVersionString raw "$info_plist" 2>/dev/null || echo "Unknown")
                    bundle_id=$(plutil -extract CFBundleIdentifier raw "$info_plist" 2>/dev/null || echo "Unknown")
                elif command -v defaults >/dev/null 2>&1; then
                    version=$(defaults read "$info_plist" CFBundleShortVersionString 2>/dev/null || echo "Unknown")
                    bundle_id=$(defaults read "$info_plist" CFBundleIdentifier 2>/dev/null || echo "Unknown")
                fi
            fi
            
            add_application "$app_name" "$version" "$bundle_id" "User Applications"
        done || true
    fi
    
    # Homebrew packages
    if command -v brew >/dev/null 2>&1; then
        log "Scanning Homebrew packages..."
        brew list --formula 2>/dev/null | while read -r formula; do
            local version=$(brew list --versions "$formula" 2>/dev/null | awk '{print $2}' || echo "Unknown")
            add_application "$formula" "$version" "homebrew.$formula" "Homebrew"
        done || true
        
        # Homebrew casks
        brew list --cask 2>/dev/null | while read -r cask; do
            local version=$(brew list --versions --cask "$cask" 2>/dev/null | awk '{print $2}' || echo "Unknown")
            add_application "$cask" "$version" "homebrew.cask.$cask" "Homebrew Cask"
        done || true
    fi
    
    # Mac App Store applications (using system_profiler)
    if command -v system_profiler >/dev/null 2>&1; then
        log "Scanning Mac App Store applications..."
        system_profiler SPApplicationsDataType -xml 2>/dev/null | \
        plutil -convert json -o - - 2>/dev/null | \
        python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    apps = data[0]['_items']
    for app in apps:
        if app.get('obtained_from') == 'mac_app_store':
            name = app.get('_name', 'Unknown')
            version = app.get('version', 'Unknown')
            print(f'{name}|{version}')
except:
    pass
" 2>/dev/null | while IFS='|' read -r name version; do
            add_application "$name" "$version" "mac_app_store.$name" "Mac App Store"
        done || true
    fi
    
    packages_json+="]"
    echo "$packages_json"
}

# Get browser extensions
get_browser_extensions() {
    log "Scanning browser extensions..."
    
    local extensions_json="["
    local first=true
    
    # Function to add extension to JSON
    add_extension() {
        local browser="$1"
        local name="$2"
        local version="$3"
        local ext_id="$4"
        
        # Escape JSON strings
        name=$(echo "$name" | sed 's/"/\\"/g')
        version=$(echo "$version" | sed 's/"/\\"/g')
        
        if [[ "$first" == true ]]; then
            first=false
        else
            extensions_json+=","
        fi
        
        extensions_json+="{\"browser\":\"$browser\",\"name\":\"$name\",\"version\":\"$version\",\"extensionId\":\"$ext_id\"}"
    }
    
    # Chrome extensions
    local chrome_dir="$HOME/Library/Application Support/Google/Chrome/Default/Extensions"
    if [[ -d "$chrome_dir" ]]; then
        log "Scanning Chrome extensions..."
        find "$chrome_dir" -name "manifest.json" -type f 2>/dev/null | while read -r manifest; do
            local ext_dir=$(dirname "$manifest")
            local ext_id=$(basename "$(dirname "$ext_dir")")
            
            if [[ -f "$manifest" ]]; then
                local name=$(grep -o '"name"[[:space:]]*:[[:space:]]*"[^"]*"' "$manifest" 2>/dev/null | cut -d'"' -f4 || echo "Unknown")
                local version=$(grep -o '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$manifest" 2>/dev/null | cut -d'"' -f4 || echo "Unknown")
                
                if [[ "$name" != "Unknown" ]]; then
                    add_extension "Chrome" "$name" "$version" "$ext_id"
                fi
            fi
        done || true
    fi
    
    # Safari extensions (limited access)
    local safari_dir="$HOME/Library/Safari/Extensions"
    if [[ -d "$safari_dir" ]]; then
        log "Scanning Safari extensions..."
        find "$safari_dir" -name "*.safariextz" -type f 2>/dev/null | while read -r ext_file; do
            local name=$(basename "$ext_file" .safariextz)
            add_extension "Safari" "$name" "Unknown" "safari.$name"
        done || true
    fi
    
    # Firefox extensions
    local firefox_dir="$HOME/Library/Application Support/Firefox/Profiles"
    if [[ -d "$firefox_dir" ]]; then
        log "Firefox extensions detected but detailed scanning requires additional permissions"
    fi
    
    extensions_json+="]"
    echo "$extensions_json"
}

# Get system update information
get_patch_info() {
    log "Gathering system update information..."
    
    local total_patches=0
    local latest_patch_date=""
    local latest_patch_id=""
    
    # Check for available software updates
    if command -v softwareupdate >/dev/null 2>&1; then
        # Get available updates (this may take a moment)
        local updates=$(softwareupdate -l 2>/dev/null | grep -c "recommended" || echo "0")
        total_patches=$updates
        latest_patch_date=$(date -Iseconds)
        latest_patch_id="softwareupdate-check"
    fi
    
    # Fallback date if none found
    if [[ -z "$latest_patch_date" ]]; then
        latest_patch_date=$(date -v-30d -Iseconds 2>/dev/null || date -d "30 days ago" -Iseconds)
    fi
    
    cat << EOF
{
    "totalPatches": $total_patches,
    "latestPatchId": "$latest_patch_id",
    "latestPatchDate": "$latest_patch_date"
}
EOF
}

# Submit inventory data to backend
submit_inventory_data() {
    local inventory_data="$1"
    
    log "Submitting inventory data to Secure Habit platform..."
    
    # Create temporary file for JSON data
    local temp_file=$(mktemp)
    echo "$inventory_data" > "$temp_file"
    
    # Submit data using curl
    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "X-User-Email: $USER_EMAIL" \
        -H "Content-Type: application/json" \
        -H "User-Agent: SecureHabit-Agent-macOS/$AGENT_VERSION" \
        --data "@$temp_file" \
        --connect-timeout 30 \
        --max-time 60 \
        "$API_ENDPOINT" 2>/dev/null || echo -e "\n000")
    
    # Clean up temp file
    rm -f "$temp_file"
    
    # Parse response
    local http_code=$(echo "$response" | tail -n1)
    local response_body=$(echo "$response" | head -n -1)
    
    if [[ "$http_code" == "200" ]]; then
        local success=$(echo "$response_body" | grep -o '"success"[[:space:]]*:[[:space:]]*true' || echo "")
        if [[ -n "$success" ]]; then
            local scan_id=$(echo "$response_body" | grep -o '"scanId"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
            log_success "Inventory data submitted successfully. Scan ID: $scan_id"
            
            # Register agent
            register_agent "$device_id" "$system_info_json"
            
            # Show success notification
            show_notification "Secure Habit" "Security scan completed successfully! Check your dashboard for results."
            
            return 0
        else
            local error_msg=$(echo "$response_body" | grep -o '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "Unknown error")
            log_error "Failed to submit inventory data: $error_msg"
            show_notification "Secure Habit" "Security scan failed: $error_msg" "Basso"
            return 1
        fi
    else
        log_error "HTTP error $http_code when submitting inventory data"
        if [[ "$http_code" == "401" ]]; then
            log_error "Authentication failed. Please re-download the agent."
            show_notification "Secure Habit" "Authentication failed. Please re-download the agent." "Basso"
        elif [[ "$http_code" == "000" ]]; then
            log_error "Network connection failed. Please check your internet connection."
            show_notification "Secure Habit" "Network connection failed. Please check your internet connection." "Basso"
        else
            show_notification "Secure Habit" "Security scan encountered an error." "Basso"
        fi
        return 1
    fi
}

# Register agent with backend
register_agent() {
    local device_id="$1"
    local system_info="$2"
    
    log "Registering agent with backend..."
    
    local agent_data=$(cat << EOF
{
    "deviceId": "$device_id",
    "deviceName": "$(hostname)",
    "version": "$AGENT_VERSION",
    "systemInfo": $system_info,
    "status": "active",
    "timestamp": "$(date -Iseconds)"
}
EOF
)
    
    local agent_endpoint="${API_ENDPOINT/\/scan\/submit/\/agent\/register}"
    
    # Create temporary file for JSON data
    local temp_file=$(mktemp)
    echo "$agent_data" > "$temp_file"
    
    local response=$(curl -s -w "\n%{http_code}" \
        -X POST \
        -H "Authorization: Bearer $API_KEY" \
        -H "X-User-Email: $USER_EMAIL" \
        -H "Content-Type: application/json" \
        -H "User-Agent: SecureHabit-Agent-macOS/$AGENT_VERSION" \
        --data "@$temp_file" \
        --connect-timeout 30 \
        --max-time 30 \
        "$agent_endpoint" 2>/dev/null || echo -e "\n000")
    
    # Clean up temp file
    rm -f "$temp_file"
    
    local http_code=$(echo "$response" | tail -n1)
    
    if [[ "$http_code" == "200" ]]; then
        log_success "Agent registered successfully"
    else
        log_warning "Agent registration failed (HTTP $http_code), but scan data was submitted"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "    Secure Habit - macOS Security Agent"
    echo "=========================================="
    echo -e "${NC}"
    echo
    echo "Starting comprehensive security scan..."
    echo "This may take 2-5 minutes depending on system size."
    echo
    
    log "=== Secure Habit macOS Agent Started ==="
    log "Version: $AGENT_VERSION"
    log "User: $USER_EMAIL"
    
    # Show initial notification
    show_notification "Secure Habit" "Starting security scan..."
    
    # Check admin privileges
    check_admin
    
    # Get device information
    local device_id=$(get_device_id)
    log "Device ID: $device_id"
    
    # Get system information
    log "Collecting system information..."
    local system_info_json=$(get_system_info)
    local os_name=$(echo "$system_info_json" | grep -o '"osName"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    local os_version=$(echo "$system_info_json" | grep -o '"osVersion"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    log "System: $os_name $os_version"
    
    # Collect inventory data
    log "Starting application inventory collection..."
    local software_json=$(get_installed_software)
    local software_count=$(echo "$software_json" | grep -o '"name"' | wc -l | xargs)
    log "Application collection completed: $software_count applications"
    
    log "Starting browser extension scan..."
    local extensions_json=$(get_browser_extensions)
    local extensions_count=$(echo "$extensions_json" | grep -o '"name"' | wc -l | xargs)
    log "Browser extension scan completed: $extensions_count extensions"
    
    log "Gathering system update information..."
    local patches_json=$(get_patch_info)
    log "System update information collected"
    
    # Prepare inventory payload
    local inventory_data=$(cat << EOF
{
    "deviceId": "$device_id",
    "scanTimestamp": "$(date -Iseconds)",
    "systemInfo": $system_info_json,
    "software": $software_json,
    "browserExtensions": $extensions_json,
    "patches": $patches_json,
    "agentVersion": "$AGENT_VERSION",
    "scanType": "inventory"
}
EOF
)
    
    log "Inventory collection completed:"
    log "- Applications: $software_count items"
    log "- Browser Extensions: $extensions_count extensions"
    log "- System Info: $os_name $os_version"
    
    # Submit to backend
    if submit_inventory_data "$inventory_data"; then
        echo
        echo -e "${GREEN}=========================================="
        echo "   ✓ Security Scan Completed Successfully"
        echo "==========================================${NC}"
        echo
        echo "Your macOS system has been scanned and the results"
        echo "have been securely sent to your Secure Habit dashboard."
        echo
        echo "🌐 Visit your dashboard to view:"
        echo "  - Security score and recommendations"
        echo "  - Detected vulnerabilities"
        echo "  - Application inventory"
        echo "  - System security posture"
        echo
        log "=== Secure Habit macOS Agent Completed Successfully ==="
    else
        echo
        echo -e "${RED}=========================================="
        echo "      ⚠ Security Scan Error"
        echo "==========================================${NC}"
        echo
        echo "The security scan encountered an issue."
        echo "This could be due to:"
        echo "  - Network connectivity problems"
        echo "  - Firewall blocking the connection"
        echo "  - Authentication issues"
        echo "  - macOS security restrictions"
        echo
        echo "Please check the log file: $LOG_FILE"
        echo "Or try running the agent again."
        echo
        log "=== Secure Habit macOS Agent Completed with Errors ==="
        exit 1
    fi
}

# Trap to ensure cleanup on exit
trap 'log "Agent execution finished"' EXIT

# Run main function
main "$@"
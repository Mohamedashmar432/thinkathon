// Comprehensive Security Recommendations Database
// Based on Microsoft Defender for Business and industry best practices

export interface SecurityRecommendationTemplate {
  id: string;
  title: string;
  description: string;
  action: string;
  whyItMatters: string;
  expectedRiskReduction: number;
  priority: 'high' | 'medium' | 'low';
  category: 'endpoint' | 'system' | 'network' | 'application';
  estimatedTimeMinutes: number;
  triggers: {
    vulnerabilityTypes?: string[];
    softwareNames?: string[];
    osTypes?: string[];
    missingPatches?: boolean;
    outdatedSoftware?: boolean;
    highRiskSoftware?: boolean;
    systemConfiguration?: string[];
  };
  applicableWhen: (scanData: any) => boolean;
}

export const SECURITY_RECOMMENDATIONS: SecurityRecommendationTemplate[] = [
  // Email Security Recommendations
  {
    id: 'email-safe-links',
    title: 'Create Safe Links policies for email messages',
    description: 'Configure Safe Links to protect against malicious URLs in email messages by scanning and rewriting links in real-time.',
    action: 'Enable Safe Links protection in Microsoft Defender for Office 365 to scan all URLs in email messages before users click them.',
    whyItMatters: 'Malicious URLs are a primary attack vector for phishing and malware. Safe Links provides real-time protection against zero-day attacks.',
    expectedRiskReduction: 25,
    priority: 'high',
    category: 'application',
    estimatedTimeMinutes: 15,
    triggers: {
      vulnerabilityTypes: ['phishing', 'malware'],
      softwareNames: ['outlook', 'exchange']
    },
    applicableWhen: (scanData) => scanData.hasEmailClient || scanData.vulnerabilities?.items?.some((v: any) => v.description?.toLowerCase().includes('phishing'))
  },

  // Ransomware Protection
  {
    id: 'ransomware-protection',
    title: 'Use advanced protection against ransomware',
    description: 'Enable advanced ransomware protection features including controlled folder access and behavior monitoring.',
    action: 'Turn on Controlled Folder Access and configure ransomware protection in Windows Security settings.',
    whyItMatters: 'Ransomware attacks can encrypt critical files and demand payment. Advanced protection prevents unauthorized changes to protected folders.',
    expectedRiskReduction: 35,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 10,
    triggers: {
      vulnerabilityTypes: ['ransomware', 'malware'],
      systemConfiguration: ['windows']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Script Execution Protection
  {
    id: 'block-javascript-vbscript',
    title: 'Block JavaScript or VBScript from launching downloaded executable content',
    description: 'Prevent malicious scripts from executing downloaded files that could compromise system security.',
    action: 'Configure Windows Defender Application Control or Group Policy to block script execution of downloaded executables.',
    whyItMatters: 'Malicious scripts are commonly used to download and execute malware, bypassing traditional security measures.',
    expectedRiskReduction: 20,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 20,
    triggers: {
      vulnerabilityTypes: ['script-injection', 'malware'],
      systemConfiguration: ['windows']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Antivirus Protection
  {
    id: 'defender-pua-protection',
    title: 'Turn on Microsoft Defender Antivirus PUA protection in block mode',
    description: 'Enable Potentially Unwanted Application (PUA) protection to block software that may cause unwanted behavior.',
    action: 'Open Windows Security > Virus & threat protection > Manage settings > Turn on PUA protection.',
    whyItMatters: 'PUAs can slow down computers, display unexpected ads, or install other unwanted software.',
    expectedRiskReduction: 15,
    priority: 'medium',
    category: 'system',
    estimatedTimeMinutes: 5,
    triggers: {
      systemConfiguration: ['windows'],
      outdatedSoftware: true
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Office Security
  {
    id: 'block-office-child-processes',
    title: 'Block all Office applications from creating child processes',
    description: 'Prevent Office applications from spawning potentially malicious child processes that could be used in attacks.',
    action: 'Configure Attack Surface Reduction rules in Microsoft Defender for Endpoint to block Office child processes.',
    whyItMatters: 'Office applications are frequently targeted for macro-based attacks that spawn malicious processes.',
    expectedRiskReduction: 30,
    priority: 'high',
    category: 'application',
    estimatedTimeMinutes: 15,
    triggers: {
      softwareNames: ['microsoft office', 'word', 'excel', 'powerpoint', 'outlook'],
      vulnerabilityTypes: ['macro-malware', 'code-injection']
    },
    applicableWhen: (scanData) => scanData.software?.some((s: any) => 
      s.name?.toLowerCase().includes('office') || 
      s.name?.toLowerCase().includes('word') || 
      s.name?.toLowerCase().includes('excel')
    )
  },

  // USB Protection
  {
    id: 'block-usb-processes',
    title: 'Block untrusted and unsigned processes that run from USB',
    description: 'Prevent execution of untrusted programs from removable drives to stop malware propagation.',
    action: 'Enable Device Control policies to block execution of unsigned files from USB drives.',
    whyItMatters: 'USB drives are a common vector for malware distribution and can bypass network security controls.',
    expectedRiskReduction: 25,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 10,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['malware', 'trojan']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Email Client Protection
  {
    id: 'block-email-executable-content',
    title: 'Block executable content from email client and webmail',
    description: 'Prevent email clients from executing potentially malicious attachments and embedded content.',
    action: 'Configure email security policies to block executable attachments and disable automatic execution of email content.',
    whyItMatters: 'Email attachments are a primary delivery method for malware and ransomware attacks.',
    expectedRiskReduction: 30,
    priority: 'high',
    category: 'application',
    estimatedTimeMinutes: 15,
    triggers: {
      softwareNames: ['outlook', 'thunderbird', 'mail'],
      vulnerabilityTypes: ['malware', 'phishing']
    },
    applicableWhen: (scanData) => scanData.software?.some((s: any) => 
      s.name?.toLowerCase().includes('outlook') || 
      s.name?.toLowerCase().includes('mail') || 
      s.name?.toLowerCase().includes('thunderbird')
    )
  },

  // Script Protection
  {
    id: 'block-obfuscated-scripts',
    title: 'Block execution of potentially obfuscated scripts',
    description: 'Prevent execution of scripts that use obfuscation techniques commonly employed by malware.',
    action: 'Enable Attack Surface Reduction rule to block obfuscated PowerShell, JavaScript, and VBScript execution.',
    whyItMatters: 'Obfuscated scripts are often used to hide malicious code and evade detection by security tools.',
    expectedRiskReduction: 25,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 10,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['script-injection', 'malware']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Credential Protection
  {
    id: 'block-credential-stealing',
    title: 'Block credential stealing from the Windows local security authority subsystem (lsass.exe)',
    description: 'Protect against credential theft attacks that target the Local Security Authority Subsystem Service.',
    action: 'Enable LSA Protection and Credential Guard to prevent unauthorized access to stored credentials.',
    whyItMatters: 'Credential theft allows attackers to move laterally through networks and access sensitive resources.',
    expectedRiskReduction: 40,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 20,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['credential-theft', 'privilege-escalation']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Adobe Reader Security
  {
    id: 'block-adobe-child-processes',
    title: 'Block Adobe Reader from creating child processes',
    description: 'Prevent Adobe Reader from spawning potentially malicious child processes that could be exploited.',
    action: 'Configure Attack Surface Reduction rules to block Adobe Reader from creating child processes.',
    whyItMatters: 'PDF files can contain malicious code that exploits Adobe Reader to execute unauthorized processes.',
    expectedRiskReduction: 20,
    priority: 'medium',
    category: 'application',
    estimatedTimeMinutes: 10,
    triggers: {
      softwareNames: ['adobe reader', 'adobe acrobat'],
      vulnerabilityTypes: ['pdf-exploit', 'code-execution']
    },
    applicableWhen: (scanData) => scanData.software?.some((s: any) => 
      s.name?.toLowerCase().includes('adobe') && 
      (s.name?.toLowerCase().includes('reader') || s.name?.toLowerCase().includes('acrobat'))
    )
  },

  // UEFI Security
  {
    id: 'enable-uefi-secure-boot',
    title: 'Enable UEFI Secure Boot mode',
    description: 'Ensure that only trusted operating system bootloaders are allowed to run during system startup.',
    action: 'Access UEFI/BIOS settings and enable Secure Boot to prevent unauthorized bootloader execution.',
    whyItMatters: 'Secure Boot prevents rootkits and bootkits from loading before the operating system starts.',
    expectedRiskReduction: 35,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 15,
    triggers: {
      systemConfiguration: ['windows', 'uefi'],
      vulnerabilityTypes: ['rootkit', 'bootkit']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Network Protection
  {
    id: 'enable-network-protection',
    title: 'Enable Network Protection',
    description: 'Turn on Network Protection to block connections to malicious domains and IP addresses.',
    action: 'Enable Network Protection in Microsoft Defender for Endpoint to block malicious network connections.',
    whyItMatters: 'Network Protection prevents access to malicious websites and blocks command-and-control communications.',
    expectedRiskReduction: 30,
    priority: 'high',
    category: 'network',
    estimatedTimeMinutes: 10,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['malware', 'c2-communication']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Authentication Security
  {
    id: 'disable-basic-auth-winrm',
    title: 'Disable Allow Basic authentication for WinRM Service',
    description: 'Disable basic authentication for Windows Remote Management to prevent credential exposure.',
    action: 'Configure Group Policy or registry settings to disable basic authentication for WinRM service.',
    whyItMatters: 'Basic authentication sends credentials in clear text, making them vulnerable to interception.',
    expectedRiskReduction: 25,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 15,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['credential-exposure', 'authentication-bypass']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Software Update Recommendations
  {
    id: 'update-chrome',
    title: 'Update Google Chrome to latest version',
    description: 'Update Chrome browser to patch known security vulnerabilities and improve protection.',
    action: 'Open Chrome > Settings > About Chrome to automatically download and install the latest version.',
    whyItMatters: 'Outdated browsers contain known vulnerabilities that can be exploited by malicious websites.',
    expectedRiskReduction: 20,
    priority: 'high',
    category: 'application',
    estimatedTimeMinutes: 5,
    triggers: {
      softwareNames: ['google chrome', 'chrome'],
      outdatedSoftware: true
    },
    applicableWhen: (scanData) => {
      const chrome = scanData.software?.find((s: any) => s.name?.toLowerCase().includes('chrome'));
      if (!chrome) return false;
      
      // Check if Chrome version is outdated (simplified check)
      const version = chrome.version?.split('.')[0];
      return version && parseInt(version) < 120; // Assume 120+ is current
    }
  },

  {
    id: 'update-firefox',
    title: 'Update Mozilla Firefox to latest version',
    description: 'Update Firefox browser to patch security vulnerabilities and enhance protection features.',
    action: 'Open Firefox > Help > About Firefox to check for and install available updates.',
    whyItMatters: 'Browser vulnerabilities are actively exploited by attackers to compromise systems and steal data.',
    expectedRiskReduction: 20,
    priority: 'high',
    category: 'application',
    estimatedTimeMinutes: 5,
    triggers: {
      softwareNames: ['mozilla firefox', 'firefox'],
      outdatedSoftware: true
    },
    applicableWhen: (scanData) => {
      const firefox = scanData.software?.find((s: any) => s.name?.toLowerCase().includes('firefox'));
      if (!firefox) return false;
      
      // Check if Firefox version is outdated
      const version = firefox.version?.split('.')[0];
      return version && parseInt(version) < 121; // Assume 121+ is current
    }
  },

  {
    id: 'update-nodejs',
    title: 'Update Node.js to latest LTS version',
    description: 'Update Node.js to the latest Long Term Support version to patch security vulnerabilities.',
    action: 'Download and install the latest Node.js LTS version from nodejs.org or use a version manager.',
    whyItMatters: 'Outdated Node.js versions contain critical security vulnerabilities that can lead to remote code execution.',
    expectedRiskReduction: 30,
    priority: 'high',
    category: 'application',
    estimatedTimeMinutes: 15,
    triggers: {
      softwareNames: ['node.js', 'nodejs'],
      outdatedSoftware: true
    },
    applicableWhen: (scanData) => {
      const nodejs = scanData.software?.find((s: any) => s.name?.toLowerCase().includes('node'));
      if (!nodejs) return false;
      
      // Check if Node.js version is outdated
      const version = nodejs.version?.split('.')[0];
      return version && parseInt(version) < 20; // Assume 20+ is current LTS
    }
  },

  // Windows Security Features
  {
    id: 'enable-tamper-protection',
    title: 'Turn on Tamper Protection',
    description: 'Enable Tamper Protection to prevent malicious changes to Windows Security settings.',
    action: 'Open Windows Security > Virus & threat protection > Manage settings > Turn on Tamper Protection.',
    whyItMatters: 'Tamper Protection prevents malware from disabling security features and making unauthorized changes.',
    expectedRiskReduction: 25,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 5,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['malware', 'security-bypass']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  {
    id: 'configure-uac',
    title: 'Set User Account Control (UAC) to automatically deny elevation requests',
    description: 'Configure UAC to provide better protection against unauthorized system changes.',
    action: 'Adjust UAC settings in Control Panel > User Accounts to require administrator approval for system changes.',
    whyItMatters: 'Proper UAC configuration prevents malware from making unauthorized system-level changes.',
    expectedRiskReduction: 20,
    priority: 'medium',
    category: 'system',
    estimatedTimeMinutes: 10,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['privilege-escalation', 'malware']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Firewall Configuration
  {
    id: 'enable-windows-firewall',
    title: 'Turn on Microsoft Defender Firewall',
    description: 'Ensure Windows Firewall is enabled on all network profiles to block unauthorized connections.',
    action: 'Open Windows Security > Firewall & network protection and turn on firewall for all network profiles.',
    whyItMatters: 'Firewall protection blocks unauthorized network access and prevents malware communication.',
    expectedRiskReduction: 25,
    priority: 'high',
    category: 'network',
    estimatedTimeMinutes: 5,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['network-intrusion', 'malware']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // Real-time Protection
  {
    id: 'enable-realtime-protection',
    title: 'Turn on real-time protection',
    description: 'Enable real-time scanning to detect and block malware as it attempts to install or run.',
    action: 'Open Windows Security > Virus & threat protection > Manage settings > Turn on Real-time protection.',
    whyItMatters: 'Real-time protection provides immediate detection and blocking of malware threats.',
    expectedRiskReduction: 35,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 5,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['malware', 'virus', 'trojan']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // System Updates
  {
    id: 'enable-automatic-updates',
    title: 'Enable Automatic Updates',
    description: 'Configure Windows to automatically download and install security updates.',
    action: 'Open Windows Update settings and enable automatic updates for security patches.',
    whyItMatters: 'Automatic updates ensure critical security patches are installed promptly to prevent exploitation.',
    expectedRiskReduction: 30,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 10,
    triggers: {
      systemConfiguration: ['windows'],
      missingPatches: true,
      outdatedSoftware: true
    },
    applicableWhen: (scanData) => {
      if (!scanData.systemInfo?.osName?.toLowerCase().includes('windows')) return false;
      
      // Check if patches are outdated (more than 30 days old)
      if (scanData.patches?.latestPatchDate) {
        const patchDate = new Date(scanData.patches.latestPatchDate);
        const daysSincePatches = (Date.now() - patchDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSincePatches > 30;
      }
      return true;
    }
  },

  // Password Security
  {
    id: 'set-password-policy',
    title: 'Set Minimum password length to 14 or more characters',
    description: 'Configure password policy to require strong passwords that are resistant to brute force attacks.',
    action: 'Use Group Policy or local security policy to set minimum password length to 14 characters.',
    whyItMatters: 'Longer passwords are exponentially more difficult to crack and provide better security.',
    expectedRiskReduction: 20,
    priority: 'medium',
    category: 'system',
    estimatedTimeMinutes: 15,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['weak-authentication', 'brute-force']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  },

  // BitLocker Encryption
  {
    id: 'enable-bitlocker',
    title: 'Encrypt all BitLocker-supported drives',
    description: 'Enable BitLocker encryption on all supported drives to protect data at rest.',
    action: 'Open Control Panel > BitLocker Drive Encryption and turn on BitLocker for all drives.',
    whyItMatters: 'Drive encryption protects sensitive data if devices are lost, stolen, or physically compromised.',
    expectedRiskReduction: 40,
    priority: 'high',
    category: 'system',
    estimatedTimeMinutes: 30,
    triggers: {
      systemConfiguration: ['windows'],
      vulnerabilityTypes: ['data-theft', 'physical-access']
    },
    applicableWhen: (scanData) => scanData.systemInfo?.osName?.toLowerCase().includes('windows')
  }
];

// Helper function to get applicable recommendations based on scan data
export function getApplicableRecommendations(scanData: any): SecurityRecommendationTemplate[] {
  return SECURITY_RECOMMENDATIONS.filter(rec => rec.applicableWhen(scanData));
}

// Helper function to prioritize recommendations
export function prioritizeRecommendations(recommendations: SecurityRecommendationTemplate[]): SecurityRecommendationTemplate[] {
  const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
  
  return recommendations.sort((a, b) => {
    // First sort by priority
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by risk reduction
    return b.expectedRiskReduction - a.expectedRiskReduction;
  });
}
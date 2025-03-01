import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// API base URL from environment variable or default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout
});

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;
    
    // Handle token expiration (401 errors)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const res = await apiClient.post('/auth/refresh', { refreshToken });
          const { token } = res.data;
          
          // Update stored token
          localStorage.setItem('auth_token', token);
          
          // Retry original request with new token
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest);
        }
      } catch (_refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
      }
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('Network Error:', error.message);
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        originalError: error,
      });
    }
    
    // Return specific error from API when available
    const errorMessage = error.response?.data?.message || error.message;
    return Promise.reject({
      status: error.response?.status,
      message: errorMessage,
      originalError: error,
    });
  }
);

// For development, fall back to mock data if API is not available
// Get the mock data setting from localStorage to allow toggling at runtime
const getUseMockData = () => {
  const savedSetting = localStorage.getItem('use_mock_data');
  // Check app_settings if use_mock_data is not set
  if (savedSetting === null) {
    try {
      const appSettings = localStorage.getItem('app_settings');
      if (appSettings) {
        const settings = JSON.parse(appSettings);
        // Set the use_mock_data value based on app_settings
        const useMockData = settings.useMockData !== undefined ? settings.useMockData : true;
        localStorage.setItem('use_mock_data', useMockData.toString());
        return useMockData;
      }
    } catch (e) {
      console.error('Failed to parse app_settings', e);
    }
  }
  // Default to true if not set
  return savedSetting !== null ? savedSetting === 'true' : true;
};

// This will be dynamically checked on each API call
const USE_MOCK_DATA = getUseMockData();

// Add an event listener to refresh when localStorage changes
window.addEventListener('storage', (event) => {
  if (event.key === 'use_mock_data' || event.key === 'app_settings') {
    console.log('Database mode changed, reloading API settings');
    // This will cause the page to refresh when toggling between mock and production
    setTimeout(() => window.location.reload(), 100);
  }
});

// Mock script data for development
// Using a let statement instead of const to allow modification
let MOCK_SCRIPTS = [
  {
    id: 1,
    title: "Get-SystemInfo",
    description: "Retrieves detailed system information including OS, hardware, and network details",
    content: `
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$ComputerName,
    
    [Parameter(Mandatory=$false)]
    [switch]$IncludeNetworkInfo = $false
)

# Get basic system info
$osInfo = Get-WmiObject -Class Win32_OperatingSystem -ComputerName $ComputerName
$computerSystem = Get-WmiObject -Class Win32_ComputerSystem -ComputerName $ComputerName
$bios = Get-WmiObject -Class Win32_BIOS -ComputerName $ComputerName
$processor = Get-WmiObject -Class Win32_Processor -ComputerName $ComputerName
$memory = Get-WmiObject -Class Win32_PhysicalMemory -ComputerName $ComputerName | 
          Measure-Object -Property Capacity -Sum

# Create output object
$systemInfo = [PSCustomObject]@{
    ComputerName = $computerSystem.Name
    Manufacturer = $computerSystem.Manufacturer
    Model = $computerSystem.Model
    OperatingSystem = $osInfo.Caption
    OSVersion = $osInfo.Version
    SerialNumber = $bios.SerialNumber
    BIOSVersion = $bios.SMBIOSBIOSVersion
    Processor = $processor.Name
    CPUCores = $processor.NumberOfCores
    LogicalProcessors = $processor.NumberOfLogicalProcessors
    TotalMemoryGB = [math]::Round($memory.Sum / 1GB, 2)
    LastBootTime = $osInfo.ConvertToDateTime($osInfo.LastBootUpTime)
}

# Add network info if requested
if ($IncludeNetworkInfo) {
    $networkAdapters = Get-WmiObject -Class Win32_NetworkAdapterConfiguration -ComputerName $ComputerName | 
                        Where-Object { $_.IPAddress -ne $null }
    
    $networkInfo = $networkAdapters | ForEach-Object {
        [PSCustomObject]@{
            AdapterName = $_.Description
            MACAddress = $_.MACAddress
            IPAddresses = $_.IPAddress -join ', '
            SubnetMasks = $_.IPSubnet -join ', '
            DefaultGateway = $_.DefaultIPGateway -join ', '
            DNSServers = $_.DNSServerSearchOrder -join ', '
        }
    }
    
    $systemInfo | Add-Member -MemberType NoteProperty -Name NetworkAdapters -Value $networkInfo
}

return $systemInfo
    `,
    category: { id: 1, name: "System Administration" },
    user: { id: 1, username: "admin", email: "admin@example.com" },
    analysis: { 
      purpose: "Retrieves detailed system information from local or remote computers",
      security_score: 8.5, 
      code_quality_score: 9.0,
      risk_score: 2.0,
      parameters: {
        "ComputerName": {
          type: "string",
          mandatory: true,
          description: "The computer to query for system information"
        },
        "IncludeNetworkInfo": {
          type: "switch",
          mandatory: false, 
          description: "Include network adapter information in results"
        }
      }
    },
    executionCount: 245,
    createdAt: "2024-01-15T08:23:15Z",
    updatedAt: "2024-02-10T14:17:22Z",
    version: 2
  },
  {
    id: 2,
    title: "Backup-UserData",
    description: "Creates a backup of user documents and settings with compression",
    content: `
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$UserName,
    
    [Parameter(Mandatory=$true)]
    [string]$BackupPath,
    
    [Parameter(Mandatory=$false)]
    [switch]$IncludeAppData = $false,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet("None", "Fastest", "Optimal", "Maximum")]
    [string]$CompressionLevel = "Optimal"
)

# Verify user exists
$userProfile = Join-Path -Path $env:SystemDrive\\Users -ChildPath $UserName
if (-not (Test-Path -Path $userProfile)) {
    Write-Error "User profile for '$UserName' not found at path: $userProfile"
    return
}

# Define paths to backup
$pathsToBackup = @(
    (Join-Path -Path $userProfile -ChildPath "Documents"),
    (Join-Path -Path $userProfile -ChildPath "Desktop"),
    (Join-Path -Path $userProfile -ChildPath "Pictures"),
    (Join-Path -Path $userProfile -ChildPath "Downloads"),
    (Join-Path -Path $userProfile -ChildPath "Favorites")
)

# Include AppData if specified
if ($IncludeAppData) {
    $pathsToBackup += (Join-Path -Path $userProfile -ChildPath "AppData\\Roaming")
}

# Create backup filename with timestamp
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path -Path $BackupPath -ChildPath "$UserName-Backup-$timestamp.zip"

# Create backup directory if it doesn't exist
if (-not (Test-Path -Path $BackupPath)) {
    New-Item -Path $BackupPath -ItemType Directory -Force | Out-Null
}

# Compress files
try {
    $compressionMap = @{
        "None" = "NoCompression"
        "Fastest" = "Fastest"
        "Optimal" = "Optimal"
        "Maximum" = "Maximum"
    }
    
    $compression = $compressionMap[$CompressionLevel]
    
    Write-Verbose "Starting backup of user '$UserName' to '$backupFile'"
    Compress-Archive -Path $pathsToBackup -DestinationPath $backupFile -CompressionLevel $compression -Force
    
    # Return result object
    [PSCustomObject]@{
        UserName = $UserName
        BackupFile = $backupFile
        BackupSize = (Get-Item -Path $backupFile).Length
        PathsBackedUp = $pathsToBackup
        Timestamp = Get-Date
        Success = $true
    }
} catch {
    Write-Error "Failed to create backup: $_"
    return
}
    `,
    category: { id: 5, name: "Backup & Recovery" },
    user: { id: 1, username: "admin", email: "admin@example.com" },
    analysis: { 
      purpose: "Creates a compressed backup of user files and settings",
      security_score: 7.8, 
      code_quality_score: 8.5,
      risk_score: 3.5,
      parameters: {
        "UserName": {
          type: "string",
          mandatory: true,
          description: "Username whose data should be backed up"
        },
        "BackupPath": {
          type: "string",
          mandatory: true, 
          description: "Destination path for the backup file"
        },
        "IncludeAppData": {
          type: "switch",
          mandatory: false, 
          description: "Include AppData folder in backup"
        },
        "CompressionLevel": {
          type: "string",
          mandatory: false, 
          description: "Compression level (None, Fastest, Optimal, Maximum)"
        }
      }
    },
    executionCount: 183,
    createdAt: "2024-01-22T10:15:43Z",
    updatedAt: "2024-01-22T10:15:43Z",
    version: 1
  },
  {
    id: 3,
    title: "New-ADUserBulk",
    description: "Create multiple Active Directory users from CSV input",
    content: `
[CmdletBinding()]
param (
    [Parameter(Mandatory=$true)]
    [string]$CSVPath,
    
    [Parameter(Mandatory=$false)]
    [string]$OUPath,
    
    [Parameter(Mandatory=$false)]
    [string]$DefaultPassword = "ChangeMe123!",
    
    [Parameter(Mandatory=$false)]
    [switch]$MustChangePasswordAtLogon = $true,
    
    [Parameter(Mandatory=$false)]
    [switch]$WhatIf
)

# Verify CSV file exists
if (-not (Test-Path -Path $CSVPath)) {
    Write-Error "CSV file not found at: $CSVPath"
    return
}

# Import the CSV file
try {
    $users = Import-Csv -Path $CSVPath
} catch {
    Write-Error "Failed to import CSV file: $_"
    return
}

# Verify required CSV columns
$requiredColumns = @('FirstName', 'LastName', 'SamAccountName')
$missingColumns = $requiredColumns | Where-Object { $users[0] | Get-Member -Name $_ -MemberType NoteProperty -ErrorAction SilentlyContinue }

if ($missingColumns.Count -gt 0) {
    Write-Error "CSV is missing required columns: $($missingColumns -join ', ')"
    return
}

# Convert plain text password to secure string
$securePassword = ConvertTo-SecureString -String $DefaultPassword -AsPlainText -Force

# Track creation results
$results = @()

# Process each user in the CSV
foreach ($user in $users) {
    try {
        # Build user creation params
        $newUserParams = @{
            SamAccountName = $user.SamAccountName
            UserPrincipalName = "$($user.SamAccountName)@$env:USERDNSDOMAIN"
            Name = "$($user.FirstName) $($user.LastName)"
            GivenName = $user.FirstName
            Surname = $user.LastName
            AccountPassword = $securePassword
            Enabled = $true
            ChangePasswordAtLogon = $MustChangePasswordAtLogon
        }
        
        # Set optional params if provided
        if ($user.Description) { $newUserParams.Description = $user.Description }
        if ($user.Email) { $newUserParams.EmailAddress = $user.Email }
        if ($user.Department) { $newUserParams.Department = $user.Department }
        if ($user.Title) { $newUserParams.Title = $user.Title }
        
        # Set OU if provided
        if ($OUPath) {
            $newUserParams.Path = $OUPath
        } elseif ($user.OUPath) {
            $newUserParams.Path = $user.OUPath
        }
        
        # Add WhatIf if requested
        if ($WhatIf) {
            $newUserParams.WhatIf = $true
        }
        
        # Create the user
        New-ADUser @newUserParams
        
        # Record success
        $results += [PSCustomObject]@{
            SamAccountName = $user.SamAccountName
            Name = "$($user.FirstName) $($user.LastName)"
            Status = "Created"
            Success = $true
            Error = $null
        }
        
        Write-Verbose "Created user: $($user.SamAccountName)"
    } catch {
        # Record failure
        $results += [PSCustomObject]@{
            SamAccountName = $user.SamAccountName
            Name = "$($user.FirstName) $($user.LastName)"
            Status = "Failed"
            Success = $false
            Error = $_.Exception.Message
        }
        
        Write-Error "Failed to create user $($user.SamAccountName): $_"
    }
}

# Return results
return $results
    `,
    category: { id: 3, name: "Active Directory" },
    user: { id: 1, username: "admin", email: "admin@example.com" },
    analysis: { 
      purpose: "Creates multiple Active Directory users from a CSV file",
      security_score: 5.2, 
      code_quality_score: 8.0,
      risk_score: 7.5,
      parameters: {
        "CSVPath": {
          type: "string",
          mandatory: true,
          description: "Path to CSV file containing user information"
        },
        "OUPath": {
          type: "string",
          mandatory: false, 
          description: "Default OU path for new users"
        },
        "DefaultPassword": {
          type: "string",
          mandatory: false, 
          description: "Default password for new users"
        },
        "MustChangePasswordAtLogon": {
          type: "switch",
          mandatory: false, 
          description: "Force users to change password at first logon"
        },
        "WhatIf": {
          type: "switch",
          mandatory: false, 
          description: "Simulate creation without making changes"
        }
      }
    },
    executionCount: 97,
    createdAt: "2024-02-05T16:42:27Z",
    updatedAt: "2024-02-20T09:11:04Z",
    version: 3
  }
];

// Mock API endpoints
// Real API service
const realScriptService = {
  getScripts: async (params = {}) => {
    const response = await apiClient.get('/scripts', { params });
    return response.data;
  },
  
  getScript: async (id: string) => {
    const response = await apiClient.get(`/scripts/${id}`);
    return response.data;
  },
  
  uploadScript: async (scriptData: any) => {
    const response = await apiClient.post('/scripts', scriptData);
    return response.data;
  },
  
  updateScript: async (id: string, scriptData: any) => {
    const response = await apiClient.put(`/scripts/${id}`, scriptData);
    return response.data;
  },
  
  deleteScript: async (id: string) => {
    const response = await apiClient.delete(`/scripts/${id}`);
    return response.data;
  },
  
  getScriptAnalysis: async (id: string) => {
    const response = await apiClient.get(`/scripts/${id}/analysis`);
    return response.data;
  },
  
  executeScript: async (id: string, params = {}) => {
    const response = await apiClient.post(`/scripts/${id}/execute`, { params });
    return response.data;
  },
  
  getSimilarScripts: async (id: string) => {
    const response = await apiClient.get(`/scripts/${id}/similar`);
    return response.data;
  },
  
  searchScripts: async (query: string, filters = {}) => {
    const params = { q: query, ...filters };
    const response = await apiClient.get('/scripts/search', { params });
    return response.data;
  },
  
  analyzeScript: async (content: string) => {
    const response = await apiClient.post('/scripts/analyze', { content });
    return response.data;
  },
  
  getScriptVersions: async (id: string) => {
    const response = await apiClient.get(`/scripts/${id}/versions`);
    return response.data;
  },
};

// Mock script service
const mockScriptService = {
  // Get all scripts with optional filters
  getScripts: async (params = {}) => {
    console.log("API Call (MOCK): getScripts", params);
    // Simulate filtering in a real API
    let filteredScripts = [...MOCK_SCRIPTS];
    
    // Return mock data with artificial delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      scripts: filteredScripts,
      total: filteredScripts.length,
      page: 1,
      totalPages: 1
    };
  },
  
  // Get a single script by ID
  getScript: async (id: string) => {
    console.log("API Call (MOCK): getScript", id);
    const script = MOCK_SCRIPTS.find(s => s.id.toString() === id);
    
    // Simulate not found if script doesn't exist
    if (!script) {
      await new Promise(resolve => setTimeout(resolve, 200));
      throw new Error("Script not found");
    }
    
    // Return found script with artificial delay
    await new Promise(resolve => setTimeout(resolve, 200));
    return script;
  },
  
  // Upload a new script
  uploadScript: async (scriptData: any) => {
    console.log("API Call (MOCK): uploadScript", scriptData);
    
    // Add fake ID and data
    const newId = MOCK_SCRIPTS.length + 1;
    const newScript = {
      id: newId,
      ...scriptData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      executionCount: 0,
      analysis: {
        purpose: "Analysis pending...",
        security_score: 0,
        code_quality_score: 0,
        risk_score: 0,
        parameters: {}
      }
    };
    
    // Add the new script to the mock data so it can be retrieved later
    MOCK_SCRIPTS.push(newScript);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 800));
    return newScript;
  },
  
  // Update an existing script
  updateScript: async (id: string, scriptData: any) => {
    console.log("API Call (MOCK): updateScript", id, scriptData);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      id: parseInt(id),
      ...scriptData,
      updatedAt: new Date().toISOString(),
      version: 2
    };
  },
  
  // Delete a script
  deleteScript: async (id: string) => {
    console.log("API Call (MOCK): deleteScript", id);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 500));
    return { success: true };
  },
  
  // Bulk update scripts (used in script management page)
  bulkUpdateScripts: async (data: { ids: string[], isPublic: boolean }) => {
    console.log("API Call (MOCK): bulkUpdateScripts", data);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 700));
    return { 
      success: true,
      updated: data.ids.length,
      message: `Successfully updated ${data.ids.length} scripts` 
    };
  },
  
  // Bulk delete scripts (used in script management page)
  bulkDeleteScripts: async (ids: string[]) => {
    console.log("API Call (MOCK): bulkDeleteScripts", ids);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 800));
    return { 
      success: true,
      deleted: ids.length,
      message: `Successfully deleted ${ids.length} scripts` 
    };
  },
  
  // Get script analysis
  getScriptAnalysis: async (id: string) => {
    console.log("API Call (MOCK): getScriptAnalysis", id);
    const script = MOCK_SCRIPTS.find(s => s.id.toString() === id);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 300));
    return script?.analysis || {
      purpose: "Unknown",
      security_score: 0,
      code_quality_score: 0,
      risk_score: 5,
      parameters: {}
    };
  },
  
  // Execute a script
  executeScript: async (id: string, params = {}) => {
    console.log("API Call (MOCK): executeScript", id, params);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      success: true,
      output: "Script executed successfully with sample output...",
      executionTime: 1.25,
      timestamp: new Date().toISOString()
    };
  },
  
  // Find similar scripts
  getSimilarScripts: async (id: string) => {
    console.log("API Call (MOCK): getSimilarScripts", id);
    
    // Return other scripts as "similar" for demo purposes
    const script = MOCK_SCRIPTS.find(s => s.id.toString() === id);
    const otherScripts = MOCK_SCRIPTS.filter(s => s.id.toString() !== id)
      .map(s => ({
        script_id: s.id,
        title: s.title,
        similarity: Math.random() * 0.5 + 0.5 // Random similarity between 0.5-1.0
      }));
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 600));
    return {
      similar_scripts: otherScripts
    };
  },
  
  // Search scripts by query
  searchScripts: async (query: string) => {
    console.log("API Call (MOCK): searchScripts", query);
    
    // Simple mock search filtering
    const filtered = MOCK_SCRIPTS.filter(script => 
      script.title.toLowerCase().includes(query.toLowerCase()) ||
      script.description.toLowerCase().includes(query.toLowerCase())
    );
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 400));
    return {
      scripts: filtered,
      total: filtered.length
    };
  },
  
  // Analyze script content
  analyzeScript: async (content: string) => {
    console.log("API Call (MOCK): analyzeScript", content.substring(0, 50) + "...");
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      purpose: "Generated mock analysis for script",
      security_score: Math.floor(Math.random() * 10) + 1,
      code_quality_score: Math.floor(Math.random() * 10) + 1,
      risk_score: Math.floor(Math.random() * 10) + 1,
      parameters: {},
      category: "System Administration",
      optimization: ["Add error handling", "Use parameter validation"],
      reliability_score: Math.floor(Math.random() * 10) + 1
    };
  },
  
  // Get script versions
  getScriptVersions: async (id: string) => {
    console.log("API Call (MOCK): getScriptVersions", id);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 400));
    return {
      versions: [
        { version: 2, updatedAt: new Date().toISOString(), changes: "Updated error handling" },
        { version: 1, updatedAt: new Date(Date.now() - 86400000).toISOString(), changes: "Initial version" }
      ]
    };
  }
};

// Add the bulk API methods to the real service
const realScriptServiceWithBulk = {
  ...realScriptService,
  
  bulkUpdateScripts: async (data: { ids: string[], isPublic: boolean }) => {
    const response = await apiClient.post('/scripts/bulk-update', data);
    return response.data;
  },
  
  bulkDeleteScripts: async (ids: string[]) => {
    const response = await apiClient.post('/scripts/bulk-delete', { ids });
    return response.data;
  }
};

// Add the functions needed for the Manage Files page
const mockScriptServiceWithManage = {
  ...mockScriptService,
  
  // Delete multiple scripts
  deleteScripts: async (ids: string[]) => {
    console.log("API Call (MOCK): deleteScripts", ids);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 800));
    return { 
      success: true,
      deleted: ids.length,
      message: `Successfully deleted ${ids.length} scripts` 
    };
  },
  
  // Apply AI suggestions to a script
  applyAiSuggestions: async (scriptId: string, suggestions: string[]) => {
    console.log("API Call (MOCK): applyAiSuggestions", scriptId, suggestions);
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 1500));
    return {
      success: true,
      message: "AI suggestions applied successfully",
      scriptId,
      appliedChanges: suggestions.length
    };
  }
};

// Add the same methods to the real service
const realScriptServiceWithManage = {
  ...realScriptServiceWithBulk,
  
  // Delete multiple scripts
  deleteScripts: async (ids: string[]) => {
    const response = await apiClient.post('/scripts/delete', { ids });
    return response.data;
  },
  
  // Apply AI suggestions to a script
  applyAiSuggestions: async (scriptId: string, suggestions: string[]) => {
    const response = await apiClient.post(`/scripts/${scriptId}/apply-suggestions`, { suggestions });
    return response.data;
  }
};

// Function to get the appropriate service based on current mock data setting
const getScriptService = () => {
  // Recheck the setting each time to allow for runtime toggling
  return getUseMockData() ? mockScriptServiceWithManage : realScriptServiceWithManage;
};

// Export a proxy that delegates to the appropriate service
export const scriptService = new Proxy({}, {
  get: (target, prop) => {
    // Delegate to the appropriate service based on current setting
    const service = getScriptService();
    return service[prop];
  }
});

// Mock categories
const MOCK_CATEGORIES = [
  { id: 1, name: "System Administration", description: "Scripts for system administration tasks" },
  { id: 2, name: "Network Management", description: "Network configuration and management scripts" },
  { id: 3, name: "Active Directory", description: "AD user and group management scripts" },
  { id: 4, name: "Security Tools", description: "Security analysis and hardening scripts" },
  { id: 5, name: "Backup & Recovery", description: "Data backup and recovery scripts" },
  { id: 6, name: "Monitoring Scripts", description: "System and service monitoring scripts" },
  { id: 7, name: "Automation Workflows", description: "Task automation scripts" }
];

export const categoryService = {
  // Get all categories
  getCategories: async () => {
    console.log("API Call: getCategories");
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      categories: MOCK_CATEGORIES
    };
  }
};

// Mock tags
const MOCK_TAGS = [
  { id: 1, name: "windows" },
  { id: 2, name: "linux" },
  { id: 3, name: "active-directory" },
  { id: 4, name: "azure" },
  { id: 5, name: "aws" },
  { id: 6, name: "exchange" },
  { id: 7, name: "office365" },
  { id: 8, name: "backup" },
  { id: 9, name: "security" },
  { id: 10, name: "automation" }
];

export const tagService = {
  // Get all tags
  getTags: async () => {
    console.log("API Call: getTags");
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      tags: MOCK_TAGS
    };
  },
  
  // Create a new tag
  createTag: async (name: string) => {
    console.log("API Call: createTag", name);
    
    // Create new tag object
    const newTag = {
      id: MOCK_TAGS.length + 1,
      name
    };
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 300));
    return newTag;
  }
};

// Mock analytics data
export const analyticsService = {
  // Get usage statistics
  getUsageStats: async () => {
    console.log("API Call: getUsageStats");
    
    // Mock usage statistics
    const usageStats = {
      totalScripts: 156,
      executionsToday: 42,
      userScripts: 27,
      averageQuality: 7.8,
      executionsLastWeek: 342,
      activeUsers: 28,
      totalExecutions: 1245,
      recentActivity: [
        {
          type: 'execution',
          user: 'admin',
          scriptId: 1,
          scriptTitle: 'Get-SystemInfo',
          timestamp: new Date().toISOString()
        },
        {
          type: 'upload',
          user: 'admin',
          scriptId: 3,
          scriptTitle: 'New-ADUser',
          timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
          type: 'execution',
          user: 'sysadmin',
          scriptId: 2,
          scriptTitle: 'Backup-UserFiles',
          timestamp: new Date(Date.now() - 7200000).toISOString()
        }
      ]
    };
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 500));
    return usageStats;
  },
  
  // Get security metrics
  getSecurityMetrics: async () => {
    console.log("API Call: getSecurityMetrics");
    
    // Mock security metrics
    const securityMetrics = {
      highSecurityCount: 76,
      highSecurityPercentage: 48,
      mediumSecurityCount: 59,
      mediumSecurityPercentage: 38,
      lowSecurityCount: 21,
      lowSecurityPercentage: 14,
      commonIssues: [
        {
          title: 'Unencrypted Credentials',
          description: 'Scripts contain plaintext credentials that should be secured',
          count: 15
        },
        {
          title: 'Excessive Permissions',
          description: 'Scripts requesting unnecessary admin privileges',
          count: 12
        },
        {
          title: 'Missing Error Handling',
          description: 'Scripts lack proper error handling for network operations',
          count: 23
        }
      ]
    };
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 600));
    return securityMetrics;
  },
  
  // Get category distribution
  getCategoryDistribution: async () => {
    console.log("API Call: getCategoryDistribution");
    
    // Mock category distribution
    const categoryDistribution = {
      categories: [
        { id: 1, name: "System Administration", count: 42, percentage: 27 },
        { id: 2, name: "Active Directory", count: 38, percentage: 24 },
        { id: 3, name: "Backup & Recovery", count: 25, percentage: 16 },
        { id: 4, name: "Security Tools", count: 19, percentage: 12 },
        { id: 5, name: "Network Management", count: 17, percentage: 11 },
        { id: 6, name: "Automation Workflows", count: 15, percentage: 10 }
      ]
    };
    
    // Artificial delay for API call simulation
    await new Promise(resolve => setTimeout(resolve, 400));
    return categoryDistribution;
  }
};
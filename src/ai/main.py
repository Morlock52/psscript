"""
PowerShell Script Analysis API
A FastAPI service that analyzes PowerShell scripts using OpenAI APIs.
"""

import os
import json
from typing import Dict, List, Optional, Any

from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
import openai
import tiktoken
from tenacity import retry, stop_after_attempt, wait_exponential

from analysis.script_analyzer import ScriptAnalyzer

# Initialize FastAPI app
app = FastAPI(
    title="PowerShell Script Analysis API",
    description="API for analyzing PowerShell scripts using AI",
    version="0.1.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize script analyzer
script_analyzer = ScriptAnalyzer()

# Check if we have a valid API key
# In production, set OPENAI_API_KEY environment variable
# For testing without valid API key, explicitly set MOCK_MODE=true
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
print(f"Using API key: {OPENAI_API_KEY[:8]}...")

# Set to True because the API key isn't working correctly
MOCK_MODE = True
print("Using mock mode because API key is not working correctly")

print(f"Mock mode enabled: {MOCK_MODE}")

# Database connection
def get_db_connection():
    """Create and return a database connection."""
    conn = psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "psscript"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres"),
        port=os.getenv("DB_PORT", "5432")
    )
    conn.cursor_factory = RealDictCursor
    return conn

# Request/Response Models
class ScriptContent(BaseModel):
    content: str = Field(..., description="PowerShell script content to analyze")
    script_id: Optional[int] = Field(None, description="Script ID if already stored")

class ScriptEmbeddingRequest(BaseModel):
    content: str = Field(..., description="PowerShell script content to generate embedding for")

class SimilarScriptsRequest(BaseModel):
    script_id: Optional[int] = Field(None, description="Script ID to find similar scripts for")
    content: Optional[str] = Field(None, description="Script content to find similar scripts for")
    limit: int = Field(5, description="Maximum number of similar scripts to return")

class AnalysisResponse(BaseModel):
    purpose: str
    security_analysis: str
    security_score: float
    code_quality_score: float
    parameters: Dict[str, Any]
    category: str
    optimization: List[str]
    risk_score: float

class EmbeddingResponse(BaseModel):
    embedding: List[float]

class SimilarScript(BaseModel):
    script_id: int
    title: str
    similarity: float

class SimilarScriptsResponse(BaseModel):
    similar_scripts: List[SimilarScript]
    
class ChatMessage(BaseModel):
    role: str = Field(..., description="The role of the message sender (user or assistant)")
    content: str = Field(..., description="The content of the message")

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(..., description="Chat history")
    system_prompt: Optional[str] = Field(None, description="Optional system prompt to override default")
    
class ChatResponse(BaseModel):
    response: str = Field(..., description="The assistant's response")

# API Routes
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint, returns API info."""
    return {
        "message": "PowerShell Script Analysis API",
        "version": "0.1.0",
        "status": "operational",
        "mode": "mock" if MOCK_MODE else "production"
    }

@app.post("/analyze", response_model=AnalysisResponse, tags=["Analysis"])
async def analyze_script(script_data: ScriptContent):
    """Analyze a PowerShell script and return detailed information."""
    try:
        # Perform script analysis
        analysis = script_analyzer.analyze_script(script_data.content)
        
        # If script_id is provided, store the analysis result in the database
        if script_data.script_id:
            try:
                conn = get_db_connection()
                cur = conn.cursor()
                
                # Check if analysis exists for this script
                cur.execute(
                    "SELECT id FROM script_analysis WHERE script_id = %s",
                    (script_data.script_id,)
                )
                existing = cur.fetchone()
                
                if existing:
                    # Update existing analysis
                    cur.execute(
                        """
                        UPDATE script_analysis
                        SET purpose = %s, security_score = %s, quality_score = %s, 
                            risk_score = %s, parameter_docs = %s, suggestions = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE script_id = %s
                        RETURNING id
                        """,
                        (
                            analysis["purpose"],
                            analysis["security_score"],
                            analysis["code_quality_score"],
                            analysis["risk_score"],
                            json.dumps(analysis["parameters"]),
                            json.dumps(analysis["optimization"]),
                            script_data.script_id
                        )
                    )
                else:
                    # Insert new analysis
                    cur.execute(
                        """
                        INSERT INTO script_analysis
                        (script_id, purpose, security_score, quality_score, risk_score, 
                         parameter_docs, suggestions)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                        """,
                        (
                            script_data.script_id,
                            analysis["purpose"],
                            analysis["security_score"],
                            analysis["code_quality_score"],
                            analysis["risk_score"],
                            json.dumps(analysis["parameters"]),
                            json.dumps(analysis["optimization"])
                        )
                    )
                
                conn.commit()
            
            except Exception as e:
                print(f"Database error: {e}")
                # Continue even if database operation fails
            finally:
                if conn:
                    conn.close()
        
        return analysis
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.post("/embedding", response_model=EmbeddingResponse, tags=["Embeddings"])
async def create_embedding(request: ScriptEmbeddingRequest):
    """Generate an embedding vector for a PowerShell script."""
    try:
        embedding = script_analyzer.generate_embedding(request.content)
        return {"embedding": embedding}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Embedding generation failed: {str(e)}")

@app.post("/similar", response_model=SimilarScriptsResponse, tags=["Search"])
async def find_similar_scripts(request: SimilarScriptsRequest):
    """Find scripts similar to a given script using vector similarity."""
    # Validate that either script_id or content is provided
    if request.script_id is None and request.content is None:
        raise HTTPException(
            status_code=400, 
            detail="Either script_id or content must be provided"
        )
    
    try:
        conn = get_db_connection()
        
        # Get the embedding for the query script
        query_embedding = None
        
        if request.script_id:
            # Fetch embedding for existing script
            cur = conn.cursor()
            cur.execute(
                "SELECT embedding FROM script_embeddings WHERE script_id = %s",
                (request.script_id,)
            )
            result = cur.fetchone()
            
            if not result:
                raise HTTPException(
                    status_code=404,
                    detail=f"No embedding found for script ID {request.script_id}"
                )
            
            query_embedding = result["embedding"]
        
        elif request.content:
            # Generate embedding for provided content
            query_embedding = script_analyzer.generate_embedding(request.content)
        
        # Convert query embedding to numpy array
        query_embedding_np = np.array(query_embedding)
        
        # Fetch all script embeddings from database
        cur = conn.cursor()
        cur.execute("""
            SELECT se.script_id, se.embedding, s.title
            FROM script_embeddings se
            JOIN scripts s ON se.script_id = s.id
            WHERE se.script_id \!= %s
        """, (request.script_id or 0,))
        
        script_embeddings = cur.fetchall()
        
        # Calculate similarities
        similarities = []
        for script in script_embeddings:
            script_embedding = np.array(script["embedding"])
            similarity = np.dot(query_embedding_np, script_embedding) / (
                np.linalg.norm(query_embedding_np) * np.linalg.norm(script_embedding)
            )
            similarities.append({
                "script_id": script["script_id"],
                "title": script["title"],
                "similarity": float(similarity)
            })
        
        # Sort by similarity (highest first) and return top matches
        similarities.sort(key=lambda x: x["similarity"], reverse=True)
        top_similarities = similarities[:request.limit]
        
        return {"similar_scripts": top_similarities}
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to find similar scripts: {str(e)}"
        )
    finally:
        if conn:
            conn.close()

@app.get("/categories", tags=["Categories"])
async def get_categories():
    """Get the list of predefined script categories."""
    categories = [
        "System Administration",
        "Network Management",
        "Active Directory",
        "Security Tools",
        "Backup & Recovery",
        "Monitoring Scripts",
        "Automation Workflows",
        "Cloud Management",
        "Virtualization",
        "Development Tools",
        "Database Management",
        "Reporting Scripts",
        "File Operations",
        "User Management",
        "Configuration Management",
        "Deployment Scripts",
        "Troubleshooting Tools",
        "Data Processing",
        "Integration Scripts",
        "Documentation Generators"
    ]
    
    return {"categories": categories}

# Mock chat response for development without API key
def get_mock_chat_response(messages):
    """Generate a mock chat response when no valid API key is provided"""
    user_message = messages[-1]['content'] if messages and messages[-1]['role'] == 'user' else ''
    
    if not user_message:
        return "I'm here to help with PowerShell scripting. What can I assist you with today?"
    
    # Greetings
    if any(greeting in user_message.lower() for greeting in ['hello', 'hi', 'hey', 'greetings']):
        return "Hello! I'm PSScriptGPT, your PowerShell assistant. How can I help you with your PowerShell scripts today?"
    
    # General PowerShell information
    if 'what is powershell' in user_message.lower():
        return """PowerShell is a cross-platform task automation solution made up of a command-line shell, a scripting language, and a configuration management framework. PowerShell runs on Windows, Linux, and macOS.

PowerShell is built on the .NET Common Language Runtime (CLR) and accepts and returns .NET objects. This fundamental change brings entirely new tools and methods for automation.

Key features of PowerShell include:

1. **Cmdlets**: Lightweight commands that perform a single function
2. **Piping**: The ability to pass objects between commands
3. **Providers**: Access to data stores like the file system or registry
4. **Scripting Language**: A full-featured scripting language for creating scripts and functions
5. **Error Handling**: Robust error handling with try/catch blocks
6. **Integrated Scripting Environment (ISE)**: An IDE for writing PowerShell scripts
7. **Remote Management**: Built-in remoting capabilities to manage remote systems

Would you like to see some basic PowerShell examples?"""
    
    # Script examples - basic
    if any(term in user_message.lower() for term in ['script', 'example', 'sample', 'code']):
        return """Here's a PowerShell script example that demonstrates several key concepts:

```powershell
# Get-SystemReport.ps1
# This script generates a system report including OS, disk, and memory information
# Author: PSScriptGPT
# Version: 1.0

function Get-SystemReport {
    <#
    .SYNOPSIS
        Generates a comprehensive system report.
    
    .DESCRIPTION
        This function collects system information including operating system details,
        disk space, and memory utilization, and returns a custom object.
    
    .PARAMETER ComputerName
        The name of the computer to query. Defaults to the local computer.
    
    .EXAMPLE
        Get-SystemReport
        
        Returns a system report for the local computer.
    
    .EXAMPLE
        Get-SystemReport -ComputerName "Server01"
        
        Returns a system report for Server01.
    #>
    
    [CmdletBinding()]
    param(
        [Parameter(ValueFromPipeline=$true, ValueFromPipelineByPropertyName=$true)]
        [string]$ComputerName = $env:COMPUTERNAME
    )
    
    process {
        try {
            # Get operating system information
            $OS = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $ComputerName -ErrorAction Stop
            
            # Get disk information
            $Disks = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DriveType=3" -ComputerName $ComputerName |
                     Select-Object DeviceID, 
                                  @{Name="SizeGB";Expression={[math]::Round($_.Size / 1GB, 2)}},
                                  @{Name="FreeGB";Expression={[math]::Round($_.FreeSpace / 1GB, 2)}},
                                  @{Name="PercentFree";Expression={[math]::Round(($_.FreeSpace / $_.Size) * 100, 2)}}
            
            # Get memory information
            $Memory = @{
                TotalGB = [math]::Round($OS.TotalVisibleMemorySize / 1MB, 2)
                FreeGB = [math]::Round($OS.FreePhysicalMemory / 1MB, 2)
                PercentFree = [math]::Round(($OS.FreePhysicalMemory / $OS.TotalVisibleMemorySize) * 100, 2)
            }
            
            # Return custom object with all information
            [PSCustomObject]@{
                ComputerName = $ComputerName
                OSName = $OS.Caption
                OSVersion = $OS.Version
                OSBuildNumber = $OS.BuildNumber
                LastBoot = $OS.LastBootUpTime
                Uptime = (Get-Date) - $OS.LastBootUpTime
                Disks = $Disks
                Memory = $Memory
                ReportTime = Get-Date
            }
        }
        catch {
            Write-Error "Failed to generate system report for $ComputerName. Error: $_"
        }
    }
}

# Example usage
Get-SystemReport | Format-List
```

This script demonstrates:
1. Comment-based help with synopsis, description, parameters, and examples
2. Advanced function structure with [CmdletBinding()]
3. Parameter handling with validation
4. Error handling with try/catch
5. CIM instance queries for system information
6. Custom object creation with calculated properties
7. Pipeline support

Would you like me to explain any particular part of this script in more detail?"""
    
    # File operations
    if any(term in user_message.lower() for term in ['file', 'folder', 'directory', 'copy', 'move']):
        return """Here's a PowerShell script for file operations that demonstrates how to work with files and directories:

```powershell
# File-Operations.ps1
# Script to demonstrate common file operations in PowerShell
# Author: PSScriptGPT
# Version: 1.0

# Create a new directory
function New-DirectoryIfNotExists {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Path
    )
    
    if (!(Test-Path -Path $Path)) {
        New-Item -Path $Path -ItemType Directory -Force
        Write-Output "Created directory: $Path"
    } else {
        Write-Output "Directory already exists: $Path"
    }
}

# Copy files with progress bar
function Copy-FilesWithProgress {
    param (
        [Parameter(Mandatory=$true)]
        [string]$SourceDir,
        
        [Parameter(Mandatory=$true)]
        [string]$DestinationDir,
        
        [Parameter(Mandatory=$false)]
        [string]$FileFilter = "*"
    )
    
    # Ensure source directory exists
    if (!(Test-Path -Path $SourceDir)) {
        Write-Error "Source directory does not exist: $SourceDir"
        return
    }
    
    # Create destination directory if it doesn't exist
    New-DirectoryIfNotExists -Path $DestinationDir
    
    # Get files to copy
    $files = Get-ChildItem -Path $SourceDir -Filter $FileFilter -File
    $totalFiles = $files.Count
    $filesCopied = 0
    
    if ($totalFiles -eq 0) {
        Write-Warning "No files found matching filter '$FileFilter' in $SourceDir"
        return
    }
    
    Write-Output "Copying $totalFiles files from $SourceDir to $DestinationDir"
    
    foreach ($file in $files) {
        $percentComplete = [int](($filesCopied / $totalFiles) * 100)
        Write-Progress -Activity "Copying Files" -Status "$percentComplete% Complete" -PercentComplete $percentComplete -CurrentOperation $file.Name
        
        try {
            Copy-Item -Path $file.FullName -Destination $DestinationDir -Force
            $filesCopied++
        }
        catch {
            Write-Error "Failed to copy $($file.Name): $_"
        }
    }
    
    Write-Progress -Activity "Copying Files" -Completed
    Write-Output "Successfully copied $filesCopied of $totalFiles files"
}

# Find and replace text in multiple files
function Find-ReplaceInFiles {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Directory,
        
        [Parameter(Mandatory=$true)]
        [string]$FileFilter,
        
        [Parameter(Mandatory=$true)]
        [string]$FindText,
        
        [Parameter(Mandatory=$true)]
        [string]$ReplaceText,
        
        [Parameter(Mandatory=$false)]
        [switch]$Backup
    )
    
    $files = Get-ChildItem -Path $Directory -Filter $FileFilter -File -Recurse
    $count = 0
    
    foreach ($file in $files) {
        try {
            $content = Get-Content -Path $file.FullName -Raw
            
            if ($content -match [regex]::Escape($FindText)) {
                if ($Backup) {
                    Copy-Item -Path $file.FullName -Destination "$($file.FullName).bak" -Force
                }
                
                $newContent = $content -replace [regex]::Escape($FindText), $ReplaceText
                Set-Content -Path $file.FullName -Value $newContent -Force
                $count++
                Write-Output "Updated: $($file.FullName)"
            }
        }
        catch {
            Write-Error "Error processing $($file.FullName): $_"
        }
    }
    
    Write-Output "Replaced text in $count files"
}

# Example usage:
# New-DirectoryIfNotExists -Path "C:\\Temp\\BackupFiles"
# Copy-FilesWithProgress -SourceDir "C:\\Documents" -DestinationDir "C:\\Temp\\BackupFiles" -FileFilter "*.docx"
# Find-ReplaceInFiles -Directory "C:\\Temp\\BackupFiles" -FileFilter "*.txt" -FindText "old text" -ReplaceText "new text" -Backup
```

This script demonstrates several important file operation techniques in PowerShell:

1. Directory management with Test-Path and New-Item
2. File copying with progress bar display
3. Finding and replacing text in multiple files
4. Error handling for file operations
5. Parameter validation
6. Progress reporting with Write-Progress

You can use these functions individually or combine them into a larger workflow for file management tasks.

Would you like me to explain any of these functions in more detail?"""
    
    # Process management
    if any(term in user_message.lower() for term in ['process', 'running', 'services', 'stop', 'start']):
        return """Here's a PowerShell script for process and service management:

```powershell
# Process-Management.ps1
# Script for managing processes and services in PowerShell
# Author: PSScriptGPT
# Version: 1.0

# Get processes consuming the most memory
function Get-TopMemoryConsumers {
    param (
        [Parameter(Mandatory=$false)]
        [int]$Top = 10
    )
    
    Get-Process | 
        Sort-Object -Property WorkingSet64 -Descending | 
        Select-Object -First $Top -Property Name, ID, 
            @{Name="MemoryUsageMB"; Expression={[math]::Round($_.WorkingSet64 / 1MB, 2)}},
            CPU, Description
}

# Get processes consuming the most CPU
function Get-TopCpuConsumers {
    param (
        [Parameter(Mandatory=$false)]
        [int]$Top = 10,
        
        [Parameter(Mandatory=$false)]
        [int]$SampleInterval = 5
    )
    
    Write-Output "Sampling CPU usage for $SampleInterval seconds..."
    
    # Get initial CPU times
    $initialProcesses = Get-Process | Select-Object ID, Name, @{Name="TotalProcessorTime"; Expression={$_.TotalProcessorTime}}
    
    # Wait for sample interval
    Start-Sleep -Seconds $SampleInterval
    
    # Get updated CPU times and calculate difference
    $currentProcesses = Get-Process
    
    $cpuUsage = @()
    foreach ($currentProcess in $currentProcesses) {
        $initialProcess = $initialProcesses | Where-Object { $_.ID -eq $currentProcess.ID }
        
        if ($initialProcess) {
            $cpuTimeDiff = ($currentProcess.TotalProcessorTime - $initialProcess.TotalProcessorTime).TotalSeconds
            
            $cpuUsage += [PSCustomObject]@{
                Name = $currentProcess.Name
                ID = $currentProcess.ID
                CPUSeconds = [math]::Round($cpuTimeDiff, 2)
                MemoryUsageMB = [math]::Round($currentProcess.WorkingSet64 / 1MB, 2)
                Description = $currentProcess.Description
            }
        }
    }
    
    # Return top CPU consumers
    $cpuUsage | Sort-Object -Property CPUSeconds -Descending | Select-Object -First $Top
}

# Safely stop a process with confirmation
function Stop-ProcessSafely {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Name,
        
        [Parameter(Mandatory=$false)]
        [switch]$Force,
        
        [Parameter(Mandatory=$false)]
        [switch]$ConfirmEach
    )
    
    $processes = Get-Process -Name $Name -ErrorAction SilentlyContinue
    
    if ($processes.Count -eq 0) {
        Write-Warning "No processes found with name '$Name'"
        return
    }
    
    Write-Output "Found $($processes.Count) processes with name '$Name'"
    
    foreach ($process in $processes) {
        $stopProcess = $true
        
        if ($ConfirmEach -and -not $Force) {
            $response = Read-Host "Stop process $($process.Name) (ID: $($process.ID))? [Y/N]"
            $stopProcess = $response -eq "Y" -or $response -eq "y"
        }
        
        if ($stopProcess) {
            try {
                if ($Force) {
                    $process | Stop-Process -Force -ErrorAction Stop
                    Write-Output "Forced stop of process $($process.Name) (ID: $($process.ID))"
                } else {
                    $process | Stop-Process -ErrorAction Stop
                    Write-Output "Gracefully stopped process $($process.Name) (ID: $($process.ID))"
                }
            }
            catch {
                Write-Error "Failed to stop process $($process.Name) (ID: $($process.ID)): $_"
            }
        }
    }
}

# Monitor service status
function Watch-ServiceStatus {
    param (
        [Parameter(Mandatory=$true)]
        [string[]]$ServiceNames,
        
        [Parameter(Mandatory=$false)]
        [int]$RefreshInterval = 5,
        
        [Parameter(Mandatory=$false)]
        [int]$Count = 10
    )
    
    $iteration = 0
    $previousStatuses = @{}
    
    # Initialize previous statuses
    foreach ($serviceName in $ServiceNames) {
        $previousStatuses[$serviceName] = (Get-Service -Name $serviceName -ErrorAction SilentlyContinue).Status
    }
    
    while ($iteration -lt $Count -or $Count -eq 0) {
        Clear-Host
        Write-Output "Service Status Monitor - Refresh: $RefreshInterval seconds - Press Ctrl+C to exit"
        Write-Output "Time: $(Get-Date)"
        Write-Output "------------------------------------------------------------------"
        
        foreach ($serviceName in $ServiceNames) {
            try {
                $service = Get-Service -Name $serviceName -ErrorAction Stop
                $currentStatus = $service.Status
                
                $statusChanged = $previousStatuses[$serviceName] -ne $currentStatus
                $statusColor = if ($currentStatus -eq "Running") { "Green" } elseif ($currentStatus -eq "Stopped") { "Red" } else { "Yellow" }
                $changeIndicator = if ($statusChanged) { " [CHANGED]" } else { "" }
                
                Write-Host "$($service.DisplayName) [$serviceName]: " -NoNewline
                Write-Host "$currentStatus$changeIndicator" -ForegroundColor $statusColor
                
                $previousStatuses[$serviceName] = $currentStatus
            }
            catch {
                Write-Host "$serviceName: " -NoNewline
                Write-Host "Not Found" -ForegroundColor Red
            }
        }
        
        $iteration++
        if ($Count -eq 0 -or $iteration -lt $Count) {
            Start-Sleep -Seconds $RefreshInterval
        }
    }
}

# Example usage:
# Get-TopMemoryConsumers -Top 5
# Get-TopCpuConsumers -Top 5 -SampleInterval 3
# Stop-ProcessSafely -Name "notepad" -ConfirmEach
# Watch-ServiceStatus -ServiceNames "wuauserv", "spooler" -RefreshInterval 2 -Count 10
```

This script demonstrates:

1. Monitoring memory usage of processes
2. Tracking CPU usage over time
3. Safely stopping processes with confirmation
4. Watching services with status change indicators

These functions can be useful for system administrators who need to monitor and manage processes and services on Windows systems.

Would you like me to explain how any of these functions work in more detail?"""
    
    # Provide a generic response for other queries
    return """I'm running in mock mode because no valid API key was provided. In production, I would use an AI model to generate helpful responses about PowerShell scripting. 

Here's a simple PowerShell function that demonstrates best practices:

```powershell
function Get-FileStats {
    <#
    .SYNOPSIS
        Gets statistics about files in a directory.
    
    .DESCRIPTION
        This function analyzes files in a specified directory and returns
        statistics like count, total size, and average size.
    
    .PARAMETER Path
        The directory path to analyze. Defaults to current directory.
    
    .PARAMETER Filter
        Optional file filter (e.g., "*.txt"). Defaults to all files.
    
    .EXAMPLE
        Get-FileStats -Path "C:\\Documents" -Filter "*.docx"
        
        Returns statistics for all .docx files in C:\\Documents.
    #>
    [CmdletBinding()]
    param (
        [Parameter(Position=0)]
        [string]$Path = (Get-Location),
        
        [Parameter(Position=1)]
        [string]$Filter = "*"
    )
    
    begin {
        Write-Verbose "Analyzing files in $Path with filter '$Filter'"
        $fileSizes = @()
        $totalSize = 0
    }
    
    process {
        try {
            $files = Get-ChildItem -Path $Path -Filter $Filter -File -ErrorAction Stop
            
            foreach ($file in $files) {
                $fileSizes += $file.Length
                $totalSize += $file.Length
            }
            
            $averageSize = if ($files.Count -gt 0) { $totalSize / $files.Count } else { 0 }
            
            [PSCustomObject]@{
                DirectoryPath = $Path
                FileFilter = $Filter
                FileCount = $files.Count
                TotalSizeBytes = $totalSize
                TotalSizeMB = [math]::Round($totalSize / 1MB, 2)
                AverageSizeBytes = [math]::Round($averageSize, 2)
                AverageSizeMB = [math]::Round($averageSize / 1MB, 4)
                LargestFileBytes = if ($fileSizes.Count -gt 0) { ($fileSizes | Measure-Object -Maximum).Maximum } else { 0 }
                SmallestFileBytes = if ($fileSizes.Count -gt 0) { ($fileSizes | Measure-Object -Minimum).Minimum } else { 0 }
            }
        }
        catch {
            Write-Error "Error analyzing files: $_"
        }
    }
}
```

Is there a specific PowerShell topic you'd like me to cover?"""

@app.post("/chat", response_model=ChatResponse, tags=["Chat"])
async def chat_with_powershell_expert(request: ChatRequest):
    """Chat with a PowerShell expert AI assistant."""
    try:
        # Default system prompt for PowerShell expertise
        default_system_prompt = """
        You are PSScriptGPT, a specialized PowerShell scripting assistant with expertise in Windows system administration, automation, and scripting best practices.
        
        Your primary goal is to help users write, understand, and improve PowerShell scripts.
        
        When providing answers:
        1. Offer complete, runnable code examples when appropriate
        2. Explain the "why" behind your recommendations, not just the "how"
        3. Highlight security considerations and best practices
        4. Consider performance implications of your suggestions
        5. Structure solutions to be modular and maintainable
        6. Respect PowerShell conventions and style guidelines
        7. When you don't know something, acknowledge it rather than guessing
        8. Format your code examples with ```powershell syntax for proper syntax highlighting
        9. Use a friendly, helpful tone while maintaining professionalism
        10. Recommend the most modern PowerShell approaches when applicable
        
        You have extensive knowledge about:
        - PowerShell language features up to PowerShell 7.4
        - Windows system administration and management
        - Common PowerShell modules (ActiveDirectory, Azure, etc.)
        - Error handling and debugging techniques
        - PowerShell security considerations including ExecutionPolicy and script signing
        - Script optimization and performance analysis
        - PowerShell DSC (Desired State Configuration)
        - PowerShell remoting and cross-platform capabilities
        - Integration with other systems (APIs, databases, etc.)
        - PowerShell module development and packaging
        - CI/CD pipelines for PowerShell
        - PowerShell on Linux and macOS
        - PowerShell security best practices and avoiding common anti-patterns
        
        Your responses will be displayed in a code-focused environment, so markdown formatting for code blocks is essential. Always use proper PowerShell casing conventions (Pascal case for functions, cmdlets, etc.) and include comments in your code examples.
        
        For complex tasks, consider breaking down your solution into steps or providing a function with clear parameters and documentation.
        """
        
        # Prepare the messages
        messages = [
            {
                "role": "system", 
                "content": request.system_prompt if request.system_prompt else default_system_prompt
            }
        ]
        
        # Add user conversation history
        for msg in request.messages:
            messages.append({"role": msg.role, "content": msg.content})
            
        # Use mock response in development mode
        if MOCK_MODE:
            assistant_response = get_mock_chat_response([{"role": m.role, "content": m.content} for m in request.messages])
        else:
            # Make the API call with retry logic
            @retry(
                stop=stop_after_attempt(3),
                wait=wait_exponential(min=1, max=10)
            )
            def get_chat_completion():
                return openai.ChatCompletion.create(
                    model="gpt-4o",  # Use a capable model for PowerShell expertise
                    messages=messages,
                    temperature=0.7,
                    max_tokens=4000,
                    top_p=1.0,
                    frequency_penalty=0.0,
                    presence_penalty=0.0
                )
            
            response = get_chat_completion()
            assistant_response = response.choices[0].message.content
        
        # Save the chat history to the database for future reference
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            
            # Store the chat conversation in a structured format
            cur.execute(
                """
                INSERT INTO chat_history
                (user_id, messages, response, timestamp)
                VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                RETURNING id
                """,
                (
                    1,  # Use a default user ID or extract from request
                    json.dumps([{"role": m.role, "content": m.content} for m in request.messages]),
                    assistant_response
                )
            )
            
            conn.commit()
        except Exception as e:
            print(f"Database error while saving chat history: {e}")
            # Continue even if database operation fails
        finally:
            if conn:
                conn.close()
        
        return {"response": assistant_response}
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat completion failed: {str(e)}"
        )

# Create a new table for chat history if it doesn't exist
def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create chat_history table if it doesn't exist
        cur.execute("""
        CREATE TABLE IF NOT EXISTS chat_history (
            id SERIAL PRIMARY KEY,
            user_id INTEGER,
            messages JSONB NOT NULL,
            response TEXT NOT NULL,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            embedding vector(1536) NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
        """)
        
        conn.commit()
        print("Database initialized with chat_history table")
    except Exception as e:
        print(f"Database initialization error: {e}")
    finally:
        if conn:
            conn.close()

# Initialize database when starting up
@app.on_event("startup")
async def startup_event():
    init_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

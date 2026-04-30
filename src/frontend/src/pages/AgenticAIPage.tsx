import React, { useState, useEffect } from 'react';
import {
  CircularProgress,
  Alert,
  Snackbar,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import HelpIcon from '@mui/icons-material/Help';
import PsychologyIcon from '@mui/icons-material/Psychology';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import SettingsIcon from '@mui/icons-material/Settings';
import { Link as RouterLink } from 'react-router-dom';

// Import CSS
import './AgenticAIPage.css';

// Import components
import AIAnalysisPanel from '../components/AIAnalysisPanel';
import PleaseMethodAgent from '../components/Agentic/PleaseMethodAgent';
import ScriptExamplesViewer, { ScriptExample } from '../components/Agentic/ScriptExamplesViewer';
import CodeEditor from '../components/CodeEditor'; // Correct import path

// Import API utilities
import { AIAnalysisResult, generateScript } from '../api/aiAgent';
import { runAIAgentWorkflow } from '../utils/aiAgentUtils';

// Tab panel component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ai-workflow-tabpanel-${index}`}
      aria-labelledby={`ai-workflow-tab-${index}`}
      {...other}
      className="agentic-ai-tab-panel"
    >
      {value === index && (
        <div className="agentic-ai-tab-panel-content">
          {children}
        </div>
      )}
    </div>
  );
};

// Mock script examples for testing
const MOCK_EXAMPLES: ScriptExample[] = [
  {
    id: 'ex1',
    title: 'System Information Collector',
    description: 'Collects detailed system information including OS, hardware, and installed software.',
    script: `# System Information Collector
# Gathers detailed information about the system

function Get-SystemDetails {
    $computerSystem = Get-CimInstance CIM_ComputerSystem
    $operatingSystem = Get-CimInstance CIM_OperatingSystem
    $processor = Get-CimInstance CIM_Processor
    $physicalMemory = Get-CimInstance CIM_PhysicalMemory | Measure-Object -Property Capacity -Sum
    $diskDrives = Get-CimInstance CIM_DiskDrive
    
    $systemInfo = [PSCustomObject]@{
        ComputerName = $computerSystem.Name
        Manufacturer = $computerSystem.Manufacturer
        Model = $computerSystem.Model
        OperatingSystem = $operatingSystem.Caption
        OSVersion = $operatingSystem.Version
        OSBuild = $operatingSystem.BuildNumber
        Processor = $processor.Name
        CPUCores = $processor.NumberOfCores
        MemoryGB = [math]::Round($physicalMemory.Sum / 1GB, 2)
        DiskCount = $diskDrives.Count
        TotalDiskSizeGB = [math]::Round(($diskDrives | Measure-Object -Property Size -Sum).Sum / 1GB, 2)
        LastBootTime = $operatingSystem.LastBootUpTime
        InstallDate = $operatingSystem.InstallDate
    }
    
    return $systemInfo
}

# Get system information
$systemInfo = Get-SystemDetails

# Display the results
$systemInfo | Format-List

# Optional: Export to file
# $systemInfo | Export-Csv -Path "$env:USERPROFILE\\Desktop\\SystemInfo.csv" -NoTypeInformation`,
    tags: ['System', 'Hardware', 'Information'],
    similarity: 0.92,
  },
  {
    id: 'ex2',
    title: 'Log Parser',
    description: 'Parses log files and extracts warnings and errors.',
    script: `# Log Parser
# Extracts warnings and errors from log files
param(
    [Parameter(Mandatory=$true)]
    [string]$LogPath,
    
    [Parameter(Mandatory=$false)]
    [string]$OutputPath = "$env:USERPROFILE\\Desktop\\LogResults.csv",
    
    [string[]]$Patterns = @("ERROR", "WARN", "EXCEPTION", "FAIL")
)

function Parse-Logs {
    param(
        [string]$LogPath,
        [string[]]$Patterns
    )
    
    if (!(Test-Path -Path $LogPath)) {
        Write-Error "Log path not found: $LogPath"
        return $null
    }
    
    $logs = Get-ChildItem -Path $LogPath -Filter "*.log" -Recurse
    
    $results = @()
    
    foreach ($log in $logs) {
        Write-Host "Processing $($log.FullName)..."
        
        $lineNumber = 0
        $content = Get-Content -Path $log.FullName
        
        foreach ($line in $content) {
            $lineNumber++
            
            foreach ($pattern in $Patterns) {
                if ($line -match $pattern) {
                    $results += [PSCustomObject]@{
                        LogFile = $log.Name
                        LineNumber = $lineNumber
                        Pattern = $pattern
                        Line = $line
                        Timestamp = if ($line -match '\\d{4}-\\d{2}-\\d{2}') { $matches[0] } else { "Not found" }
                    }
                    break
                }
            }
        }
    }
    
    return $results
}

# Parse logs
$results = Parse-Logs -LogPath $LogPath -Patterns $Patterns

# Display summary
Write-Host "Found $($results.Count) matches across $($results | Select-Object -Unique LogFile | Measure-Object).Count files."

# Export results
if ($results.Count -gt 0) {
    $results | Export-Csv -Path $OutputPath -NoTypeInformation
    Write-Host "Results exported to $OutputPath"
}`,
    tags: ['Logs', 'Parser', 'Monitoring'],
    similarity: 0.85,
    source: 'PowerShell Community Scripts',
  },
];

const workflowTabs = [
  {
    label: 'Examples',
    description: 'Generate or load starter scripts',
    icon: SearchIcon,
  },
  {
    label: 'Script Editor',
    description: 'Edit and prepare the active file',
    icon: CodeIcon,
  },
  {
    label: 'AI Analysis',
    description: 'Review quality and risk findings',
    icon: PsychologyIcon,
  },
  {
    label: 'AI Assistant',
    description: 'Ask follow-up questions',
    icon: HelpIcon,
  },
];

/**
 * Agentic AI Workflow Page
 * Main container for all AI-powered features
 */
const AgenticAIPage: React.FC = () => {
  // State for tabs
  const [activeTab, setActiveTab] = useState(0);
  
  // State for script code
  const [scriptCode, setScriptCode] = useState('');
  const [scriptName, setScriptName] = useState('');
  
  // State for analysis
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // State for script examples
  const [scriptExamples, setScriptExamples] = useState<ScriptExample[]>([]);
  const [isLoadingExamples, setIsLoadingExamples] = useState(false); // eslint-disable-line @typescript-eslint/no-unused-vars
  
  // State for generation
  const [generationPrompt, setGenerationPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingAssistantQuestion, setPendingAssistantQuestion] = useState<{ id: number; question: string } | null>(null);
  
  // State for notification
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info' as 'info' | 'success' | 'warning' | 'error',
  });
  
  // Load examples on component mount
  useEffect(() => {
    // In a real implementation, we would fetch examples from API
    // For now, use mock data
    setScriptExamples(MOCK_EXAMPLES);
  }, []);
  
  // Handle tab change
  const handleTabChange = (newValue: number) => setActiveTab(newValue);
  
  // Handle script analysis
  const handleAnalyzeScript = async () => {
    if (!scriptCode.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a script to analyze',
        severity: 'warning',
      });
      return;
    }
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const result = await runAIAgentWorkflow(
        scriptCode,
        scriptName || 'script.ps1',
        false
      );
      
      setAiAnalysis(result.analysis);
      
      if (result.error) {
        setAnalysisError(result.error);
      }
      
      if (result.examples.length > 0) {
        // Convert to our ScriptExample format
        const formattedExamples: ScriptExample[] = result.examples.map((ex, i) => ({
          id: `gen-${i}`,
          title: ex.title || `Example ${i + 1}`,
          description: ex.description || '',
          script: ex.script || '',
          tags: ex.tags || [],
          similarity: ex.similarity || 0.5,
          source: 'AI Generated',
        }));
        
        setScriptExamples(formattedExamples);
      }
    } catch (error) {
      setAnalysisError(error instanceof Error ? error.message : 'An error occurred during analysis');
      console.error('Error analyzing script:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Handle script generation
  const handleGenerateScript = async () => {
    if (!generationPrompt.trim()) {
      setNotification({
        open: true,
        message: 'Please enter a description of the script you want to generate',
        severity: 'warning',
      });
      return;
    }

    setIsGenerating(true);

    try {
      const generatedCode = await generateScript(generationPrompt);

      if (generatedCode) {
        setScriptCode(generatedCode);
        setScriptName(generationPrompt.split(' ').slice(0, 3).join('-') + '.ps1');

        // Switch to editor tab
        setActiveTab(1);

        setNotification({
          open: true,
          message: 'Script generated successfully! You can now edit it in the editor.',
          severity: 'success',
        });
      }
    } catch (error) {
      console.error('Error generating script:', error);

      // Provide more specific error messages based on error type
      let errorMessage = 'Error generating script. Please try again.';

      if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();
        if (errorMsg.includes('api key') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
          errorMessage = 'AI service authentication failed. Please sign in again or contact an admin.';
        } else if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
          errorMessage = 'Rate limit exceeded. Please wait a moment and try again.';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (errorMsg.includes('500') || errorMsg.includes('server')) {
          errorMessage = 'Server error. The AI service may be temporarily unavailable.';
        }
      }

      setNotification({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    } finally {
      setIsGenerating(false);
    }
  };
  
  // Handle using an example script
  const handleUseExample = (example: ScriptExample) => {
    setScriptCode(example.script);
    setScriptName(example.title.toLowerCase().replace(/\s+/g, '-') + '.ps1');
    
    // Switch to editor tab
    setActiveTab(1);
    
    setNotification({
      open: true,
      message: `Example script "${example.title}" loaded into the editor`,
      severity: 'success',
    });
  };
  
  // Handle uploading a script file
  const handleUploadScript = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setScriptCode(content);
        setScriptName(file.name);
      };
      reader.readAsText(file);
    }
  };
  
  // Handle notification close
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  // Handle AI assistant script generation
  const handleScriptFromAssistant = (script: string) => {
    setScriptCode(script);
    setScriptName('assistant-generated.ps1');
    
    // Switch to editor tab
    setActiveTab(1);
    
    setNotification({
      open: true,
      message: 'Script generated by AI Assistant loaded into the editor',
      severity: 'success',
    });
  };
  
  // Handle asking AI about current script
  const handleAskAboutScript = (question: string) => {
    // Switch to assistant tab
    setPendingAssistantQuestion({ id: Date.now(), question });
    setActiveTab(3);

    setNotification({
      open: true,
      message: 'Question sent to AI Assistant',
      severity: 'info',
    });
  };
  
  return (
    <div className="agentic-ai-container">
      <section className="agentic-ai-hero">
        <div className="agentic-ai-hero-copy">
          <p className="agentic-ai-kicker">AI Workbench</p>
          <h1>PowerShell AI Assistant</h1>
          <p>
            Generate, edit, analyze, and discuss PowerShell scripts in one hosted workflow that fits the rest of PSScript.
          </p>
        </div>
        <div className="agentic-ai-hero-actions">
          <RouterLink to="/settings/api" className="agentic-ai-btn agentic-ai-btn-secondary">
            <SettingsIcon fontSize="small" />
            API Settings
          </RouterLink>
          <label className="agentic-ai-btn agentic-ai-btn-primary">
            <FileUploadIcon fontSize="small" />
            Upload Script
            <input type="file" hidden accept=".ps1" onChange={handleUploadScript} />
          </label>
        </div>
      </section>

      <section className="agentic-ai-summary-grid" aria-label="AI assistant workflow summary">
        {workflowTabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeTab === index;
          return (
            <button
              key={tab.label}
              type="button"
              className={`agentic-ai-summary-card ${isActive ? 'is-active' : ''}`}
              onClick={() => handleTabChange(index)}
              aria-pressed={isActive}
            >
              <span className="agentic-ai-summary-icon">
                <Icon fontSize="small" />
              </span>
              <span>
                <strong>{tab.label}</strong>
                <small>{tab.description}</small>
              </span>
            </button>
          );
        })}
      </section>

      <nav className="agentic-ai-tabs" aria-label="AI workflow tabs">
        {workflowTabs.map((tab, index) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.label}
              type="button"
              className={`agentic-ai-tab ${activeTab === index ? 'is-active' : ''}`}
              id={`ai-workflow-tab-${index}`}
              aria-controls={`ai-workflow-tabpanel-${index}`}
              aria-selected={activeTab === index}
              role="tab"
              onClick={() => handleTabChange(index)}
            >
              <Icon fontSize="small" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab panels */}
      <div className="agentic-ai-tab-content">
        {/* Examples Tab */}
        <TabPanel value={activeTab} index={0}>
          <div className="agentic-ai-workspace-grid">
            <div className="agentic-ai-panel agentic-ai-generator-panel">
              <div>
                <p className="agentic-ai-panel-label">Prompt builder</p>
                <h2>Generate a Script</h2>
                <p className="agentic-ai-muted">
                  Describe what you want the script to do, and our AI will generate a PowerShell script for you.
                </p>
              </div>

              <label className="agentic-ai-field-label" htmlFor="generation-prompt">
                Script request
              </label>
              <textarea
                  id="generation-prompt"
                  value={generationPrompt}
                  onChange={(e) => setGenerationPrompt(e.target.value)}
                  placeholder="E.g., Create a script that monitors CPU and memory usage and sends an email alert when thresholds are exceeded"
                  className="agentic-ai-textarea"
                  rows={6}
                />
                
                <button
                  type="button"
                  className="agentic-ai-btn agentic-ai-btn-primary agentic-ai-btn-full"
                  onClick={handleGenerateScript}
                  disabled={isGenerating || !generationPrompt.trim()}
                >
                  {isGenerating && <CircularProgress size={18} color="inherit" />}
                  {isGenerating ? 'Generating...' : 'Generate Script'}
                </button>

              <div className="agentic-ai-upload-card">
                <p className="agentic-ai-panel-label">Local intake</p>
                <h3>Upload a Script</h3>
                <p className="agentic-ai-muted">Load a `.ps1` file into this workbench for editing or analysis.</p>
                <label className="agentic-ai-btn agentic-ai-btn-secondary agentic-ai-btn-full">
                  <FileUploadIcon fontSize="small" />
                  Choose PowerShell File
                  <input
                    type="file"
                    hidden
                    accept=".ps1"
                    onChange={handleUploadScript}
                  />
                </label>
              </div>
            </div>
            
            <div className="agentic-ai-panel agentic-ai-examples-panel">
                <ScriptExamplesViewer
                  examples={scriptExamples}
                  isLoading={isLoadingExamples}
                  onSelectExample={handleUseExample}
                />
            </div>
          </div>
        </TabPanel>
        
        {/* Script Editor Tab */}
        <TabPanel value={activeTab} index={1}>
          <div className="agentic-ai-panel agentic-ai-editor-panel">
            <div className="agentic-ai-header">
              <div className="agentic-ai-editor-title">
                <p className="agentic-ai-panel-label">Active script</p>
                <h2>Script Editor</h2>
                <input
                  value={scriptName}
                  onChange={(e) => setScriptName(e.target.value)}
                  placeholder="script.ps1"
                  className="agentic-ai-input"
                  aria-label="Script filename"
                />
              </div>
              
              <div className="agentic-ai-action-buttons">
                <button
                  type="button"
                  className="agentic-ai-btn agentic-ai-btn-primary"
                  onClick={handleAnalyzeScript}
                  disabled={isAnalyzing || !scriptCode.trim()}
                >
                  {isAnalyzing && <CircularProgress size={18} color="inherit" />}
                  {isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}
                </button>
                
                <button
                  type="button"
                  className="agentic-ai-btn agentic-ai-btn-secondary"
                  onClick={() => handleAskAboutScript("How can I improve this script?")}
                  disabled={!scriptCode.trim()}
                >
                  Ask AI Assistant
                </button>
              </div>
            </div>
            
            <div className="agentic-ai-divider" />
            
            <div className="agentic-ai-editor-container">
              <CodeEditor
                value={scriptCode}
                onChange={setScriptCode}
                language="powershell"
                height="100%"
              />
            </div>
          </div>
        </TabPanel>
        
        {/* AI Analysis Tab */}
        <TabPanel value={activeTab} index={2}>
          <div className="agentic-ai-panel">
            <AIAnalysisPanel
              analysis={aiAnalysis}
              isLoading={isAnalyzing}
              error={analysisError}
              onAskQuestion={handleAskAboutScript}
            />
          </div>
        </TabPanel>
        
        {/* AI Assistant Tab */}
        <TabPanel value={activeTab} index={3}>
          <div className="agentic-ai-panel">
            <PleaseMethodAgent
              activeScript={scriptCode}
              onScriptGenerated={handleScriptFromAssistant}
              pendingQuestion={pendingAssistantQuestion?.question}
              pendingQuestionId={pendingAssistantQuestion?.id}
            />
          </div>
        </TabPanel>
      </div>
      
      {/* Notifications */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
          action={
            <IconButton
              size="small"
              aria-label="close"
              color="inherit"
              onClick={handleCloseNotification}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default AgenticAIPage;

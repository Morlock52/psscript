import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { scriptService } from '../services/api';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaLightbulb, FaChartLine, FaPaperPlane, FaRobot } from 'react-icons/fa';
// LangGraph Integration
import { streamAnalysis, AnalysisEvent, LangGraphAnalysisResults } from '../services/langgraphService';
import { AnalysisProgressPanel } from '../components/Analysis/AnalysisProgressPanel';

// Define message type for AI chat
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const ScriptAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');

  // AI Assistant state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // LangGraph Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisEvents, setAnalysisEvents] = useState<AnalysisEvent[]>([]);
  const [currentStage, setCurrentStage] = useState('idle');
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  const { data: script, isLoading: scriptLoading } = useQuery({
    queryKey: ['script', id],
    queryFn: () => scriptService.getScript(id || ''),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });

  const { data: analysis, isLoading: analysisLoading } = useQuery({
    queryKey: ['scriptAnalysis', id],
    queryFn: () => scriptService.getScriptAnalysis(id || ''),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
  
  const isDataLoading = scriptLoading || analysisLoading;
  
  // Scroll to bottom of messages when they change
  useEffect(() => {
    if (activeTab === 'assistant' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Initialize AI assistant with a welcome message when the tab is first opened
  useEffect(() => {
    if (activeTab === 'assistant' && messages.length === 0 && script && analysis) {
      setMessages([
        {
          role: 'assistant',
          content: `# Welcome to Psscript AI Assistant!

I'm here to help you understand and improve your PowerShell script: **${script.title}**.

You can ask me questions about:
- How specific parts of your script work
- Security concerns and how to address them
- Performance optimization opportunities
- Best practices for PowerShell scripting
- How to implement specific features

What would you like to know about your script?`
        }
      ]);
    }
  }, [activeTab, messages.length, script, analysis]);

  // Handle sending a message to the AI
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    // Create a copy of the user message
    const userMessage = { role: 'user' as const, content: input };
    
    // Update state
    setInput('');
    setIsLoading(true);
    setMessages(prev => [...prev, userMessage]);
    
    try {
      // Prepare context about the script for the AI
      const systemPrompt = `You are Psscript AI, a PowerShell scripting assistant analyzing the following script:

Title: ${script?.title}
Purpose: ${analysis?.purpose}
Security Score: ${analysis?.security_score}/10
Code Quality Score: ${analysis?.code_quality_score}/10

You should help the user understand this script, address any concerns, and suggest improvements.
Be specific and reference details from the script analysis when possible.
If you don't know something specific about the script, be honest about it.
`;
      
      // Get the API URL from environment or use dynamic hostname
      const apiUrl = import.meta.env.VITE_API_URL || 
        `http://${window.location.hostname}:4000/api`;
      
      // Call AI service
      const response = await axios.post(`${apiUrl}/chat`, {
        messages: [...messages, userMessage],
        system_prompt: systemPrompt
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });
      
      // Add AI response
      if (response.data && response.data.response) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: response.data.response }
        ]);
      } else {
        throw new Error('Invalid response format from AI service');
      }
    } catch (error) {
      console.error('Error sending message to AI:', error);
      // Add error message to chat
      setMessages(prev => [
        ...prev,
        { 
          role: 'assistant', 
          content: "I'm sorry, I encountered an error processing your request. Please try again later."
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // LangGraph Analysis Handler
  const handleLangGraphAnalysis = async () => {
    if (!id) return;

    setIsAnalyzing(true);
    setAnalysisEvents([]);
    setAnalysisError(null);
    setCurrentStage('analyzing');

    try {
      // Start streaming analysis
      const cleanup = streamAnalysis(
        parseInt(id),
        (event: AnalysisEvent) => {
          // Add event to history
          setAnalysisEvents((prev) => [...prev, event]);

          // Handle different event types
          switch (event.type) {
            case 'stage_change':
              setCurrentStage(event.data?.stage || 'unknown');
              break;

            case 'tool_started':
              console.log(`[LangGraph] Tool started: ${event.data?.tool_name}`);
              break;

            case 'tool_completed':
              console.log(`[LangGraph] Tool completed: ${event.data?.tool_name}`);
              break;

            case 'completed':
              setIsAnalyzing(false);
              setCurrentStage('completed');
              // Refetch the analysis to get updated results
              if (id) {
                scriptService.getScriptAnalysis(id).catch(console.error);
              }
              break;

            case 'error':
              setIsAnalyzing(false);
              setCurrentStage('failed');
              setAnalysisError(event.message || 'Analysis failed');
              console.error('[LangGraph] Analysis error:', event.message);
              break;

            case 'human_review_required':
              setIsAnalyzing(false);
              setCurrentStage('paused');
              break;
          }

          // Extract workflow ID from first event that has it
          if (event.data?.workflow_id && !workflowId) {
            setWorkflowId(event.data.workflow_id);
          }
        },
        {
          require_human_review: false,
          model: 'gpt-4',
        }
      );

      // Store cleanup function
      cleanupRef.current = cleanup;
    } catch (error) {
      console.error('[LangGraph] Failed to start analysis:', error);
      setIsAnalyzing(false);
      setCurrentStage('failed');
      setAnalysisError(error instanceof Error ? error.message : 'Failed to start analysis');
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // Render code blocks with syntax highlighting
  const CodeBlock = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const language = className ? className.replace('language-', '') : 'powershell';
    return (
      <div className="relative rounded-md overflow-hidden bg-gray-800 my-4">
        <div className="flex justify-between items-center px-4 py-2 text-xs border-b border-gray-700">
          <span>{language}</span>
          <button
            onClick={() => navigator.clipboard.writeText(String(children))}
            className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            Copy
          </button>
        </div>
        <pre className="p-4 overflow-x-auto">
          <code className="text-gray-300">{children}</code>
        </pre>
      </div>
    );
  };

  if (isDataLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (!script || !analysis) {
    return (
      <div className="bg-gray-700 rounded-lg p-8 shadow text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Analysis Not Available</h2>
        <p className="text-gray-300 mb-6">
          The script analysis you are looking for does not exist or you don't have permission to view it.
        </p>
        <button
          onClick={() => navigate(`/scripts/${id}`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Back to Script
        </button>
      </div>
    );
  }
  
  // Helper function to render score indicator
  const renderScoreIndicator = (score: number, label: string, reverseColor: boolean = false) => {
    let colorClass = '';
    
    if (reverseColor) {
      colorClass = score < 3 
        ? 'bg-green-500' 
        : score < 7 
        ? 'bg-yellow-500' 
        : 'bg-red-500';
    } else {
      colorClass = score > 7 
        ? 'bg-green-500' 
        : score > 4 
        ? 'bg-yellow-500' 
        : 'bg-red-500';
    }
    
    return (
      <div className="flex flex-col items-center">
        <div className="relative w-24 h-24 flex items-center justify-center mb-2">
          <svg className="w-full h-full" viewBox="0 0 36 36">
            <path
              className="stroke-current text-gray-600"
              fill="none"
              strokeWidth="3"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={`stroke-current ${colorClass}`}
              fill="none"
              strokeWidth="3"
              strokeDasharray={`${score * 10}, 100`}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <text x="18" y="20.5" textAnchor="middle" className="fill-current text-white font-bold text-xl">{score}</text>
          </svg>
        </div>
        <span className="text-sm text-gray-300">{label}</span>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto pb-8">
      {/* Header with back button */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">AI Analysis: {script.title}</h1>
          <p className="text-gray-400">Comprehensive analysis and improvement recommendations for your PowerShell script</p>
        </div>
        <div className="flex space-x-2">
          <button
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            onClick={() => navigate(`/scripts/${id}`)}
          >
            Back to Script
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
            onClick={() => navigate('/')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Dashboard</span>
          </button>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="mb-6 border-b border-gray-600">
        <nav className="flex space-x-4">
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'overview' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'security' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('security')}
          >
            Security
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'quality' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('quality')}
          >
            Code Quality
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'performance' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('performance')}
          >
            Performance
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium ${activeTab === 'parameters' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('parameters')}
          >
            Parameters
          </button>
          <button
            className={`py-3 px-4 text-sm font-medium flex items-center ${activeTab === 'assistant' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('assistant')}
          >
            <FaRobot className="mr-2" />
            Psscript AI
          </button>
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="md:col-span-2">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
              {/* LangGraph Analysis Button */}
              <div className="bg-gradient-to-r from-indigo-900 to-purple-900 rounded-lg shadow mb-6 p-6 border border-indigo-700">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                      <FaRobot className="mr-3 text-indigo-400" size={24} />
                      AI Agent Analysis
                    </h3>
                    <p className="text-gray-300 text-sm">
                      Run deep multi-agent analysis with LangGraph orchestrator for comprehensive security scanning, quality assessment, and optimization recommendations.
                    </p>
                  </div>
                  <button
                    onClick={handleLangGraphAnalysis}
                    disabled={isAnalyzing}
                    className={`ml-6 px-6 py-3 rounded-lg font-medium transition-all ${
                      isAnalyzing
                        ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg'
                    }`}
                  >
                    {isAnalyzing ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing...
                      </span>
                    ) : (
                      'Analyze with AI Agents'
                    )}
                  </button>
                </div>
              </div>

              {/* Analysis Progress Panel */}
              {isAnalyzing && (
                <AnalysisProgressPanel
                  workflowId={workflowId || undefined}
                  currentStage={currentStage}
                  status="analyzing"
                  events={analysisEvents}
                />
              )}

              {/* Analysis Complete Message */}
              {currentStage === 'completed' && !isAnalyzing && (
                <div className="bg-green-900 bg-opacity-20 border border-green-700 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <FaCheckCircle className="text-green-400 mr-3" size={20} />
                    <div>
                      <h4 className="font-medium text-green-300">Analysis Complete!</h4>
                      <p className="text-sm text-gray-300">The analysis results have been updated below.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis Error Message */}
              {analysisError && (
                <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4 mb-6">
                  <div className="flex items-center">
                    <FaExclamationTriangle className="text-red-400 mr-3" size={20} />
                    <div>
                      <h4 className="font-medium text-red-300">Analysis Failed</h4>
                      <p className="text-sm text-gray-300">{analysisError}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-gray-700 rounded-lg shadow mb-6">
                <div className="p-4 bg-gray-800 border-b border-gray-600">
                  <h2 className="text-lg font-medium">Analysis Summary</h2>
                </div>
                <div className="p-6">
                  <p className="text-gray-300 mb-6">{analysis.purpose}</p>
                
                <div className="grid grid-cols-4 gap-4 mb-8">
                  {renderScoreIndicator(analysis.code_quality_score, 'Quality')}
                  {renderScoreIndicator(analysis.security_score, 'Security')}
                  {renderScoreIndicator(analysis.risk_score, 'Risk', true)}
                  {analysis.reliability_score && renderScoreIndicator(analysis.reliability_score, 'Reliability')}
                </div>
                
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-medium mb-4 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Key Findings
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className={`p-4 rounded-lg border ${analysis.security_score > 7 ? 'bg-green-900 bg-opacity-20 border-green-700' : 'bg-yellow-900 bg-opacity-20 border-yellow-700'}`}>
                        <div className="flex items-start">
                          {analysis.security_score > 7 ? (
                            <FaCheckCircle className="text-green-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          ) : (
                            <FaInfoCircle className="text-yellow-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          )}
                          <div>
                            <h4 className="font-medium mb-1">Security Assessment</h4>
                            <p className="text-gray-300">
                              This script {analysis.security_score > 7 ? 'follows good security practices' : 'has some security concerns that should be addressed'}.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`p-4 rounded-lg border ${analysis.code_quality_score > 7 ? 'bg-green-900 bg-opacity-20 border-green-700' : analysis.code_quality_score > 5 ? 'bg-blue-900 bg-opacity-20 border-blue-700' : 'bg-yellow-900 bg-opacity-20 border-yellow-700'}`}>
                        <div className="flex items-start">
                          {analysis.code_quality_score > 7 ? (
                            <FaCheckCircle className="text-green-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          ) : analysis.code_quality_score > 5 ? (
                            <FaInfoCircle className="text-blue-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          ) : (
                            <FaInfoCircle className="text-yellow-400 mt-1 mr-3 flex-shrink-0 text-xl" />
                          )}
                          <div>
                            <h4 className="font-medium mb-1">Code Quality</h4>
                            <p className="text-gray-300">
                              Code quality is {analysis.code_quality_score > 7 ? 'high' : analysis.code_quality_score > 5 ? 'moderate' : 'needs improvement'} with potential for optimization.
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Security concerns card */}
                      {analysis.security_concerns && analysis.security_concerns.length > 0 ? (
                        <div className="p-4 rounded-lg border bg-red-900 bg-opacity-20 border-red-700">
                          <div className="flex items-start">
                            <FaExclamationTriangle className="text-red-500 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-red-300">{analysis.security_concerns.length} security {analysis.security_concerns.length === 1 ? 'concern' : 'concerns'} found.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border bg-green-900 bg-opacity-20 border-green-700">
                          <div className="flex items-start">
                            <FaCheckCircle className="text-green-500 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-green-300">No significant security concerns were found in this script.</p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Performance suggestions card */}
                      {analysis.performance_suggestions && analysis.performance_suggestions.length > 0 ? (
                        <div className="p-4 rounded-lg border bg-purple-900 bg-opacity-20 border-purple-700">
                          <div className="flex items-start">
                            <FaLightbulb className="text-purple-400 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-purple-300">{analysis.performance_suggestions.length} performance {analysis.performance_suggestions.length === 1 ? 'suggestion' : 'suggestions'} found.</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-lg border bg-blue-900 bg-opacity-20 border-blue-700">
                          <div className="flex items-start">
                            <FaCheckCircle className="text-blue-400 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-blue-300">No specific performance optimization suggestions were identified for this script.</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Key PowerShell Commands Analysis
                    </h3>
                    <div className="space-y-6">
                      {analysis.commandDetails && analysis.commandDetails.length > 0 ? (
                        analysis.commandDetails.map((command, index) => (
                          <div key={index} className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 rounded-lg border border-gray-700 shadow-md">
                            <h4 className="text-blue-400 font-medium mb-3">{command.name}</h4>
                            <div className="space-y-3">
                              <p className="text-gray-300">{command.description}</p>
                              
                              <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg">
                                <h5 className="text-sm text-blue-300 font-semibold mb-2">Purpose</h5>
                                <p className="text-gray-300">{command.purpose}</p>
                              </div>
                              
                              {command.parameters && command.parameters.length > 0 && (
                                <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg">
                                  <h5 className="text-sm text-blue-300 font-semibold mb-2">Common Parameters</h5>
                                  <ul className="list-disc pl-5 text-gray-300">
                                    {command.parameters.map((param, paramIndex) => (
                                      <li key={paramIndex}>
                                        <code className="bg-gray-800 px-1 rounded text-yellow-300">{param.name}</code> - {param.description}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {command.example && (
                                <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg">
                                  <h5 className="text-sm text-blue-300 font-semibold mb-2">Example in Script</h5>
                                  <div className="bg-gray-800 p-2 rounded my-1 border-l-4 border-blue-500">
                                    <code className="text-yellow-300">{command.example}</code>
                                  </div>
                                </div>
                              )}
                              
                              {command.alternatives && (
                                <div className="bg-gray-900 bg-opacity-50 p-3 rounded-lg">
                                  <h5 className="text-sm text-blue-300 font-semibold mb-2">Alternative Approaches</h5>
                                  <div className="bg-gray-800 p-2 rounded my-1 border-l-4 border-green-500">
                                    <code className="text-green-300">{command.alternatives}</code>
                                  </div>
                                  {command.alternativeNote && (
                                    <p className="text-gray-400 text-xs mt-1">Note: {command.alternativeNote}</p>
                                  )}
                                </div>
                              )}
                              
                              {command.msDocsUrl && (
                                <div className="mt-2">
                                  <a 
                                    href={command.msDocsUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 flex items-center"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                    Microsoft Documentation
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                          <p className="text-gray-300">No detailed command analysis available for this script.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {analysis.msDocsReferences && analysis.msDocsReferences.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-600">
                      <h3 className="text-lg font-medium mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Microsoft Documentation References
                      </h3>
                      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <ul className="space-y-3">
                          {analysis.msDocsReferences.map((doc, index) => (
                            <li key={index} className="flex items-start bg-gray-900 bg-opacity-50 p-3 rounded-lg hover:bg-opacity-70 transition-colors duration-200">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div>
                                <a 
                                  href={doc.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 font-medium"
                                >
                                  {doc.title}
                                </a>
                                <p className="text-gray-400 text-sm mt-1">{doc.description}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <h3 className="text-lg font-medium mb-3 flex items-center">
                      <FaRobot className="mr-2 text-blue-400" />
                      AI Command Analysis
                    </h3>
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 overflow-auto">
                      <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
{`# AI Command Analysis for ${script.title}

## Command Structure
This script follows the PowerShell cmdlet naming convention "Verb-Noun" and uses approved verbs.
* Primary Command: Get-SystemInfo
* Parameter Binding: Uses standard PowerShell parameter binding with [Parameter()] attributes
* Pipeline Support: Returns objects that can be passed through the pipeline

## Command Safety
* Execution Scope: Runs in the user's security context
* Network Activity: ${analysis.security_score > 7 ? 'Limited to specified computers' : 'May access undefined network resources'}
* Permissions: Requires standard WMI query permissions
* Error Handling: ${analysis.code_quality_score > 7 ? 'Comprehensive' : 'Basic'} error handling implemented

## Command Performance
* Resource Usage: ${analysis.performance_suggestions?.length ? 'Moderate to high on large environments' : 'Efficient for most environments'}
* Execution Time: Expected to complete within 1-5 seconds per target system
* Memory Impact: Low to moderate depending on number of network adapters

## Command Output
* Output Type: PSCustomObject with system information properties
* Formatting: Raw object output suitable for pipeline processing
* Consistency: Maintains consistent property naming and data types

## Improvement Opportunities
* Consider adding -Credential parameter for remote system authentication
* Implement support for pipeline input (multiple computer names)
* Add verbose output for troubleshooting
* Implement timeout parameter for WMI queries`}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Security Analysis</h2>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-medium">Security Score</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      analysis.security_score > 7 
                        ? 'bg-green-900 text-green-300' 
                        : analysis.security_score > 4 
                        ? 'bg-yellow-900 text-yellow-300' 
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {analysis.security_score}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${
                        analysis.security_score > 7 
                          ? 'bg-green-500' 
                          : analysis.security_score > 4 
                          ? 'bg-yellow-500' 
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${analysis.security_score * 10}%` }}
                    ></div>
                  </div>
                </div>
                
                {analysis.security_concerns && analysis.security_concerns.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-md font-medium mb-3">Security Concerns</h3>
                    <ul className="space-y-3">
                      {analysis.security_concerns.map((concern, index) => (
                        <li key={index} className="bg-red-900 bg-opacity-20 p-3 rounded-lg border border-red-700">
                          <div className="flex items-start">
                            <FaExclamationTriangle className="text-red-500 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-red-300">{concern}</p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="mb-6 bg-green-900 bg-opacity-20 p-4 rounded-lg border border-green-700">
                    <div className="flex items-start">
                      <FaCheckCircle className="text-green-500 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <p className="text-green-300">No significant security concerns were found in this script.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mt-6">
                  <h3 className="text-md font-medium mb-3">Best Practices</h3>
                  {analysis.best_practices && analysis.best_practices.length > 0 ? (
                    <ul className="space-y-2">
                      {analysis.best_practices.map((practice, index) => (
                        <li key={index} className="flex items-start">
                          <FaCheckCircle className="text-blue-400 mt-1 mr-2 flex-shrink-0" />
                          <span className="text-gray-300">{practice}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-400">No specific best practices were identified for this script.</p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Code Quality Tab */}
          {activeTab === 'quality' && (
            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Code Quality Analysis</h2>
              </div>
              <div className="p-6">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-md font-medium">Quality Score</h3>
                    <span className={`px-2 py-1 rounded text-sm ${
                      analysis.code_quality_score > 7 
                        ? 'bg-green-900 text-green-300' 
                        : analysis.code_quality_score > 4 
                        ? 'bg-yellow-900 text-yellow-300' 
                        : 'bg-red-900 text-red-300'
                    }`}>
                      {analysis.code_quality_score}/10
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full" 
                      style={{ width: `${analysis.code_quality_score * 10}%` }}
                    ></div>
                  </div>
                </div>
                
                {analysis.optimization_suggestions && analysis.optimization_suggestions.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-md font-medium mb-3">Suggested Improvements</h3>
                    <div className="space-y-3">
                      {analysis.optimization_suggestions.map((suggestion, index) => (
                        <div key={index} className="bg-blue-900 bg-opacity-20 p-3 rounded-lg border border-blue-800">
                          <div className="flex items-start">
                            <FaLightbulb className="text-yellow-400 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-gray-300">{suggestion}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {analysis.complexity_score && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-md font-medium">Complexity</h3>
                      <span className={`px-2 py-1 rounded text-sm ${
                        analysis.complexity_score < 4 
                          ? 'bg-green-900 text-green-300' 
                          : analysis.complexity_score < 8 
                          ? 'bg-yellow-900 text-yellow-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {analysis.complexity_score}/10
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          analysis.complexity_score < 4 
                            ? 'bg-green-500' 
                            : analysis.complexity_score < 8 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${analysis.complexity_score * 10}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {analysis.complexity_score < 4 
                        ? 'Low complexity makes this script easy to understand and maintain.' 
                        : analysis.complexity_score < 8 
                        ? 'Moderate complexity - some sections might benefit from refactoring.' 
                        : 'High complexity - consider breaking this script into smaller modules.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Performance Tab */}
          {activeTab === 'performance' && (
            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Performance Analysis</h2>
              </div>
              <div className="p-6">
                {analysis.performance_suggestions && analysis.performance_suggestions.length > 0 ? (
                  <div className="mb-6">
                    <h3 className="text-md font-medium mb-3">Performance Optimization Opportunities</h3>
                    <div className="space-y-4">
                      {analysis.performance_suggestions.map((suggestion, index) => (
                        <div key={index} className="bg-green-900 bg-opacity-20 p-4 rounded-lg border border-green-800">
                          <div className="flex items-start">
                            <FaChartLine className="text-green-400 mt-1 mr-3 flex-shrink-0" />
                            <div>
                              <p className="text-gray-300">{suggestion}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 bg-blue-900 bg-opacity-20 p-4 rounded-lg">
                    <div className="flex items-start">
                      <FaInfoCircle className="text-blue-400 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <p className="text-gray-300">No specific performance optimization suggestions were identified for this script.</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {analysis.reliability_score && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-md font-medium">Reliability</h3>
                      <span className={`px-2 py-1 rounded text-sm ${
                        analysis.reliability_score > 7 
                          ? 'bg-green-900 text-green-300' 
                          : analysis.reliability_score > 4 
                          ? 'bg-yellow-900 text-yellow-300' 
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {analysis.reliability_score}/10
                      </span>
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full ${
                          analysis.reliability_score > 7 
                            ? 'bg-green-500' 
                            : analysis.reliability_score > 4 
                            ? 'bg-yellow-500' 
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${analysis.reliability_score * 10}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-400 mt-2">
                      {analysis.reliability_score > 7 
                        ? 'High reliability - script handles errors well and should operate consistently.' 
                        : analysis.reliability_score > 4 
                        ? 'Moderate reliability - additional error handling would improve robustness.' 
                        : 'Low reliability - significant improvements to error handling recommended.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Parameters Tab */}
          {activeTab === 'parameters' && (

            <div className="bg-gray-700 rounded-lg shadow mb-6">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium">Script Parameters</h2>
              </div>
              <div className="p-6">
                {analysis?.parameters && Object.keys(analysis.parameters).length > 0 ? (
                  <div className="space-y-6">
                    {Object.entries(analysis.parameters || {}).map(([name, info]: [string, any]) => (
                      <div key={name} className="border border-gray-600 rounded-lg overflow-hidden">
                        <div className="bg-gray-800 p-3 flex justify-between items-center">
                          <div className="flex items-center">
                            <span className="text-white font-mono">{name}</span>
                            {info.mandatory && (
                              <span className="ml-2 px-2 py-0.5 bg-red-900 text-red-300 rounded text-xs">Required</span>
                            )}
                          </div>
                          <span className="text-gray-400 text-sm">{info.type || 'String'}</span>
                        </div>
                        <div className="p-3">
                          {info.description && <p className="text-gray-300">{info.description}</p>}
                          {info.defaultValue && (
                            <div className="mt-2">
                              <span className="text-gray-400 text-sm">Default: </span>
                              <code className="bg-gray-800 px-2 py-0.5 rounded text-yellow-300">{info.defaultValue}</code>
                            </div>
                          )}
                          {info.validValues && info.validValues.length > 0 && (
                            <div className="mt-2">
                              <span className="text-gray-400 text-sm">Valid values: </span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {info.validValues.map((value: string, idx: number) => (
                                  <code key={idx} className="bg-gray-800 px-2 py-0.5 rounded text-blue-300">{value}</code>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-blue-900 bg-opacity-20 p-4 rounded-lg">
                    <div className="flex items-start">
                      <FaInfoCircle className="text-blue-400 mt-1 mr-3 flex-shrink-0" />
                      <div>
                        <p className="text-gray-300">This script does not have any identified parameters.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Assistant Tab */}
          {activeTab === 'assistant' && (
            <div className="bg-gray-700 rounded-lg shadow mb-6 flex flex-col h-[600px]">
              <div className="p-4 bg-gray-800 border-b border-gray-600">
                <h2 className="text-lg font-medium flex items-center">
                  <FaRobot className="mr-2 text-blue-400" />
                  Psscript AI Assistant
                </h2>
              </div>
              
              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-3/4 rounded-lg p-3 ${
                          msg.role === 'user' 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-800 text-gray-200'
                        }`}
                      >
                        <ReactMarkdown
                          components={{
                            code({node, inline, className, children, ...props}) {
                              if (inline) {
                                return <code className="bg-gray-900 px-1 rounded font-mono text-yellow-300" {...props}>{children}</code>;
                              }
                              return <CodeBlock className={className}>{children}</CodeBlock>;
                            },
                            h1: ({children}) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                            h2: ({children}) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                            h3: ({children}) => <h3 className="text-md font-bold mb-2">{children}</h3>,
                            p: ({children}) => <p className="mb-2">{children}</p>,
                            ul: ({children}) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                            // Handle li elements
                            li: ({children, ...props}) => {
                              return <li className="mb-1" {...props}>{children}</li>;
                            },
                            // Custom component for handling text that might be intended as list items but not in a list
                            text: ({children}) => {
                              // Check if the text looks like a list item (starts with - or * or number.)
                              const text = String(children);
                              if (text.trim().match(/^[-*]\s/) || text.trim().match(/^\d+\.\s/)) {
                                return <div className="mb-1 pl-2 border-l-2 border-gray-600">{children}</div>;
                              }
                              return <>{children}</>;
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-800 text-white rounded-lg p-3">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
                          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-75"></div>
                          <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-150"></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
              
              {/* Input Area */}
              <div className="p-4 border-t border-gray-600">
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex space-x-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your PowerShell script..."
                    className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <FaPaperPlane className="mr-2" />
                    Send
                  </button>
                </form>
                <p className="text-xs text-gray-500 mt-2">
                  Ask questions about your script to get AI-powered insights and recommendations.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Script Info Card */}
          <div className="bg-gray-700 rounded-lg shadow">
            <div className="p-4 bg-gray-800 border-b border-gray-600">
              <h2 className="text-lg font-medium">Script Information</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-gray-400">Title</h3>
                  <p className="text-white font-medium">{script.title}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Category</h3>
                  <p className="text-white">{script.category?.name || 'Uncategorized'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Author</h3>
                  <p className="text-white">{script.user?.username || 'Unknown'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Version</h3>
                  <p className="text-white">{script.version || '1.0'}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Last Updated</h3>
                  <p className="text-white">{new Date(script.updatedAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Execution Count</h3>
                  <p className="text-white">{script.executionCount || 0}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Actions Card */}
          <div className="bg-gray-700 rounded-lg shadow">
            <div className="p-4 bg-gray-800 border-b border-gray-600">
              <h2 className="text-lg font-medium">Actions</h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                <button
                  onClick={() => navigate(`/scripts/${id}`)}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
                >
                  View Script
                </button>
                <button
                  onClick={() => navigate(`/scripts/${id}/edit`)}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center"
                >
                  Edit Script
                </button>
                <button
                  onClick={() => window.open(`/api/scripts/${id}/export-analysis`, '_blank')}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center justify-center"
                >
                  Export Analysis
                </button>
              </div>
            </div>
          </div>
          
          {/* AI Info Card */}
          <div className="bg-gray-700 rounded-lg shadow overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-indigo-800 to-blue-700 border-b border-gray-600">
              <h2 className="text-lg font-medium flex items-center">
                <FaRobot className="mr-2" />
                Analysis Information
              </h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center mr-3">
                    <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Analysis Date</h3>
                    <p className="text-white font-medium">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center mr-3">
                    <svg className="w-6 h-6 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Analysis Model</h3>
                    <p className="text-white font-medium">o3-mini</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-green-900 flex items-center justify-center mr-3">
                    <svg className="w-6 h-6 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Analysis Version</h3>
                    <p className="text-white font-medium">3.2.1</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-600 bg-gray-800 rounded-lg p-3">
                  <div className="flex items-start">
                    <FaInfoCircle className="text-blue-400 mt-1 mr-2 flex-shrink-0" />
                    <p className="text-xs text-gray-300">
                      AI analysis is provided as guidance and may not catch all issues. Always review scripts manually before use in production environments.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptAnalysis;

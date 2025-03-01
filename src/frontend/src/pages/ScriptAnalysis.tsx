import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { scriptService } from '../services/api';
import { FaExclamationTriangle, FaCheckCircle, FaInfoCircle, FaLightbulb, FaChartLine } from 'react-icons/fa';

const ScriptAnalysis: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  const { data: script, isLoading: scriptLoading } = useQuery(
    ['script', id],
    () => scriptService.getScript(id || ''),
    {
      enabled: !!id,
      refetchOnWindowFocus: false,
    }
  );
  
  const { data: analysis, isLoading: analysisLoading } = useQuery(
    ['scriptAnalysis', id],
    () => scriptService.getScriptAnalysis(id || ''),
    {
      enabled: !!id,
      refetchOnWindowFocus: false,
    }
  );
  
  const isLoading = scriptLoading || analysisLoading;
  
  if (isLoading) {
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
        <button
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          onClick={() => navigate(`/scripts/${id}`)}
        >
          Back to Script
        </button>
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
        </nav>
      </div>
      
      {/* Tab Content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="md:col-span-2">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
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
                    <h3 className="text-lg font-medium mb-2">Key Findings</h3>
                    <ul className="space-y-2 text-gray-300">
                      <li className="flex items-start">
                        <FaInfoCircle className="text-blue-400 mt-1 mr-2 flex-shrink-0" />
                        <span>This script {analysis.security_score > 7 ? 'follows good security practices' : 'has some security concerns that should be addressed'}.</span>
                      </li>
                      <li className="flex items-start">
                        <FaInfoCircle className="text-blue-400 mt-1 mr-2 flex-shrink-0" />
                        <span>Code quality is {analysis.code_quality_score > 7 ? 'high' : analysis.code_quality_score > 5 ? 'moderate' : 'needs improvement'} with potential for optimization.</span>
                      </li>
                      {analysis.security_concerns && analysis.security_concerns.length > 0 && (
                        <li className="flex items-start">
                          <FaExclamationTriangle className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                          <span>Found {analysis.security_concerns.length} security {analysis.security_concerns.length === 1 ? 'concern' : 'concerns'} that should be addressed.</span>
                        </li>
                      )}
                      {analysis.performance_suggestions && analysis.performance_suggestions.length > 0 && (
                        <li className="flex items-start">
                          <FaLightbulb className="text-yellow-400 mt-1 mr-2 flex-shrink-0" />
                          <span>Performance could be improved with {analysis.performance_suggestions.length} {analysis.performance_suggestions.length === 1 ? 'suggestion' : 'suggestions'}.</span>
                        </li>
                      )}
                    </ul>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <h3 className="text-lg font-medium mb-3">AI Command Analysis</h3>
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
                  
                  <div className="mt-6 pt-6 border-t border-gray-600">
                    <h3 className="text-lg font-medium mb-3">Key PowerShell Commands Analysis</h3>
                    <div className="space-y-6">
                      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <h4 className="text-blue-400 font-medium mb-2">Get-WmiObject</h4>
                        <div className="space-y-3">
                          <p className="text-gray-300">Core command used for retrieving system information from WMI (Windows Management Instrumentation).</p>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Purpose:</h5>
                            <p className="text-gray-300">Queries WMI to retrieve hardware, operating system, and configuration information.</p>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Classes Used:</h5>
                            <ul className="list-disc pl-5 text-gray-300">
                              <li><code className="bg-gray-900 px-1 rounded">Win32_OperatingSystem</code> - OS information, version, and uptime</li>
                              <li><code className="bg-gray-900 px-1 rounded">Win32_ComputerSystem</code> - Computer manufacturer and model details</li>
                              <li><code className="bg-gray-900 px-1 rounded">Win32_BIOS</code> - BIOS version and serial number</li>
                              <li><code className="bg-gray-900 px-1 rounded">Win32_Processor</code> - CPU information</li>
                              <li><code className="bg-gray-900 px-1 rounded">Win32_PhysicalMemory</code> - RAM details</li>
                              <li><code className="bg-gray-900 px-1 rounded">Win32_NetworkAdapterConfiguration</code> - Network configurations</li>
                            </ul>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Example in Script:</h5>
                            <div className="bg-gray-900 p-2 rounded my-1">
                              <code className="text-yellow-300">$osInfo = Get-WmiObject -Class Win32_OperatingSystem -ComputerName $ComputerName</code>
                            </div>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Alternative in Modern PowerShell:</h5>
                            <div className="bg-gray-900 p-2 rounded my-1">
                              <code className="text-green-300">$osInfo = Get-CimInstance -ClassName Win32_OperatingSystem -ComputerName $ComputerName</code>
                            </div>
                            <p className="text-gray-400 text-xs mt-1">Note: Get-CimInstance is more modern and uses WS-MAN protocol instead of DCOM</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <h4 className="text-blue-400 font-medium mb-2">Measure-Object</h4>
                        <div className="space-y-3">
                          <p className="text-gray-300">Used for calculating the sum of memory capacity across multiple memory modules.</p>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Purpose:</h5>
                            <p className="text-gray-300">Calculates aggregate values like sum, average, minimum, maximum, or count from the input objects.</p>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Example in Script:</h5>
                            <div className="bg-gray-900 p-2 rounded my-1">
                              <code className="text-yellow-300">$memory = Get-WmiObject -Class Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum</code>
                            </div>
                            <p className="text-gray-300 text-sm mt-1">This sums up the capacity of all memory modules to get total installed RAM.</p>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Common Usage Pattern:</h5>
                            <div className="bg-gray-900 p-2 rounded my-1">
                              <code className="text-gray-300"># Count files<br/>
Get-ChildItem -Path C:\Folder -File | Measure-Object<br/><br/>
# Sum file sizes<br/>
Get-ChildItem -Path C:\Folder -File | Measure-Object -Property Length -Sum<br/><br/>
# Find average CPU usage<br/>
Get-Process | Measure-Object -Property CPU -Average</code>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <h4 className="text-blue-400 font-medium mb-2">PSCustomObject Creation</h4>
                        <div className="space-y-3">
                          <p className="text-gray-300">Creates structured output data that can be used in the PowerShell pipeline.</p>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Purpose:</h5>
                            <p className="text-gray-300">Creates a structured object with defined properties to return script output.</p>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Example in Script:</h5>
                            <div className="bg-gray-900 p-2 rounded my-1">
                              <code className="text-yellow-300">$systemInfo = [PSCustomObject]@&#123;<br/>
    ComputerName = $computerSystem.Name<br/>
    Manufacturer = $computerSystem.Manufacturer<br/>
    Model = $computerSystem.Model<br/>
    # Additional properties...<br/>
&#125;</code>
                            </div>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Benefits:</h5>
                            <ul className="list-disc pl-5 text-gray-300">
                              <li>Creates structured, consistent output</li>
                              <li>Facilitates pipeline processing</li>
                              <li>Improves readability compared to hashtables</li>
                              <li>Allows easy property access with dot notation ($result.PropertyName)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                        <h4 className="text-blue-400 font-medium mb-2">Add-Member</h4>
                        <div className="space-y-3">
                          <p className="text-gray-300">Conditionally adds network adapter information to the returned object.</p>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Purpose:</h5>
                            <p className="text-gray-300">Extends an existing object by adding new properties, methods, or other members.</p>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Example in Script:</h5>
                            <div className="bg-gray-900 p-2 rounded my-1">
                              <code className="text-yellow-300">$systemInfo | Add-Member -MemberType NoteProperty -Name NetworkAdapters -Value $networkInfo</code>
                            </div>
                            <p className="text-gray-300 text-sm mt-1">This adds network adapter information to the system info object when the IncludeNetworkInfo parameter is specified.</p>
                          </div>
                          
                          <div>
                            <h5 className="text-sm text-gray-400 font-semibold">Alternative Approaches:</h5>
                            <div className="bg-gray-900 p-2 rounded my-1">
                              <code className="text-gray-300"># Using calculated properties<br/>
$systemInfo = [PSCustomObject]@&#123;<br/>
    # Base properties...<br/>
    NetworkAdapters = if($IncludeNetworkInfo) &#123; $networkInfo &#125; else &#123; $null &#125;<br/>
&#125;<br/><br/>
# Using update of existing object<br/>
if($IncludeNetworkInfo) &#123;<br/>
    $systemInfo.NetworkAdapters = $networkInfo<br/>
&#125;</code>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
          <div className="bg-gray-700 rounded-lg shadow">
            <div className="p-4 bg-gray-800 border-b border-gray-600">
              <h2 className="text-lg font-medium">Analysis Information</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm text-gray-400">Analysis Date</h3>
                  <p className="text-white">{new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Analysis Model</h3>
                  <p className="text-white">GPT-4 Turbo</p>
                </div>
                <div>
                  <h3 className="text-sm text-gray-400">Analysis Version</h3>
                  <p className="text-white">3.2.1</p>
                </div>
                <div className="pt-3 mt-3 border-t border-gray-600">
                  <p className="text-xs text-gray-400">
                    AI analysis is provided as guidance and may not catch all issues. Always review scripts manually before use in production environments.
                  </p>
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
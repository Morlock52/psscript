import React, { useState, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useCommandExplain } from '../contexts/CommandExplainContext';
import { extractFirstCommandLine, isCmdletToken } from '../utils/powershellCommandUtils';
import Layout from '../components/Layout';
import { useChat } from '../hooks/useChat';
import { chatService } from '../services/api-simple';
import CodeDiffView from '../components/CodeDiffView';

// Types for the enhanced features
interface ScriptAction {
  type: 'lint' | 'test' | 'improve' | 'execute';
  script: string;
}

interface DiffViewState {
  visible: boolean;
  original: string;
  improved: string;
  diffData?: {
    lines_added: number;
    lines_removed: number;
    lines_modified: number;
    similarity_ratio: number;
    improvements: Array<{
      category: string;
      description: string;
      line_range: [number, number];
    }>;
  };
}

const ChatWithAI: React.FC = () => {
  const { openCommand } = useCommandExplain();
  // Use the enhanced useChat hook with streaming support
  const {
    messages,
    input,
    isLoading,
    isStreaming,
    setInput,
    sendMessage,
    sendMessageStreaming,
    messagesEndRef
  } = useChat({
    initialMessages: [{
      role: 'assistant',
      content: `# Welcome to PSScriptGPT! 👋

I'm here to help you with PowerShell scripting. Ask me anything about:

- Writing new PowerShell scripts
- Debugging existing scripts
- PowerShell best practices
- Windows administration tasks
- Automation workflows

**Quick Actions:**
Use the toolbar below to quickly lint, improve, test, or execute your scripts!

**What would you like help with today?**`
    }]
  });

  // State for enhanced features
  const [useStreaming, setUseStreaming] = useState(true);
  const [activeScript, setActiveScript] = useState('');
  const [showScriptPanel, setShowScriptPanel] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<DiffViewState>({
    visible: false,
    original: '',
    improved: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract PowerShell code blocks from messages
  const extractScriptsFromMessages = useCallback(() => {
    const scripts: string[] = [];
    const codeBlockRegex = /```(?:powershell|ps1)?\s*([\s\S]*?)```/gi;

    messages.forEach(msg => {
      let match;
      while ((match = codeBlockRegex.exec(msg.content)) !== null) {
        if (match[1].trim()) {
          scripts.push(match[1].trim());
        }
      }
    });

    return scripts;
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Use streaming or regular send based on toggle
    if (useStreaming) {
      await sendMessageStreaming(input);
    } else {
      await sendMessage(input);
    }
  };

  // Handle script actions
  const handleScriptAction = async (action: ScriptAction) => {
    if (!action.script.trim()) {
      setActionResult('No script content to process.');
      return;
    }

    setIsProcessingAction(true);
    setActionResult(null);

    try {
      switch (action.type) {
        case 'lint': {
          const lintResult = await chatService.lintScript(action.script);
          if (lintResult.issues?.length > 0) {
            const issuesSummary = lintResult.issues
              .map((i: { severity: string; ruleName: string; message: string; line: number }) =>
                `[${i.severity}] Line ${i.line}: ${i.ruleName} - ${i.message}`)
              .join('\n');
            setActionResult(`**PSScriptAnalyzer Results:**\n\n\`\`\`\n${issuesSummary}\n\`\`\``);
          } else {
            setActionResult('✅ No issues found! Your script passed all PSScriptAnalyzer checks.');
          }
          break;
        }

        case 'test': {
          const testResult = await chatService.generateTests(action.script);
          if (testResult.tests) {
            setActionResult(`**Generated Pester Tests:**\n\n\`\`\`powershell\n${testResult.tests}\n\`\`\``);
          }
          break;
        }

        case 'improve': {
          const improveResult = await chatService.improveScript(action.script);
          if (improveResult.improved) {
            setDiffView({
              visible: true,
              original: action.script,
              improved: improveResult.improved,
              diffData: improveResult.diff
            });
          }
          break;
        }

        case 'execute': {
          const execResult = await chatService.executeScript(action.script);
          const status = execResult.status === 'success' ? '✅' : '❌';
          let output = `**Execution Result:** ${status}\n\n`;
          if (execResult.stdout) {
            output += `**Output:**\n\`\`\`\n${execResult.stdout}\n\`\`\`\n`;
          }
          if (execResult.stderr) {
            output += `**Errors:**\n\`\`\`\n${execResult.stderr}\n\`\`\`\n`;
          }
          if (execResult.blocked_commands?.length > 0) {
            output += `\n**Blocked Commands:** ${execResult.blocked_commands.join(', ')}`;
          }
          setActionResult(output);
          break;
        }
      }
    } catch (error) {
      setActionResult(`Error: ${error instanceof Error ? error.message : 'Action failed'}`);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setActiveScript(content);
        setShowScriptPanel(true);
      };
      reader.readAsText(file);
    }
  };

  // Handle accepting improvements from diff view
  const handleAcceptImprovement = (improved: string) => {
    setActiveScript(improved);
    setDiffView({ visible: false, original: '', improved: '' });
    setActionResult('✅ Improvements accepted! The improved script is now active.');
  };

  // Get the most recent script from chat or active script
  const getCurrentScript = useCallback(() => {
    if (activeScript) return activeScript;
    const scripts = extractScriptsFromMessages();
    return scripts.length > 0 ? scripts[scripts.length - 1] : '';
  }, [activeScript, extractScriptsFromMessages]);

  // Custom renderer for code blocks in markdown
  const CodeBlock = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    const language = className ? className.replace('language-', '') : 'powershell';
    const code = String(children).replace(/\n$/, '');

    return (
      <div className="my-4 rounded-md overflow-hidden relative group">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{ padding: '1em', borderRadius: '0.375rem' }}
        >
          {code}
        </SyntaxHighlighter>
        {/* Quick action buttons for code blocks */}
        {(language === 'powershell' || language === 'ps1') && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
            <button
              onClick={() => setActiveScript(code)}
              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
              title="Use this script"
            >
              Use
            </button>
            <button
              onClick={() => handleScriptAction({ type: 'improve', script: code })}
              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
              title="Improve this script"
            >
              Improve
            </button>
            <button
              type="button"
              onClick={() => openCommand(extractFirstCommandLine(code) || code, 'chat')}
              className="px-2 py-1 bg-emerald-600 text-white text-xs rounded hover:bg-emerald-700"
              title="Explain this command"
            >
              Explain
            </button>
          </div>
        )}
      </div>
    );
  };

  const isProcessing = isLoading || isStreaming;
  const currentScript = getCurrentScript();

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        <header className="bg-gray-800 p-4 shadow-md">
          <div className="container mx-auto flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Chat with PSScriptGPT</h1>
              <p className="text-gray-400">Your PowerShell scripting assistant powered by AI</p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Script panel toggle */}
              <button
                onClick={() => setShowScriptPanel(!showScriptPanel)}
                className={`px-3 py-1 rounded text-sm ${
                  showScriptPanel ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {showScriptPanel ? 'Hide Script' : 'Script Panel'}
              </button>

              {/* Upload button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 bg-gray-700 text-gray-300 rounded text-sm hover:bg-gray-600"
              >
                📂 Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ps1,.psm1,.psd1"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Streaming toggle */}
              <label className="flex items-center cursor-pointer">
                <span className="text-sm text-gray-400 mr-2">
                  {useStreaming ? '⚡ Streaming' : '📦 Batch'}
                </span>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={useStreaming}
                    onChange={(e) => setUseStreaming(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`block w-10 h-6 rounded-full transition ${useStreaming ? 'bg-green-500' : 'bg-gray-600'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${useStreaming ? 'translate-x-4' : ''}`}></div>
                </div>
              </label>
            </div>
          </div>
        </header>

        {/* Quick Actions Toolbar */}
        {currentScript && (
          <div className="bg-gray-700 px-4 py-2 border-b border-gray-600">
            <div className="container mx-auto max-w-4xl flex items-center justify-between">
              <span className="text-sm text-gray-400">
                Active script: {currentScript.split('\n')[0].substring(0, 50)}...
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleScriptAction({ type: 'lint', script: currentScript })}
                  disabled={isProcessingAction}
                  className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                  title="Run PSScriptAnalyzer"
                >
                  🔍 Lint
                </button>
                <button
                  onClick={() => handleScriptAction({ type: 'test', script: currentScript })}
                  disabled={isProcessingAction}
                  className="px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
                  title="Generate Pester tests"
                >
                  🧪 Tests
                </button>
                <button
                  onClick={() => handleScriptAction({ type: 'improve', script: currentScript })}
                  disabled={isProcessingAction}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                  title="Get AI improvements"
                >
                  ✨ Improve
                </button>
                <button
                  onClick={() => handleScriptAction({ type: 'execute', script: currentScript })}
                  disabled={isProcessingAction}
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                  title="Execute in sandbox"
                >
                  ▶️ Run
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden flex">
          {/* Script Panel */}
          {showScriptPanel && (
            <div className="w-1/3 bg-gray-850 border-r border-gray-700 flex flex-col">
              <div className="p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                <span className="text-sm font-semibold text-gray-300">Script Editor</span>
                <button
                  onClick={() => setActiveScript('')}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Clear
                </button>
              </div>
              <textarea
                value={activeScript}
                onChange={(e) => setActiveScript(e.target.value)}
                className="flex-1 p-3 bg-gray-900 text-green-400 font-mono text-sm resize-none border-none focus:outline-none"
                placeholder="Paste or type your PowerShell script here..."
                spellCheck={false}
              />
            </div>
          )}

          {/* Chat Area */}
          <div className={`flex-1 overflow-y-auto p-6 bg-gray-900 ${showScriptPanel ? '' : ''}`}>
            <div className="container mx-auto max-w-4xl">
              {/* Diff View Modal */}
              {diffView.visible && (
                <div className="mb-6">
                  <CodeDiffView
                    original={diffView.original}
                    improved={diffView.improved}
                    diffData={diffView.diffData as any}
                    onAccept={handleAcceptImprovement}
                    onReject={() => setDiffView({ visible: false, original: '', improved: '' })}
                    showActions={true}
                  />
                </div>
              )}

              {/* Action Result */}
              {actionResult && (
                <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-semibold text-blue-400">Action Result</span>
                    <button
                      onClick={() => setActionResult(null)}
                      className="text-gray-500 hover:text-gray-300"
                    >
                      ✕
                    </button>
                  </div>
                  <ReactMarkdown
                    components={{
                      code({ className, children }) {
                        const language = className ? className.replace('language-', '') : 'text';
                        return (
                          <SyntaxHighlighter
                            language={language}
                            style={vscDarkPlus}
                            customStyle={{ padding: '0.5em', borderRadius: '0.25rem', fontSize: '0.85em' }}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        );
                      },
                      p: ({ children }) => <p className="mb-2 text-gray-300">{children}</p>,
                    }}
                  >
                    {actionResult}
                  </ReactMarkdown>
                </div>
              )}

              {/* Processing Indicator */}
              {isProcessingAction && (
                <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-blue-500 flex items-center">
                  <div className="animate-spin mr-3 h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="text-blue-400">Processing your request...</span>
                </div>
              )}

              {/* Chat Messages */}
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`mb-6 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                >
                  <div
                    className={`inline-block max-w-3xl text-left p-4 rounded-lg shadow-sm
                      ${msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-100'
                      }`}
                  >
                    <ReactMarkdown
                      components={{
                        code({ className, children, ...props }) {
                          const isInline = !className && typeof children === 'string' && !children.includes('\n');
                          if (isInline) {
                            const text = String(children || '').trim();
                            if (isCmdletToken(text)) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => openCommand(text, 'chat')}
                                  className="bg-gray-700 px-1 rounded font-mono text-yellow-300 cursor-pointer hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                                  title="Explain command"
                                >
                                  {text}
                                </button>
                              );
                            }
                            return <code className="bg-gray-700 px-1 rounded font-mono text-yellow-300" {...props}>{children}</code>;
                          }
                          return <CodeBlock className={className}>{children}</CodeBlock>;
                        },
                        h1: ({ children }) => <h1 className="text-2xl font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-bold mb-2">{children}</h3>,
                        p: ({ children }) => <p className="mb-4">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-5 mb-4">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-4">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        a: ({ href, children }) => (
                          <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {msg.content || (isStreaming && index === messages.length - 1 ? '▌' : '')}
                    </ReactMarkdown>
                    {/* Show streaming cursor for the current streaming message */}
                    {isStreaming && index === messages.length - 1 && msg.content && (
                      <span className="animate-pulse text-green-400">▌</span>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && !isStreaming && (
                <div className="mb-6 text-left">
                  <div className="inline-block max-w-3xl p-4 rounded-lg shadow-sm bg-gray-800">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-3 h-3 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-700 p-4 bg-gray-800">
          <div className="container mx-auto max-w-4xl">
            <form onSubmit={handleSubmit} className="flex space-x-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me about PowerShell scripting..."
                className="flex-1 p-3 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-white"
                disabled={isProcessing}
              />
              <button
                type="submit"
                disabled={isProcessing || !input.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {isStreaming ? 'Streaming...' : isLoading ? 'Sending...' : 'Send'}
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2 text-center">
              {useStreaming ? '⚡ Streaming mode enabled - responses appear in real-time' : '📦 Batch mode - complete response after processing'}
              {currentScript && ' | 📜 Script loaded - use toolbar actions above'}
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ChatWithAI;

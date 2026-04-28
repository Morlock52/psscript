import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  IconButton,
  Chip,
  Avatar,
  Grid,
  Card,
  LinearProgress,
  Alert,
  Snackbar,
  useTheme
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import ReplayIcon from '@mui/icons-material/Replay';
import InfoIcon from '@mui/icons-material/Info';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAuth } from '../../hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import { chatService } from '../../services/api-simple';

import type { Agent } from '../../api/agentOrchestrator';

interface AgentChatProps {
  agentConfig?: Partial<Agent>;
  initialMessage?: string;
  placeholder?: string;
  showToolbar?: boolean;
}

interface HostedAgentMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
}

function buildAgentSystemPrompt(agentConfig: Partial<Agent>): string {
  return [
    `You are ${agentConfig.name || 'PSScript AI Assistant'}.`,
    agentConfig.description || 'You help users write, analyze, secure, and debug PowerShell scripts.',
    agentConfig.capabilities?.length
      ? `Your capabilities are: ${agentConfig.capabilities.join(', ')}.`
      : '',
    'Answer with practical PowerShell guidance, include safe examples, and warn before destructive actions.',
  ].filter(Boolean).join(' ');
}

const AgentChat: React.FC<AgentChatProps> = ({
  agentConfig = {
    name: 'PSScript AI Assistant',
    description: 'Specialized PowerShell expert with script generation and analysis capabilities',
    capabilities: [
      'script_analysis',
      'script_generation',
      'code_review',
      'security_analysis',
      'debugging',
      'automation'
    ],
    model: 'gpt-4.1'
  },
  initialMessage = `Hello! I'm your **PSScript AI Assistant** - specialized in PowerShell and scripting.

I can help you with:
- 📝 **Writing new scripts** - "Create a script that backs up files to Azure"
- 🔍 **Analyzing scripts** - "Explain what this script does"
- 🔒 **Security reviews** - "Check this script for vulnerabilities"
- 🐛 **Debugging** - "Why isn't my Get-ChildItem working?"
- ⚡ **Optimization** - "How can I make this script faster?"

What PowerShell challenge can I help you with today?`,
  placeholder = 'Ask about PowerShell scripting, request a new script, or get help debugging...',
  showToolbar = true
}) => {
  const theme = useTheme();
  const { isAuthenticated } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadIdRef = useRef(`hosted-agent-${Date.now()}`);
  const agentName = agentConfig.name || 'PowerShell Assistant';
  const agentModel = agentConfig.model || 'Hosted AI';
  
  // State for the conversation
  const [messages, setMessages] = useState<HostedAgentMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'info' as 'info' | 'success' | 'warning' | 'error'
  });
  
  // Initialize a hosted chat session locally. Production chat goes through /api/chat.
  useEffect(() => {
    if (isAuthenticated) {
      setError(null);
      setMessages([{
        id: 'welcome-msg',
        threadId: threadIdRef.current,
        role: 'assistant',
        content: initialMessage,
        metadata: {},
        createdAt: new Date()
      }]);
    }
  }, [isAuthenticated, initialMessage]);
  
  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Handle sending a message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isAuthenticated || isProcessing) return;
    
    const userMessage = inputMessage;
    const threadId = threadIdRef.current;
    setInputMessage('');
    setIsProcessing(true);
    setError(null);
    
    const tempUserMessage: HostedAgentMessage = {
      id: `user-${Date.now()}`,
      threadId,
      role: 'user',
      content: userMessage,
      metadata: {},
      createdAt: new Date()
    };
    const loadingMessage: HostedAgentMessage = {
      id: `loading-${Date.now()}`,
      threadId,
      role: 'assistant',
      content: '...',
      metadata: { isLoading: true },
      createdAt: new Date()
    };
    const nextMessages = [...messages.filter(message => !message.metadata?.isLoading), tempUserMessage];

    setMessages([...nextMessages, loadingMessage]);

    try {
      const response = await chatService.sendMessage([
        { role: 'system', content: buildAgentSystemPrompt(agentConfig) },
        ...nextMessages
          .filter(message => message.role === 'user' || message.role === 'assistant')
          .map(message => ({
            role: message.role,
            content: String(message.content || '')
          }))
      ], 'agent', threadId);

      const assistantMessage: HostedAgentMessage = {
        id: `assistant-${Date.now()}`,
        threadId,
        role: 'assistant',
        content: response.response || 'I could not generate a response.',
        metadata: {},
        createdAt: new Date()
      };

      setMessages([...nextMessages, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      setNotification({
        open: true,
        message: 'Failed to send message',
        severity: 'error'
      });
      
      setMessages([
        ...nextMessages,
        {
          id: `error-${Date.now()}`,
          threadId,
          role: 'assistant',
          content: 'I could not reach the hosted AI service. Please try again.',
          metadata: {},
          createdAt: new Date()
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle pressing Enter to send a message
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };
  
  // Handle closing the notification
  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };
  
  // Render a message based on its role
  const renderMessage = (message: HostedAgentMessage) => {
    const isUser = message.role === 'user';
    const isLoading = message.metadata?.isLoading;
    
    return (
      <Box 
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          mb: 2
        }}
      >
        <Box 
          sx={{
            display: 'flex',
            flexDirection: isUser ? 'row-reverse' : 'row',
            alignItems: 'flex-start',
            gap: 1
          }}
        >
          <Avatar
            sx={{
              bgcolor: isUser ? theme.palette.primary.main : theme.palette.secondary.main,
              color: '#fff'
            }}
          >
            {isUser ? <PersonIcon /> : <SmartToyIcon />}
          </Avatar>
          
          <Paper
            elevation={1}
            sx={{
              p: 2,
              maxWidth: '80%',
              borderRadius: 2,
              bgcolor: isUser ? theme.palette.primary.light : theme.palette.background.paper,
              color: isUser ? '#fff' : 'inherit'
            }}
          >
            {isLoading ? (
              <Box sx={{ width: '100%', minWidth: '200px' }}>
                <LinearProgress />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Thinking...
                </Typography>
              </Box>
            ) : (
              <Box>
                <ReactMarkdown
                  components={{
                    code({inline, className, children, ...props}) {
                      const match = /language-(\w+)/.exec(className || '');
                      return !inline && match ? (
                        <SyntaxHighlighter
                          style={atomDark}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {String(children).replace(/\n$/, '')}
                        </SyntaxHighlighter>
                      ) : (
                        <code className={className} {...props}>
                          {children}
                        </code>
                      );
                    }
                  }}
                >
                  {message.content || ''}
                </ReactMarkdown>
              </Box>
            )}
          </Paper>
        </Box>
        
        <Typography 
          variant="caption" 
          color="text.secondary"
          sx={{ 
            mt: 0.5, 
            mx: 2,
            alignSelf: isUser ? 'flex-end' : 'flex-start'
          }}
        >
          {new Date(message.createdAt).toLocaleTimeString()}
        </Typography>
      </Box>
    );
  };
  
  return (
    <Card elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ bgcolor: theme.palette.secondary.main }}>
            <SmartToyIcon />
          </Avatar>
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              {agentName}
            </Typography>
            <Chip
              size="small"
              label={agentModel}
              sx={{ fontSize: '0.7rem' }}
            />
          </Box>
        </Box>
        
        {showToolbar && (
          <Box>
            <IconButton size="small" title="Restart conversation">
              <ReplayIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" title="About this assistant">
              <InfoIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
      
      {/* Messages area */}
      <Box
        sx={{
          flexGrow: 1,
          p: 2,
          overflow: 'auto',
          bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50'
        }}
      >
        {messages.map(message => (
          <React.Fragment key={message.id}>
            {renderMessage(message)}
          </React.Fragment>
        ))}
        <div ref={messagesEndRef} />
      </Box>
      
      {/* Input area */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Grid container spacing={1} alignItems="flex-end">
          <Grid item xs>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder={placeholder}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isProcessing || !isAuthenticated}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2
                }
              }}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              endIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isProcessing || !isAuthenticated}
              sx={{ borderRadius: 2, px: 3, py: 1 }}
            >
              {isProcessing ? 'Sending...' : 'Send'}
            </Button>
          </Grid>
        </Grid>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>
      
      {/* Notification */}
      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={handleCloseNotification}
          severity={notification.severity}
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default AgentChat;

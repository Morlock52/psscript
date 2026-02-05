/**
 * AnalysisProgressPanel Component
 *
 * Displays real-time progress of LangGraph multi-agent analysis.
 * Shows current stage, tool executions, and analysis updates.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert,
  CircularProgress,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassIcon,
  Psychology as PsychologyIcon,
  Security as SecurityIcon,
  Code as CodeIcon,
  TipsAndUpdates as TipsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { AnalysisEvent } from '../../services/langgraphService';

interface AnalysisProgressPanelProps {
  workflowId?: string;
  currentStage: string;
  status: 'idle' | 'analyzing' | 'completed' | 'failed' | 'paused';
  events: AnalysisEvent[];
  onCancel?: () => void;
}

interface ToolProgress {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: string;
  message?: string;
}

const STAGE_LABELS: Record<string, string> = {
  analyze: 'Analyzing Script',
  tools: 'Running Analysis Tools',
  synthesis: 'Synthesizing Results',
  human_review: 'Awaiting Human Review',
  completed: 'Analysis Complete',
  failed: 'Analysis Failed',
};

const _TOOL_ICONS: Record<string, React.ReactNode> = {
  analyze_powershell_script: <PsychologyIcon fontSize="small" />,
  security_scan: <SecurityIcon fontSize="small" />,
  quality_analysis: <CodeIcon fontSize="small" />,
  generate_optimizations: <TipsIcon fontSize="small" />,
};

export const AnalysisProgressPanel: React.FC<AnalysisProgressPanelProps> = ({
  workflowId,
  currentStage,
  status,
  events,
  onCancel: _onCancel,
}) => {
  const [tools, setTools] = useState<ToolProgress[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [progress, setProgress] = useState(0);

  // Process events to extract tool progress
  useEffect(() => {
    const toolMap = new Map<string, ToolProgress>();

    events.forEach((event) => {
      if (event.type === 'tool_started' && event.data?.tool_name) {
        toolMap.set(event.data.tool_name, {
          name: event.data.tool_name,
          status: 'running',
          timestamp: event.timestamp || new Date().toISOString(),
          message: event.message,
        });
      } else if (event.type === 'tool_completed' && event.data?.tool_name) {
        const existing = toolMap.get(event.data.tool_name);
        if (existing) {
          toolMap.set(event.data.tool_name, {
            ...existing,
            status: 'completed',
            message: event.message || 'Completed',
          });
        }
      }
    });

    setTools(Array.from(toolMap.values()));

    // Update progress based on completed tools and stage
    const totalSteps = 5; // Roughly: analyze, 3 tools, synthesis
    let completedSteps = 0;

    if (currentStage === 'tools' || currentStage === 'synthesis' || currentStage === 'completed') {
      completedSteps += 1; // Initial analyze
    }

    const completedTools = Array.from(toolMap.values()).filter((t) => t.status === 'completed').length;
    completedSteps += completedTools;

    if (currentStage === 'synthesis' || currentStage === 'completed') {
      completedSteps += (3 - completedTools); // Assume remaining tools done
    }

    if (currentStage === 'completed') {
      completedSteps = totalSteps;
    }

    setProgress(Math.min((completedSteps / totalSteps) * 100, 100));
  }, [events, currentStage]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
      case 'analyzing':
        return 'primary';
      case 'paused':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getToolIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleIcon color="success" fontSize="small" />;
      case 'failed':
        return <ErrorIcon color="error" fontSize="small" />;
      case 'running':
        return <CircularProgress size={20} />;
      default:
        return <HourglassIcon color="disabled" fontSize="small" />;
    }
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        {/* Header */}
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="h6">AI Agent Analysis</Typography>
            <Chip
              label={STAGE_LABELS[currentStage] || currentStage}
              color={getStatusColor(status)}
              size="small"
            />
          </Box>
          <IconButton onClick={() => setExpanded(!expanded)} size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          {/* Progress Bar */}
          {status === 'analyzing' && (
            <Box
              mb={2}
              sx={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 0.75,
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(progress)}% Complete
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {STAGE_LABELS[currentStage] || currentStage}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  width: '100%',
                  maxWidth: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: 'var(--color-bg-tertiary)',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 999,
                    backgroundColor: 'var(--color-primary)',
                  },
                }}
              />
            </Box>
          )}

          {/* Workflow ID */}
          {workflowId && (
            <Typography variant="caption" color="text.secondary" display="block" mb={1}>
              Workflow ID: {workflowId}
            </Typography>
          )}

          {/* Tool Executions */}
          {tools.length > 0 && (
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>
                Tool Executions:
              </Typography>
              <List dense>
                {tools.map((tool, index) => (
                  <ListItem key={`${tool.name}-${index}`} sx={{ pl: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getToolIcon(tool.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={tool.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      secondary={tool.message}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Status Messages */}
          {status === 'paused' && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Analysis paused for human review. Please provide feedback to continue.
            </Alert>
          )}

          {status === 'failed' && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Analysis failed. Please check the error details and try again.
            </Alert>
          )}

          {status === 'completed' && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Analysis completed successfully!
            </Alert>
          )}

          {/* Recent Events */}
          {events.length > 0 && events.slice(-3).some((e) => e.type === 'reasoning') && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Recent AI Reasoning:
              </Typography>
              {events
                .slice(-3)
                .reverse()
                .filter((e) => e.type === 'reasoning')
                .map((event, index) => (
                  <Typography key={index} variant="body2" color="text.secondary" paragraph>
                    • {event.message}
                  </Typography>
                ))}
            </Box>
          )}
        </Collapse>
      </CardContent>
    </Card>
  );
};

export default AnalysisProgressPanel;

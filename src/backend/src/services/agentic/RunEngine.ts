import { assistantsStore } from './AssistantsStore';
import { Run, ToolCall, SubmittedToolCallOutput } from '../../models/Agentic/Run';
import { AssistantTool } from '../../models/Agentic/Assistant';
import { getMessageText } from '../../models/Agentic/Message';
import { openai } from '../openaiClient';
import { searchPowerShellDocs } from './tools/PowerShellDocsSearch';
import { analyzeScriptSecurity } from './tools/SecurityAnalyzer';
import { generatePowerShellScript } from './tools/ScriptGenerator';

/**
 * Map of active runs being processed
 */
const activeRuns = new Map<string, boolean>();

/**
 * Handle a run
 */
export async function handleAssistantRun(
  runId: string,
  toolOutputs?: SubmittedToolCallOutput[]
): Promise<void> {
  // Prevent duplicate processing
  if (activeRuns.get(runId)) {
    return;
  }
  
  activeRuns.set(runId, true);
  
  try {
    // Get the run
    let run = await assistantsStore.retrieveRun(runId);
    if (!run || ['completed', 'failed', 'cancelled', 'expired'].includes(run.status)) {
      activeRuns.delete(runId);
      return;
    }
    
    // Update to in_progress
    run = await assistantsStore.updateRunStatus(runId, 'in_progress') as Run;
    
    // Get the assistant and thread
    const assistant = await assistantsStore.retrieveAssistant(run.assistant_id);
    const thread = await assistantsStore.retrieveThread(run.thread_id);
    
    if (!assistant || !thread) {
      await assistantsStore.updateRunStatus(runId, 'failed', {
        last_error: {
          code: 'resource_not_found',
          message: 'Assistant or thread not found',
        },
      });
      activeRuns.delete(runId);
      return;
    }
    
    // Get the thread messages
    const messages = await assistantsStore.listMessages(thread.id);
    
    // Format as conversation history for OpenAI API
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: getMessageText(msg),
    }));
    
    // Add system message with instructions if provided
    if (run.instructions || assistant.instructions) {
      conversationHistory.unshift({
        role: 'system',
        content: run.instructions || assistant.instructions || '',
      });
    }
    
    // Function for handling tool calls
    const handleToolCalls = async (toolCalls: any[]): Promise<any> => {
      const toolOutputs = [];
      const requiresAction = false;
      
      for (const toolCall of toolCalls) {
        if (toolCall.type === 'function') {
          const { name, arguments: args } = toolCall.function;
          let output: string;
          
          try {
            // Parse arguments
            const parsedArgs = JSON.parse(args);
            
            // Execute the appropriate tool
            switch (name) {
              case 'searchPowerShellDocs':
                output = await searchPowerShellDocs(parsedArgs.query);
                break;
              case 'analyzeScriptSecurity':
                output = await analyzeScriptSecurity(parsedArgs.script);
                break;
              case 'generatePowerShellScript':
                output = await generatePowerShellScript(parsedArgs.requirements);
                break;
              default:
                output = JSON.stringify({ error: `Unknown function: ${name}` });
                break;
            }
          } catch (error) {
            console.error(`Error executing function ${name}:`, error);
            output = JSON.stringify({ error: `Error executing function: ${error}` });
          }
          
          toolOutputs.push({
            tool_call_id: toolCall.id,
            output,
          });
        }
      }
      
      if (requiresAction) {
        // Update run to require action
        await assistantsStore.updateRunStatus(runId, 'requires_action', {
          required_action: {
            type: 'submit_tool_outputs',
            submit_tool_outputs: {
              tool_calls: toolCalls,
            },
          },
        });
        return null;
      }
      
      return toolOutputs;
    };

    const continueWithToolOutputs = async (
      currentHistory: Array<{ role: string; content: string }>,
      toolCalls: ToolCall[],
      outputs: SubmittedToolCallOutput[]
    ) => {
      const followupMessages = [
        ...currentHistory,
        {
          role: 'assistant',
          content: null,
          tool_calls: toolCalls,
        },
        ...outputs.map(output => ({
          role: 'tool',
          tool_call_id: output.tool_call_id,
          content: output.output,
        })),
      ];

      return openai.chat.completions.create({
        model: run.model,
        messages: followupMessages as any,
      });
    };
    
    // Function to prepare tools for OpenAI API
    const prepareTools = (tools: AssistantTool[]): any[] => {
      return tools.map(tool => {
        if (tool.type === 'function' && tool.function) {
          return {
            type: 'function',
            function: {
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters,
            },
          };
        }
        return { type: tool.type };
      });
    };
    
    try {
      if (toolOutputs && toolOutputs.length > 0 && run.required_action?.type === 'submit_tool_outputs') {
        const resumedCompletion = await continueWithToolOutputs(
          conversationHistory,
          run.required_action.submit_tool_outputs.tool_calls,
          toolOutputs
        );
        const resumedMessage = resumedCompletion.choices[0]?.message;

        if (!resumedMessage?.content) {
          throw new Error('No response from OpenAI API after submitting tool outputs');
        }

        const message = await assistantsStore.createMessage({
          thread_id: thread.id,
          role: 'assistant',
          content: resumedMessage.content,
          run_id: runId,
          assistant_id: assistant.id,
        });

        if (message) {
          await assistantsStore.createRunStep({
            run_id: runId,
            thread_id: thread.id,
            assistant_id: assistant.id,
            type: 'message_creation',
            message_id: message.id,
          });
        }

        await assistantsStore.updateRunStatus(runId, 'completed');
        return;
      }

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: run.model,
        messages: conversationHistory,
        tools: run.tools.length > 0 ? prepareTools(run.tools) : undefined,
        tool_choice: run.tools.length > 0 ? 'auto' : undefined,
      });

      const assistantMessage = completion.choices[0]?.message;
      
      if (!assistantMessage) {
        throw new Error('No response from OpenAI API');
      }
      
      // Check if tool calls are present
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Create a run step for tool calls
        await assistantsStore.createRunStep({
          run_id: runId,
          thread_id: thread.id,
          assistant_id: assistant.id,
          type: 'tool_calls',
          tool_calls: assistantMessage.tool_calls,
        });
        
        // Check if we can automatically handle the tool calls
        const canAutoProcess = assistantMessage.tool_calls.every(
          call => call.type === 'function' && 
          ['searchPowerShellDocs', 'analyzeScriptSecurity', 'generatePowerShellScript'].includes(call.function.name)
        );
        
        if (canAutoProcess) {
          // Process tool calls automatically
          const outputs = await handleToolCalls(assistantMessage.tool_calls);
          
          // Continue the conversation with the outputs
          if (outputs && outputs.length > 0) {
            const updatedCompletion = await continueWithToolOutputs(
              conversationHistory,
              assistantMessage.tool_calls as ToolCall[],
              outputs
            );

            const finalMessage = updatedCompletion.choices[0]?.message;
            
            if (finalMessage && finalMessage.content) {
              // Create message from assistant
              const message = await assistantsStore.createMessage({
                thread_id: thread.id,
                role: 'assistant',
                content: finalMessage.content,
                run_id: runId,
                assistant_id: assistant.id,
              });
              
              // Create run step for message creation
              if (message) {
                await assistantsStore.createRunStep({
                  run_id: runId,
                  thread_id: thread.id,
                  assistant_id: assistant.id,
                  type: 'message_creation',
                  message_id: message.id,
                });
              }
              
              // Mark run as completed
              await assistantsStore.updateRunStatus(runId, 'completed');
            }
          }
        } else {
          // Update run to require action
          await assistantsStore.updateRunStatus(runId, 'requires_action', {
            required_action: {
              type: 'submit_tool_outputs',
              submit_tool_outputs: {
                tool_calls: assistantMessage.tool_calls as any,
              },
            },
          });
        }
      } else if (assistantMessage.content) {
        // Create message from assistant
        const message = await assistantsStore.createMessage({
          thread_id: thread.id,
          role: 'assistant',
          content: assistantMessage.content,
          run_id: runId,
          assistant_id: assistant.id,
        });
        
        // Create run step for message creation
        if (message) {
          await assistantsStore.createRunStep({
            run_id: runId,
            thread_id: thread.id,
            assistant_id: assistant.id,
            type: 'message_creation',
            message_id: message.id,
          });
        }
        
        // Mark run as completed
        await assistantsStore.updateRunStatus(runId, 'completed');
      }
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      await assistantsStore.updateRunStatus(runId, 'failed', {
        last_error: {
          code: 'api_error',
          message: `Error calling OpenAI API: ${error}`,
        },
      });
    }
  } catch (error) {
    console.error('Error handling run:', error);
    await assistantsStore.updateRunStatus(runId, 'failed', {
      last_error: {
        code: 'internal_error',
        message: `Internal error: ${error}`,
      },
    });
  } finally {
    activeRuns.delete(runId);
  }
}

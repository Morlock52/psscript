/**
 * Script Execution Controller
 *
 * Handles script execution command generation and execution history.
 * Migrated from the original ScriptController for better modularity.
 */
import {
  Request,
  Response,
  NextFunction,
  Script,
  ExecutionLog,
  User,
  logger
} from './shared';

import type { AuthenticatedRequest } from './types';

/**
 * Generate PowerShell command for script execution
 * Note: This does not execute the script directly - it generates the command
 * for the user to run in their PowerShell environment.
 */
export async function executeScript(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = req.params.id;
    const { params } = req.body as { params?: Record<string, unknown> };
    const userId = req.user?.id;

    const script = await Script.findByPk(scriptId);

    if (!script) {
      return res.status(404).json({ message: 'Script not found' });
    }

    // Generate proper PowerShell command with parameters
    const scriptPath = `./${script.title.replace(/[^a-zA-Z0-9-_]/g, '_')}.ps1`;
    let powershellCommand = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`;

    // Add parameters to command if provided
    if (params && Object.keys(params).length > 0) {
      const paramStrings = Object.entries(params).map(([key, value]) => {
        // Properly escape parameter values for PowerShell (backtick is escape char)
        // eslint-disable-next-line no-useless-escape
        const escapedValue = String(value).replace(/"/g, '\`"').replace(/\$/g, '\`$');
        return `-${key} "${escapedValue}"`;
      });
      powershellCommand += ' ' + paramStrings.join(' ');
    }

    // Increment execution count
    await script.update({
      executionCount: script.executionCount + 1
    });

    // Record execution in logs with "command_generated" status
    // TODO: ExecutionLog model doesn't have 'output' field yet - see models/ExecutionLog.ts TODO
    const executionLog = await ExecutionLog.create({
      scriptId: parseInt(scriptId, 10),
      userId,
      parameters: params || {},
      status: 'success',
      // output field would go here once DB migration is created
      executionTime: 0 // Command generation is instant
    });

    return res.json({
      success: true,
      command: powershellCommand,
      scriptPath: scriptPath,
      parameters: params || {},
      executionCount: script.executionCount,
      timestamp: new Date(),
      message: 'PowerShell command generated successfully. Copy and run this command in PowerShell.',
      executionLogId: executionLog.id
    });
  } catch (error) {
    logger.error('Error generating execution command:', error);
    next(error);
  }
}

/**
 * Get execution history for a script
 */
export async function getExecutionHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = req.params.id;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const script = await Script.findByPk(scriptId);
    if (!script) {
      return res.status(404).json({ message: 'Script not found' });
    }

    // Get execution logs with user information
    const executionLogs = await ExecutionLog.findAll({
      where: { scriptId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    // Get total count for pagination
    const totalCount = await ExecutionLog.count({ where: { scriptId } });

    // Define the shape of the execution log with user
    type ExecutionLogWithUser = ExecutionLog & {
      user?: { id: number; username: string; email: string } | null;
    };

    return res.json({
      executions: executionLogs.map((log: ExecutionLogWithUser) => ({
        id: log.id,
        parameters: log.parameters,
        status: log.status,
        // TODO: output field not in model yet - see models/ExecutionLog.ts
        errorMessage: log.errorMessage,
        executionTime: log.executionTime,
        user: log.user ? {
          id: log.user.id,
          username: log.user.username
        } : null,
        createdAt: log.createdAt
      })),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });
  } catch (error) {
    logger.error('Error fetching execution history:', error);
    next(error);
  }
}

// Export as a controller object for compatibility
export const ScriptExecutionController = {
  executeScript,
  getExecutionHistory
};

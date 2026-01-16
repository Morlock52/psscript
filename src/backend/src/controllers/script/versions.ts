/**
 * Script Version Control Controller
 *
 * Handles version history, retrieval, comparison, and reversion operations.
 * Migrated from the original ScriptController for better modularity.
 */
import {
  Request,
  Response,
  NextFunction,
  Script,
  ScriptVersion,
  User,
  sequelize,
  Transaction,
  logger,
  calculateBufferMD5
} from './shared';

import type { AuthenticatedRequest } from './types';

/**
 * Get version history for a script
 * GET /scripts/:id/versions
 */
export async function getVersionHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = parseInt(req.params.id);

    if (isNaN(scriptId)) {
      return res.status(400).json({ error: 'Invalid script ID' });
    }

    // Verify script exists
    const script = await Script.findByPk(scriptId, {
      attributes: ['id', 'title', 'version']
    });

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    // Fetch all versions for this script
    const versions = await ScriptVersion.findAll({
      where: { scriptId },
      attributes: ['id', 'version', 'changelog', 'userId', 'createdAt'],
      include: [
        { model: User, as: 'user', attributes: ['id', 'username'] }
      ],
      order: [['version', 'DESC']]
    });

    // Define type for version data with optional stats
    type VersionData = {
      id: number;
      version: number;
      changelog: string | null;
      userId: number;
      createdAt: Date;
      user?: { id: number; username: string } | null;
      linesChanged?: number;
    };

    // Calculate basic diff stats for each version (lines changed)
    const versionsWithStats = await Promise.all(
      versions.map(async (v, index): Promise<VersionData> => {
        const versionData = v.toJSON() as VersionData;

        // Get content for this version and previous version
        if (index < versions.length - 1) {
          const currentContent = await ScriptVersion.findOne({
            where: { scriptId, version: v.version },
            attributes: ['content']
          });
          const previousContent = await ScriptVersion.findOne({
            where: { scriptId, version: v.version - 1 },
            attributes: ['content']
          });

          if (currentContent && previousContent) {
            const currentLines = currentContent.content.split('\n').length;
            const previousLines = previousContent.content.split('\n').length;
            versionData.linesChanged = Math.abs(currentLines - previousLines);
          }
        }

        return versionData;
      })
    );

    logger.info(`[GetVersionHistory] Found ${versions.length} versions for script ${scriptId}`);

    return res.json({
      scriptId,
      scriptTitle: script.title,
      currentVersion: script.version,
      totalVersions: versions.length,
      versions: versionsWithStats
    });
  } catch (error) {
    logger.error('[GetVersionHistory] Error:', error);
    next(error);
  }
}

/**
 * Get specific version content
 * GET /scripts/:id/versions/:versionNumber
 */
export async function getVersion(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = parseInt(req.params.id);
    const versionNumber = parseInt(req.params.versionNumber);

    if (isNaN(scriptId) || isNaN(versionNumber)) {
      return res.status(400).json({ error: 'Invalid script ID or version number' });
    }

    const version = await ScriptVersion.findOne({
      where: { scriptId, version: versionNumber },
      include: [
        { model: User, as: 'user', attributes: ['id', 'username'] }
      ]
    });

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Get the current script for comparison
    const script = await Script.findByPk(scriptId, {
      attributes: ['title', 'version', 'content']
    });

    logger.info(`[GetVersion] Retrieved version ${versionNumber} for script ${scriptId}`);

    return res.json({
      scriptId,
      scriptTitle: script?.title,
      currentVersion: script?.version,
      version: version.toJSON(),
      isCurrentVersion: version.version === script?.version
    });
  } catch (error) {
    logger.error('[GetVersion] Error:', error);
    next(error);
  }
}

/**
 * Revert script to a previous version
 * POST /scripts/:id/revert/:versionNumber
 */
export async function revertToVersion(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  let transaction: Transaction | undefined;

  try {
    const scriptId = parseInt(req.params.id);
    const targetVersion = parseInt(req.params.versionNumber);
    const userId = req.user?.id;

    if (isNaN(scriptId) || isNaN(targetVersion)) {
      return res.status(400).json({ error: 'Invalid script ID or version number' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Find the target version
    const targetVersionRecord = await ScriptVersion.findOne({
      where: { scriptId, version: targetVersion }
    });

    if (!targetVersionRecord) {
      return res.status(404).json({ error: 'Target version not found' });
    }

    // Find the current script
    const script = await Script.findByPk(scriptId);

    if (!script) {
      return res.status(404).json({ error: 'Script not found' });
    }

    // Don't revert if already at this version
    if (script.version === targetVersion) {
      return res.status(400).json({ error: 'Script is already at this version' });
    }

    // Start transaction for atomic operation
    transaction = await sequelize.transaction();

    try {
      // Increment version and update content
      const newVersion = script.version + 1;

      // Update script with reverted content
      await script.update({
        content: targetVersionRecord.content,
        version: newVersion,
        fileHash: calculateBufferMD5(Buffer.from(targetVersionRecord.content, 'utf-8'))
      }, { transaction });

      // Create new version record for the revert
      await ScriptVersion.create({
        scriptId,
        version: newVersion,
        content: targetVersionRecord.content,
        changelog: `Reverted to version ${targetVersion}`,
        userId
      }, { transaction });

      await transaction.commit();

      logger.info(`[RevertToVersion] Script ${scriptId} reverted to version ${targetVersion}, now at version ${newVersion}`);

      return res.json({
        success: true,
        message: `Script reverted to version ${targetVersion}`,
        scriptId,
        previousVersion: script.version - 1,
        newVersion,
        revertedFromVersion: targetVersion
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        logger.error('[RevertToVersion] Rollback error:', rollbackError);
      }
    }
    logger.error('[RevertToVersion] Error:', error);
    next(error);
  }
}

/**
 * Compare two versions of a script
 * GET /scripts/:id/versions/compare?from=1&to=2
 */
export async function compareVersions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = parseInt(req.params.id);
    const fromVersion = parseInt(req.query.from as string);
    const toVersion = parseInt(req.query.to as string);

    if (isNaN(scriptId) || isNaN(fromVersion) || isNaN(toVersion)) {
      return res.status(400).json({ error: 'Invalid script ID or version numbers' });
    }

    // Fetch both versions
    const [fromRecord, toRecord] = await Promise.all([
      ScriptVersion.findOne({ where: { scriptId, version: fromVersion } }),
      ScriptVersion.findOne({ where: { scriptId, version: toVersion } })
    ]);

    if (!fromRecord || !toRecord) {
      return res.status(404).json({ error: 'One or both versions not found' });
    }

    // Simple line-by-line diff
    const fromLines = fromRecord.content.split('\n');
    const toLines = toRecord.content.split('\n');

    type DiffChange = { type: 'added' | 'removed' | 'unchanged'; line: number; content: string };

    const diff = {
      fromVersion,
      toVersion,
      fromLineCount: fromLines.length,
      toLineCount: toLines.length,
      linesAdded: 0,
      linesRemoved: 0,
      changes: [] as DiffChange[]
    };

    // Basic diff algorithm
    const maxLines = Math.max(fromLines.length, toLines.length);
    for (let i = 0; i < maxLines; i++) {
      const fromLine = fromLines[i];
      const toLine = toLines[i];

      if (fromLine === undefined && toLine !== undefined) {
        diff.changes.push({ type: 'added', line: i + 1, content: toLine });
        diff.linesAdded++;
      } else if (fromLine !== undefined && toLine === undefined) {
        diff.changes.push({ type: 'removed', line: i + 1, content: fromLine });
        diff.linesRemoved++;
      } else if (fromLine !== toLine) {
        diff.changes.push({ type: 'removed', line: i + 1, content: fromLine || '' });
        diff.changes.push({ type: 'added', line: i + 1, content: toLine || '' });
        diff.linesAdded++;
        diff.linesRemoved++;
      }
    }

    logger.info(`[CompareVersions] Compared versions ${fromVersion} and ${toVersion} for script ${scriptId}`);

    return res.json(diff);
  } catch (error) {
    logger.error('[CompareVersions] Error:', error);
    next(error);
  }
}

// Export as a controller object for compatibility
export const ScriptVersionController = {
  getVersionHistory,
  getVersion,
  revertToVersion,
  compareVersions
};

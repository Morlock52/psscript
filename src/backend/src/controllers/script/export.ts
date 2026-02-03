/**
 * Script Export and Upload Controller
 *
 * Handles PDF export and file upload operations for scripts.
 * Migrated from the original ScriptController for better modularity.
 */
import {
  Request,
  Response,
  NextFunction,
  Script,
  ScriptAnalysis,
  ScriptVersion,
  User,
  Category,
  Tag,
  ScriptTag,
  sequelize,
  Transaction,
  path,
  fs,
  logger,
  calculateBufferMD5,
  checkFileExists,
  clearScriptCaches,
  TIMEOUTS
} from './shared';
import { analyzeScriptBasic } from '../../services/ai/aiEngine';

// Import PDFKit for PDF generation
import PDFDocument from 'pdfkit';

/**
 * Validate PowerShell content for basic structure
 * Checks for common PowerShell elements to filter invalid files
 */
export function validatePowerShellContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // Basic validation - check for some common PowerShell elements
  // This is not comprehensive but helps filter out obviously invalid content
  const powerShellIndicators = [
    /^\s*#/m,                     // Comments
    /^\s*function\s+[\w-]+/im,    // Function declarations
    /^\s*\$[\w-]+/m,              // Variables
    /^\s*param\s*\(/im,           // Parameter blocks
    /^\s*if\s*\(/im,              // If statements
    /^\s*foreach\s*\(/im,         // Foreach loops
    /^\s*Write-Host/im,           // Common cmdlets
    /^\s*Get-/im,                 // Common cmdlet prefix
    /^\s*Set-/im,                 // Common cmdlet prefix
    /^\s*New-/im,                 // Common cmdlet prefix
    /^\s*\[.+\]/m                 // Type declarations
  ];

  // Check if the content matches any PowerShell indicators
  return powerShellIndicators.some(regex => regex.test(content));
}

/**
 * Export script analysis as a formatted PDF
 */
export async function exportAnalysis(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  try {
    const scriptId = req.params.id;

    // Validate script ID is a number
    if (!scriptId || isNaN(parseInt(scriptId, 10))) {
      return res.status(400).json({ message: 'Invalid script ID' });
    }

    logger.info(`[ExportAnalysis] Generating PDF for script ${scriptId}`);

    // Define types for script with associations
    type ScriptWithAssociations = Script & {
      user?: { id: number; username: string } | null;
      category?: { id: number; name: string } | null;
      tags?: Array<{ id: number; name: string }>;
    };

    // Get the script
    const script = await Script.findByPk(scriptId, {
      include: [
        { model: User, as: 'user', attributes: ['id', 'username'] },
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        {
          model: Tag,
          as: 'tags',
          attributes: ['id', 'name'],
          through: { attributes: [] }
        }
      ]
    }) as ScriptWithAssociations | null;

    if (!script) {
      return res.status(404).json({ message: 'Script not found' });
    }

    // Define type for raw analysis result
    type RawAnalysis = {
      purpose?: string;
      security_score?: number;
      quality_score?: number;
      risk_score?: number;
      suggestions?: string[];
      security_concerns?: string[];
      command_details?: {
        totalCommands?: number;
        riskyCommands?: number;
        networkCommands?: number;
        fileSystemCommands?: number;
      };
      ms_docs_references?: Array<string | { url?: string; command?: string }>;
    };

    // Get the analysis data
    const analysis = await sequelize.query(
      `SELECT * FROM script_analysis WHERE script_id = :scriptId LIMIT 1`,
      {
        replacements: { scriptId },
        type: 'SELECT' as const,
        raw: true,
        plain: true
      }
    ) as unknown as RawAnalysis | null;

    // Create a new PDF document with buffered pages for footer
    const doc = new PDFDocument({
      size: 'A4',
      bufferPages: true,
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      info: {
        Title: `Script Analysis: ${script.title}`,
        Author: 'PSScript AI Analysis System',
        Subject: 'PowerShell Script Analysis Report',
        Creator: 'PSScript Platform'
      }
    });

    // Set response headers for PDF download
    const filename = `${script.title.replace(/[^a-zA-Z0-9-_]/g, '_')}_analysis.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // ===== PDF HEADER =====
    doc.fontSize(24)
       .fillColor('#4F46E5')
       .text('PowerShell Script Analysis Report', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(10)
       .fillColor('#666666')
       .text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.moveDown(1);

    // ===== SCRIPT INFORMATION =====
    doc.fontSize(16)
       .fillColor('#1F2937')
       .text('Script Information', { underline: true });

    doc.moveDown(0.5);
    doc.fontSize(11)
       .fillColor('#374151');

    // Title
    doc.font('Helvetica-Bold').text('Title: ', { continued: true })
       .font('Helvetica').text(script.title);

    // Description
    if (script.description) {
      doc.font('Helvetica-Bold').text('Description: ', { continued: true })
         .font('Helvetica').text(script.description);
    }

    // Category
    if (script.category) {
      doc.font('Helvetica-Bold').text('Category: ', { continued: true })
         .font('Helvetica').text(script.category.name);
    }

    // Author
    if (script.user) {
      doc.font('Helvetica-Bold').text('Author: ', { continued: true })
         .font('Helvetica').text(script.user.username);
    }

    // Tags
    const scriptTags = script.tags;
    if (scriptTags && scriptTags.length > 0) {
      doc.font('Helvetica-Bold').text('Tags: ', { continued: true })
         .font('Helvetica').text(scriptTags.map((t) => t.name).join(', '));
    }

    // Version
    doc.font('Helvetica-Bold').text('Version: ', { continued: true })
       .font('Helvetica').text(script.version?.toString() || '1');

    doc.moveDown(1.5);

    // ===== AI ANALYSIS SECTION =====
    if (analysis) {
      doc.fontSize(16)
         .fillColor('#1F2937')
         .text('AI Analysis Summary', { underline: true });

      doc.moveDown(0.5);

      // Purpose
      if (analysis.purpose) {
        doc.fontSize(12)
           .fillColor('#4F46E5')
           .font('Helvetica-Bold')
           .text('Purpose:');
        doc.fontSize(11)
           .fillColor('#374151')
           .font('Helvetica')
           .text(analysis.purpose);
        doc.moveDown(0.5);
      }

      // Scores Section
      doc.fontSize(12)
         .fillColor('#4F46E5')
         .font('Helvetica-Bold')
         .text('Analysis Scores:');
      doc.moveDown(0.3);

      const scores = [
        { label: 'Security Score', value: analysis.security_score, color: (analysis.security_score ?? 0) >= 7 ? '#10B981' : (analysis.security_score ?? 0) >= 5 ? '#F59E0B' : '#EF4444' },
        { label: 'Code Quality Score', value: analysis.quality_score, color: (analysis.quality_score ?? 0) >= 7 ? '#10B981' : (analysis.quality_score ?? 0) >= 5 ? '#F59E0B' : '#EF4444' },
        { label: 'Risk Score', value: analysis.risk_score, color: (analysis.risk_score ?? 10) <= 3 ? '#10B981' : (analysis.risk_score ?? 10) <= 6 ? '#F59E0B' : '#EF4444' }
      ];

      scores.forEach(score => {
        if (score.value !== undefined && score.value !== null) {
          doc.fontSize(11)
             .fillColor('#374151')
             .font('Helvetica')
             .text(`  • ${score.label}: `, { continued: true })
             .fillColor(score.color)
             .font('Helvetica-Bold')
             .text(`${parseFloat(String(score.value)).toFixed(1)}/10`);
        }
      });

      doc.moveDown(1);

      // Optimization Suggestions
      const suggestions = analysis.suggestions || [];
      if (suggestions.length > 0) {
        doc.fontSize(12)
           .fillColor('#4F46E5')
           .font('Helvetica-Bold')
           .text('Optimization Suggestions:');
        doc.moveDown(0.3);

        suggestions.forEach((suggestion: string, index: number) => {
          doc.fontSize(10)
             .fillColor('#374151')
             .font('Helvetica')
             .text(`  ${index + 1}. ${suggestion}`);
        });
        doc.moveDown(1);
      }

      // Security Concerns
      const securityConcerns = analysis.security_concerns || [];
      if (securityConcerns.length > 0) {
        doc.fontSize(12)
           .fillColor('#EF4444')
           .font('Helvetica-Bold')
           .text('Security Concerns:');
        doc.moveDown(0.3);

        securityConcerns.forEach((concern: string, index: number) => {
          doc.fontSize(10)
             .fillColor('#374151')
             .font('Helvetica')
             .text(`  ${index + 1}. ${concern}`);
        });
        doc.moveDown(1);
      }

      // Command Details
      const commandDetails = analysis.command_details;
      if (commandDetails && typeof commandDetails === 'object' && Object.keys(commandDetails).length > 0) {
        doc.fontSize(12)
           .fillColor('#4F46E5')
           .font('Helvetica-Bold')
           .text('Command Analysis:');
        doc.moveDown(0.3);

        doc.fontSize(10)
           .fillColor('#374151')
           .font('Helvetica');

        if (commandDetails.totalCommands !== undefined) {
          doc.text(`  • Total Commands: ${commandDetails.totalCommands}`);
        }
        if (commandDetails.riskyCommands !== undefined) {
          doc.text(`  • Risky Commands: ${commandDetails.riskyCommands}`);
        }
        if (commandDetails.networkCommands !== undefined) {
          doc.text(`  • Network Commands: ${commandDetails.networkCommands}`);
        }
        if (commandDetails.fileSystemCommands !== undefined) {
          doc.text(`  • File System Commands: ${commandDetails.fileSystemCommands}`);
        }
        doc.moveDown(1);
      }

      // MS Docs References
      const msDocsRefs = analysis.ms_docs_references || [];
      if (msDocsRefs.length > 0) {
        doc.fontSize(12)
           .fillColor('#4F46E5')
           .font('Helvetica-Bold')
           .text('Microsoft Documentation References:');
        doc.moveDown(0.3);

        msDocsRefs.forEach((ref, index: number) => {
          const refText = typeof ref === 'string' ? ref : (ref.url || ref.command || JSON.stringify(ref));
          doc.fontSize(9)
             .fillColor('#3B82F6')
             .font('Helvetica')
             .text(`  ${index + 1}. ${refText}`, { link: refText.startsWith('http') ? refText : undefined });
        });
        doc.moveDown(1);
      }
    } else {
      doc.fontSize(11)
         .fillColor('#666666')
         .font('Helvetica-Oblique')
         .text('No AI analysis available for this script. Consider running an analysis to get detailed insights.');
      doc.moveDown(1);
    }

    // ===== SCRIPT CONTENT SECTION =====
    doc.addPage();

    doc.fontSize(16)
       .fillColor('#1F2937')
       .text('Script Content', { underline: true });

    doc.moveDown(0.5);

    // Script content with code styling
    if (script.content) {
      // Draw a background box for the code
      const startY = doc.y;
      const pageWidth = doc.page.width - 100;

      doc.fillColor('#F3F4F6')
         .roundedRect(50, startY, pageWidth, 20, 5)
         .fill();

      doc.fontSize(8)
         .fillColor('#6B7280')
         .font('Helvetica')
         .text('PowerShell Code:', 55, startY + 5);

      doc.moveDown(1);

      // Code content
      doc.fontSize(9)
         .fillColor('#1F2937')
         .font('Courier');

      // Split content into lines and handle pagination
      const lines = script.content.split('\n');
      let lineCount = 0;

      for (const line of lines) {
        // Check if we need a new page
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
          doc.fontSize(9)
             .fillColor('#1F2937')
             .font('Courier');
        }

        // Truncate very long lines
        const displayLine = line.length > 100 ? line.substring(0, 97) + '...' : line;

        // Add line number prefix
        lineCount++;
        const lineNum = lineCount.toString().padStart(4, ' ');

        doc.fillColor('#9CA3AF')
           .text(`${lineNum} | `, { continued: true })
           .fillColor('#1F2937')
           .text(displayLine || ' ');
      }
    }

    // ===== FOOTER =====
    const range = doc.bufferedPageRange();
    const pageCount = range.count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      doc.fontSize(8)
         .fillColor('#9CA3AF')
         .text(
           `Page ${i + 1} of ${pageCount} | PSScript Analysis Platform`,
           50,
           doc.page.height - 30,
           { align: 'center', lineBreak: false }
         );
    }

    // Flush all pages after adding footers
    doc.flushPages();

    // Finalize the PDF
    doc.end();

    logger.info(`[ExportAnalysis] PDF generated successfully for script ${scriptId}`);

  } catch (error) {
    logger.error('[ExportAnalysis] Error generating PDF:', error);
    next(error);
  }
}

// Extend Request with user for authenticated uploads
// Note: `file` property is already typed by multer via Express.Multer.File
interface UploadRequest extends Request {
  user?: { id: number; role?: string };
}

/**
 * Upload a script file and store it in the database with enhanced error handling
 */
export async function uploadScript(
  req: UploadRequest,
  res: Response,
  _next: NextFunction
): Promise<void | Response> {
  let transaction: Transaction | undefined;

  try {
    // Set longer timeout for the request to handle network latency
    req.setTimeout(60000); // 60 seconds

    // Start transaction with serializable isolation level for better consistency
    transaction = await sequelize.transaction({
      isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE
    });

    // eslint-disable-next-line camelcase -- API request body uses snake_case
    const { title, description, category_id, tags: tagsJson, is_public, analyze_with_ai } = req.body as {
      title?: string;
      description?: string;
      category_id?: number; // eslint-disable-line camelcase
      tags?: string;
      is_public?: string | boolean; // eslint-disable-line camelcase
      analyze_with_ai?: string | boolean; // eslint-disable-line camelcase
    };

    // SECURITY: Require authentication for script uploads
    if (!req.user?.id) {
      if (transaction) await transaction.rollback();
      return res.status(401).json({
        error: 'authentication_required',
        message: 'You must be logged in to upload scripts'
      });
    }

    const userId = req.user.id;

    // Get file content from the uploaded file
    if (!req.file) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        error: 'missing_file',
        message: 'No file was uploaded'
      });
    }

    // Calculate file hash for integrity verification and deduplication
    const fileHash = calculateBufferMD5(req.file.buffer);
    logger.info(`Calculated file hash: ${fileHash}`);

    // Check if a file with the same hash already exists
    const existingScriptId = await checkFileExists(fileHash, sequelize);
    if (existingScriptId) {
      if (transaction) await transaction.rollback();
      return res.status(409).json({
        error: 'duplicate_file',
        message: 'A script with identical content already exists',
        existingScriptId
      });
    }

    // Read file content with validation
    let scriptContent: string;
    try {
      scriptContent = req.file.buffer.toString('utf8');

      // Check for binary content (control characters indicate non-text file)
      // eslint-disable-next-line no-control-regex
      if (scriptContent.includes('\u0000') || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(scriptContent)) {
        if (transaction) await transaction.rollback();
        return res.status(400).json({
          error: 'binary_content',
          message: 'The file appears to be binary, not a text-based script'
        });
      }

      // Limit size of very large files
      if (scriptContent.length > 500000) { // 500KB limit
        scriptContent = scriptContent.substring(0, 500000) + '\n\n# Content truncated due to size limit';
        logger.warn(`Script content truncated due to size (${req.file.size} bytes)`);
      }
    } catch (readError) {
      if (transaction) await transaction.rollback();
      logger.error('Error reading file content:', readError);
      return res.status(400).json({
        error: 'file_read_error',
        message: 'Could not read file contents'
      });
    }

    const fileName = req.file.originalname;
    const fileType = path.extname(fileName).toLowerCase();

    // Basic content validation for PowerShell scripts
    if (fileType === '.ps1' && !validatePowerShellContent(scriptContent)) {
      if (transaction) await transaction.rollback();
      return res.status(400).json({
        error: 'invalid_content',
        message: 'The file does not appear to be a valid PowerShell script'
      });
    }

    // Parse tags if provided with validation
    let tags: string[] = [];
    if (tagsJson) {
      try {
        tags = typeof tagsJson === 'string' ? JSON.parse(tagsJson) : tagsJson;

        // Validate tags
        if (!Array.isArray(tags)) {
          tags = [];
          logger.warn('Tags is not an array, ignoring tags');
        } else if (tags.length > 10) {
          if (transaction) await transaction.rollback();
          return res.status(400).json({
            error: 'too_many_tags',
            message: 'A maximum of 10 tags is allowed'
          });
        }
      } catch (e) {
        logger.warn('Failed to parse tags JSON:', e);
        tags = []; // Reset to empty array on parse error
      }
    }

    // Create the script record in the database
    const scriptTitle = title || fileName || 'Untitled Script';
    const script = await Script.create({
      title: scriptTitle,
      description: description || 'No description provided',
      content: scriptContent,
      userId,
      categoryId: category_id || null, // eslint-disable-line camelcase
      version: 1,
      executionCount: 0,
      isPublic: is_public === 'true' || is_public === true, // eslint-disable-line camelcase
      fileHash: fileHash // Save the file hash to the database
    }, { transaction });

    logger.info(`Created script record with ID ${script.id}`);

    // Create initial script version
    await ScriptVersion.create({
      scriptId: script.id,
      version: 1,
      content: scriptContent,
      changelog: 'Initial upload',
      userId
    }, { transaction });

    logger.info(`Created script version for script ${script.id}`);

    // Save the file to the uploads directory for persistence
    const uniqueFileName = `${Date.now()}-${path.basename(fileName)}`;
    const filePath = path.join(process.cwd(), 'uploads', uniqueFileName);

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      logger.info('Created uploads directory');
    }

    // Write the file to disk with error handling
    try {
      fs.writeFileSync(filePath, scriptContent);
      logger.info(`Saved script file to ${filePath}`);
    } catch (fileWriteError) {
      logger.error('Error writing file to disk:', fileWriteError);
      // Continue even if file write fails - we have the content in the database
    }

    // Add tags if provided
    const tagIds: number[] = [];
    if (tags && Array.isArray(tags) && tags.length > 0) {
      for (const tagName of tags) {
        if (typeof tagName !== 'string' || !tagName.trim()) continue;

        try {
          // Find or create the tag
          const [tag] = await Tag.findOrCreate({
            where: { name: tagName.toLowerCase().trim() },
            defaults: { name: tagName.toLowerCase().trim() },
            transaction
          });

          tagIds.push(tag.id);

          await ScriptTag.create({
            scriptId: script.id,
            tagId: tag.id
          }, { transaction });

          logger.info(`Added tag "${tagName}" to script ${script.id}`);
        } catch (tagError) {
          logger.warn(`Failed to create tag "${tagName}": ${(tagError as Error).message}`);
          // Continue with other tags
        }
      }
    }

    // Commit the transaction
    await transaction.commit();
    logger.info(`Transaction committed for script upload ${script.id}`);

    // Clear relevant caches
    clearScriptCaches();

    // Send the response immediately
    const responseData = {
      success: true,
      script: {
        id: script.id,
        title: script.title,
        description: script.description,
        userId: script.userId,
        categoryId: script.categoryId,
        version: script.version,
        executionCount: script.executionCount,
        isPublic: script.isPublic,
        createdAt: script.createdAt,
        updatedAt: script.updatedAt,
        tags: tagIds
      },
      message: 'Script uploaded and saved to database successfully',
      filePath: filePath
    };

    res.status(201).json(responseData);

    // Perform AI analysis asynchronously after response is sent
    if (analyze_with_ai === 'true' || analyze_with_ai === true) { // eslint-disable-line camelcase
      performAsyncAnalysis(script.id, scriptContent, category_id, req.headers['x-openai-api-key'] as string);
    } else {
      logger.info(`AI analysis skipped for script ${script.id}`);
    }
  } catch (error) {
    // Ensure transaction is rolled back
    if (transaction) {
      try {
        await transaction.rollback();
        logger.info('Transaction rolled back due to error');
      } catch (rollbackError) {
        logger.error('Error rolling back transaction:', rollbackError);
      }
    }

    logger.error('Error in uploadScript:', error);

    // Provide more specific error messages
    const err = error as { name?: string; errors?: Array<{ message: string }> };
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'unique_constraint_error',
        message: 'A script with this title already exists'
      });
    }

    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'validation_error',
        message: 'Validation error',
        details: err.errors?.map((e) => e.message)
      });
    }

    return res.status(500).json({
      error: 'server_error',
      message: 'An unexpected error occurred while processing the upload'
    });
  }
}

/**
 * Perform AI analysis asynchronously after response is sent
 */
async function performAsyncAnalysis(
  scriptId: number,
  scriptContent: string,
  categoryId: number | undefined,
  openaiApiKey: string | undefined
): Promise<void> {
  try {
    logger.info(`Starting AI analysis for script ${scriptId}`);
    const analysis = await analyzeScriptBasic(scriptContent, openaiApiKey);

    // Create analysis record with transaction
    const analysisTransaction = await sequelize.transaction();
    try {
      await ScriptAnalysis.create({
        scriptId: scriptId,
        purpose: analysis.purpose || 'No purpose provided',
        parameters: analysis.parameters || {},
        securityScore: analysis.security_score || 5.0,
        codeQualityScore: analysis.code_quality_score || 5.0,
        riskScore: analysis.risk_score || 5.0,
        optimizationSuggestions: analysis.optimization || [],
        commandDetails: analysis.command_details || {},
        msDocsReferences: analysis.ms_docs_references || []
      }, { transaction: analysisTransaction });

      // Update the script with the determined category if not manually set
      if (!categoryId && analysis.category_id) {
        const script = await Script.findByPk(scriptId);
        if (script) {
          await script.update({
            categoryId: analysis.category_id
          }, { transaction: analysisTransaction });
        }
      }

      await analysisTransaction.commit();
      logger.info(`AI analysis completed and saved for script ${scriptId}`);
    } catch (analysisDbError) {
      await analysisTransaction.rollback();
      logger.error(`Error saving analysis results for script ${scriptId}:`, analysisDbError);
    }
  } catch (analysisError) {
    logger.error(`AI analysis failed for script ${scriptId}:`, analysisError);

    // Create a basic analysis record even if AI analysis fails
    try {
      await ScriptAnalysis.create({
        scriptId: scriptId,
        purpose: 'Analysis pending',
        parameters: {},
        securityScore: 5.0, // Default middle score
        codeQualityScore: 5.0,
        riskScore: 5.0,
        optimizationSuggestions: [],
        commandDetails: {},
        msDocsReferences: []
      });

      logger.info(`Created default analysis for script ${scriptId} due to AI service failure`);
    } catch (fallbackAnalysisError) {
      logger.error(`Failed to create fallback analysis for script ${scriptId}:`, fallbackAnalysisError);
    }
  }
}

// Export as a controller object for compatibility
export const ScriptExportController = {
  exportAnalysis,
  uploadScript,
  validatePowerShellContent
};

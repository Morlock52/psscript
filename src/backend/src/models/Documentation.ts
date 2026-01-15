import { Model, DataTypes, Sequelize, Op } from 'sequelize';

/**
 * Documentation Model
 *
 * Stores crawled PowerShell documentation, tutorials, and reference materials.
 * Supports full-text search and vector embeddings for semantic search.
 */
export default class Documentation extends Model {
  public id!: number;
  public title!: string;
  public url!: string;
  public content!: string;
  public summary!: string;
  public source!: string;
  public contentType!: string;
  public category!: string;
  public tags!: string[];
  public extractedCommands!: string[];
  public extractedFunctions!: string[];
  public extractedModules!: string[];
  public metadata!: object;
  public crawledAt!: Date;
  public lastUpdated!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initialize(sequelize: Sequelize) {
    Documentation.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      title: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      url: {
        type: DataTypes.STRING(2048),
        allowNull: false,
        unique: true
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Full extracted content from the page'
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'AI-generated or extracted summary'
      },
      source: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'Microsoft Learn',
        comment: 'Source of documentation (Microsoft Learn, PowerShell Gallery, GitHub, etc.)'
      },
      contentType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'article',
        field: 'content_type',
        comment: 'Type: article, tutorial, reference, cmdlet, module, example'
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'General',
        comment: 'Category for organizing documentation (e.g., Process Management, File System, Security)'
      },
      tags: {
        type: DataTypes.JSONB,
        defaultValue: [],
        comment: 'Tags for categorization and filtering'
      },
      extractedCommands: {
        type: DataTypes.JSONB,
        defaultValue: [],
        field: 'extracted_commands',
        comment: 'PowerShell commands/cmdlets extracted from content'
      },
      extractedFunctions: {
        type: DataTypes.JSONB,
        defaultValue: [],
        field: 'extracted_functions',
        comment: 'PowerShell functions extracted from content'
      },
      extractedModules: {
        type: DataTypes.JSONB,
        defaultValue: [],
        field: 'extracted_modules',
        comment: 'PowerShell modules referenced in content'
      },
      metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        comment: 'Additional metadata (author, version, last modified, etc.)'
      },
      crawledAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'crawled_at'
      },
      lastUpdated: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_updated',
        comment: 'When the source content was last updated'
      }
    }, {
      sequelize,
      tableName: 'documentation',
      underscored: true,
      indexes: [
        { fields: ['url'], unique: true },
        { fields: ['source'] },
        { fields: ['content_type'] },
        { fields: ['crawled_at'] },
        { fields: ['tags'], using: 'GIN' }
      ]
    });
  }

  /**
   * Search documentation by query
   */
  static async search(params: {
    query?: string;
    sources?: string[];
    tags?: string[];
    contentTypes?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'relevance' | 'date' | 'title';
  }) {
    const {
      query,
      sources,
      tags,
      contentTypes,
      limit = 20,
      offset = 0,
      sortBy = 'date'
    } = params;

    const where: any = {};

    // Filter by sources
    if (sources && sources.length > 0) {
      where.source = { [Op.in]: sources };
    }

    // Filter by content types
    if (contentTypes && contentTypes.length > 0) {
      where.contentType = { [Op.in]: contentTypes };
    }

    // Filter by tags (any match)
    if (tags && tags.length > 0) {
      where.tags = { [Op.overlap]: tags };
    }

    // Text search on title, content, summary
    if (query) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query}%` } },
        { content: { [Op.iLike]: `%${query}%` } },
        { summary: { [Op.iLike]: `%${query}%` } }
      ];
    }

    // Determine sort order
    let order: any[] = [];
    switch (sortBy) {
      case 'date':
        order = [['crawled_at', 'DESC']];
        break;
      case 'title':
        order = [['title', 'ASC']];
        break;
      case 'relevance':
      default:
        order = [['crawled_at', 'DESC']];
        break;
    }

    const { count, rows } = await Documentation.findAndCountAll({
      where,
      limit,
      offset,
      order
    });

    return {
      items: rows,
      total: count,
      limit,
      offset
    };
  }

  /**
   * Get unique sources
   */
  static async getSources(): Promise<string[]> {
    const results = await Documentation.findAll({
      attributes: [[Sequelize.fn('DISTINCT', Sequelize.col('source')), 'source']],
      raw: true
    }) as any[];

    return results.map(r => r.source).filter(Boolean);
  }

  /**
   * Get all unique tags
   */
  static async getTags(): Promise<string[]> {
    const results = await Documentation.findAll({
      attributes: ['tags'],
      raw: true
    }) as any[];

    const allTags = new Set<string>();
    results.forEach(r => {
      if (Array.isArray(r.tags)) {
        r.tags.forEach((tag: string) => allTags.add(tag));
      }
    });

    return Array.from(allTags).sort();
  }

  /**
   * Upsert documentation (update if URL exists, insert if not)
   */
  static async upsertDoc(data: Partial<Documentation>): Promise<[Documentation, boolean]> {
    return Documentation.upsert(data as any, {
      returning: true
    }) as any;
  }
}

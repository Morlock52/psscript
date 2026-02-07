import { Model, DataTypes, Sequelize } from 'sequelize';

/**
 * CommandInsight Model
 *
 * Stores AI-enriched details for a PowerShell cmdlet (flags, examples, usage, etc.)
 * Generated via a background enrichment job that scans documentation.extracted_commands.
 */
export default class CommandInsight extends Model {
  public id!: number;
  public cmdletName!: string;
  public description!: string | null;
  public howToUse!: string | null;
  public keyParameters!: any[];
  public useCases!: any[];
  public examples!: any[];
  public sampleOutput!: string | null;
  public flags!: any[];
  public docsUrls!: any[];
  public sources!: Record<string, unknown>;
  public lastEnrichedAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initialize(sequelize: Sequelize) {
    CommandInsight.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        cmdletName: {
          type: DataTypes.STRING(200),
          allowNull: false,
          unique: true,
          field: 'cmdlet_name'
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        howToUse: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: 'how_to_use'
        },
        keyParameters: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
          field: 'key_parameters'
        },
        useCases: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
          field: 'use_cases'
        },
        examples: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: []
        },
        sampleOutput: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: 'sample_output'
        },
        flags: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: []
        },
        docsUrls: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
          field: 'docs_urls'
        },
        sources: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: {}
        },
        lastEnrichedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: 'last_enriched_at'
        }
      },
      {
        sequelize,
        tableName: 'command_insights',
        underscored: true,
        indexes: [{ fields: ['cmdlet_name'], unique: true }]
      }
    );
  }
}


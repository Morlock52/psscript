import { Model, DataTypes, Sequelize } from 'sequelize';
import Script from './Script';

/**
 * ScriptEmbedding
 *
 * Stores pgvector embeddings for scripts for semantic search/similarity.
 * Backed by `script_embeddings.embedding vector(1536)`.
 */
export default class ScriptEmbedding extends Model {
  public id!: number;
  public scriptId!: number;
  public embedding!: number[];
  public modelVersion!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public readonly script?: Script;

  static initialize(sequelize: Sequelize) {
    ScriptEmbedding.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        scriptId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          field: 'script_id',
          references: {
            model: 'scripts',
            key: 'id',
          },
          onDelete: 'CASCADE',
        },
        embedding: {
          // Provided by pgvector/sequelize registration (see database/connection.ts)
          type: (DataTypes as any).VECTOR(1536),
          allowNull: false,
        },
        modelVersion: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: 'text-embedding-3-small',
          field: 'model_version',
        },
      },
      {
        sequelize,
        tableName: 'script_embeddings',
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ['script_id', 'model_version'],
          },
        ],
      }
    );
  }

  static associate() {
    ScriptEmbedding.belongsTo(Script, { foreignKey: 'scriptId', as: 'script' });
  }
}

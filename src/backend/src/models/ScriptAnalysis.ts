import { Model, DataTypes, Sequelize } from 'sequelize';
import Script from './Script';

export default class ScriptAnalysis extends Model {
  public id!: number;
  public scriptId!: number;
  public purpose!: string;
  public parameters!: object;
  public securityScore!: number;
  public codeQualityScore!: number;
  public riskScore!: number;
  public optimizationSuggestions!: string[];
  public aiComments!: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // References
  public readonly script?: Script;

  static initialize(sequelize: Sequelize) {
    ScriptAnalysis.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      scriptId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'scripts',
          key: 'id'
        },
        unique: true
      },
      purpose: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      parameters: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      securityScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      codeQualityScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      riskScore: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
      optimizationSuggestions: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        defaultValue: []
      },
      aiComments: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'script_analysis'
    });
  }

  static associate() {
    ScriptAnalysis.belongsTo(Script, { foreignKey: 'scriptId', as: 'script' });
  }
}
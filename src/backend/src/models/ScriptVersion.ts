import { Model, DataTypes, Sequelize } from 'sequelize';
import Script from './Script';

export default class ScriptVersion extends Model {
  public id!: number;
  public scriptId!: number;
  public version!: number;
  public content!: string;
  public changelog!: string | null;
  public userId!: number;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // References
  public readonly script?: Script;

  static initialize(sequelize: Sequelize) {
    ScriptVersion.init({
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
        onDelete: 'CASCADE'
      },
      version: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      changelog: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        }
      }
    }, {
      sequelize,
      tableName: 'script_versions',
      indexes: [
        {
          unique: true,
          fields: ['scriptId', 'version']
        }
      ]
    });
  }

  static associate() {
    ScriptVersion.belongsTo(Script, { foreignKey: 'scriptId', as: 'script' });
  }
}
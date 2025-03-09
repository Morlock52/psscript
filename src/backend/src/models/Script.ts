import { Model, DataTypes, Sequelize } from 'sequelize';
import User from './User';
import Category from './Category';
import ScriptAnalysis from './ScriptAnalysis';
import Tag from './Tag';

export default class Script extends Model {
  public id!: number;
  public title!: string;
  public description!: string;
  public content!: string;
  public userId!: number;
  public categoryId!: number;
  public version!: number;
  public executionCount!: number;
  public isPublic!: boolean;
  public fileHash?: string;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // References
  public readonly user?: User;
  public readonly category?: Category;

  static initialize(sequelize: Sequelize) {
    Script.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      title: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        field: 'user_id'
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'categories',
          key: 'id'
        },
        field: 'category_id'
      },
      version: {
        type: DataTypes.INTEGER,
        defaultValue: 1
      },
      executionCount: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'execution_count'
      },
      isPublic: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_public'
      },
      fileHash: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: 'file_hash'
      }
    }, {
      sequelize,
      tableName: 'scripts',
      underscored: true,
      hooks: {
        beforeCreate: async (script: Script) => {
          // Any pre-save processing logic
        }
      }
    });
  }

  static associate() {
    Script.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    Script.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
    Script.hasOne(ScriptAnalysis, { foreignKey: 'scriptId', as: 'analysis' });
    Script.belongsToMany(Tag, { 
      through: 'script_tags',
      foreignKey: 'script_id',
      otherKey: 'tag_id',
      as: 'tags'
    });
  }
}

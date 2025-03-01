import { Model, DataTypes, Sequelize } from 'sequelize';
import Script from './Script';
import Tag from './Tag';

export default class ScriptTag extends Model {
  public scriptId!: number;
  public tagId!: number;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initialize(sequelize: Sequelize) {
    ScriptTag.init({
      scriptId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: 'scripts',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      tagId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: 'tags',
          key: 'id'
        },
        onDelete: 'CASCADE'
      }
    }, {
      sequelize,
      tableName: 'script_tags',
      timestamps: true
    });
  }

  static associate() {
    // This model already has its associations configured in the parent models
  }
}
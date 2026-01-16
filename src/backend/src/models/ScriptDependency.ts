import { Model, DataTypes, Sequelize } from 'sequelize';
import Script from './Script';

/**
 * ScriptDependency model - Tracks parent/child relationships between scripts
 * Table: script_dependencies
 * Composite primary key: (parent_script_id, child_script_id)
 */
export default class ScriptDependency extends Model {
  public parentScriptId!: number;
  public childScriptId!: number;

  public readonly createdAt!: Date;

  // References
  public readonly parentScript?: Script;
  public readonly childScript?: Script;

  static initialize(sequelize: Sequelize) {
    ScriptDependency.init({
      parentScriptId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        field: 'parent_script_id',
        references: {
          model: 'scripts',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      childScriptId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        field: 'child_script_id',
        references: {
          model: 'scripts',
          key: 'id'
        },
        onDelete: 'CASCADE'
      }
    }, {
      sequelize,
      tableName: 'script_dependencies',
      underscored: true,
      updatedAt: false // Only has created_at
    });
  }

  static associate() {
    ScriptDependency.belongsTo(Script, {
      foreignKey: 'parent_script_id',
      as: 'parentScript'
    });
    ScriptDependency.belongsTo(Script, {
      foreignKey: 'child_script_id',
      as: 'childScript'
    });
  }
}

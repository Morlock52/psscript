import { Model, DataTypes, Sequelize } from 'sequelize';

export default class ScriptTag extends Model {
  public scriptId!: number;
  public tagId!: number;

  static initialize(sequelize: Sequelize) {
    ScriptTag.init({
      scriptId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: 'scripts',
          key: 'id'
        },
        onDelete: 'CASCADE',
        field: 'script_id'
      },
      tagId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
          model: 'tags',
          key: 'id'
        },
        onDelete: 'CASCADE',
        field: 'tag_id'
      }
    }, {
      sequelize,
      tableName: 'script_tags',
      timestamps: false, // Junction table has no timestamps
      underscored: true
    });
  }

  static associate() {
    // This model already has its associations configured in the parent models
  }
}

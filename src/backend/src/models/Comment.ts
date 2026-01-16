import { Model, DataTypes, Sequelize } from 'sequelize';
import User from './User';
import Script from './Script';

/**
 * Comment model - Represents user comments on scripts
 * Table: comments
 */
export default class Comment extends Model {
  public id!: number;
  public scriptId!: number;
  public userId!: number;
  public content!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // References
  public readonly user?: User;
  public readonly script?: Script;

  static initialize(sequelize: Sequelize) {
    Comment.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      scriptId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'script_id',
        references: {
          model: 'scripts',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id'
        }
      },
      content: {
        type: DataTypes.TEXT,
        allowNull: false
      }
    }, {
      sequelize,
      tableName: 'comments',
      underscored: true,
      indexes: [
        { fields: ['script_id'], name: 'idx_comments_script' },
        { fields: ['user_id'], name: 'idx_comments_user' }
      ]
    });
  }

  static associate() {
    Comment.belongsTo(Script, {
      foreignKey: 'script_id',
      as: 'script'
    });
    Comment.belongsTo(User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  }
}

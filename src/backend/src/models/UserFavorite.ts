import { Model, DataTypes, Sequelize } from 'sequelize';
import User from './User';
import Script from './Script';

/**
 * UserFavorite model - Junction table for user favorite scripts
 * Table: user_favorites
 * Composite primary key: (user_id, script_id)
 */
export default class UserFavorite extends Model {
  public userId!: number;
  public scriptId!: number;

  public readonly createdAt!: Date;

  // References
  public readonly user?: User;
  public readonly script?: Script;

  static initialize(sequelize: Sequelize) {
    UserFavorite.init({
      userId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id'
        }
      },
      scriptId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        field: 'script_id',
        references: {
          model: 'scripts',
          key: 'id'
        },
        onDelete: 'CASCADE'
      }
    }, {
      sequelize,
      tableName: 'user_favorites',
      underscored: true,
      updatedAt: false // Only has created_at
    });
  }

  static associate() {
    UserFavorite.belongsTo(User, {
      // Use model attribute names; field mapping handles snake_case columns.
      foreignKey: 'userId',
      as: 'user'
    });
    UserFavorite.belongsTo(Script, {
      // Use model attribute names; field mapping handles snake_case columns.
      foreignKey: 'scriptId',
      as: 'script'
    });
  }
}

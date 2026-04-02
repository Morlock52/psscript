import { Model, DataTypes, Sequelize } from 'sequelize';
import User from './User';

export default class ChatHistory extends Model {
  public id!: number;
  public userId!: number;
  public messages!: object[];
  public response!: string;
  public embedding?: number[] | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // References
  public readonly user?: User;

  static initialize(sequelize: Sequelize) {
    ChatHistory.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        field: 'user_id',
      },
      messages: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      response: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      embedding: {
        type: DataTypes.ARRAY(DataTypes.FLOAT),
        allowNull: true,
      },
    }, {
      sequelize,
      tableName: 'chat_history',
      underscored: true,
      timestamps: true,
      indexes: [
        {
          name: 'chat_history_user_id_idx',
          fields: ['user_id'],
        },
        {
          name: 'chat_history_created_at_idx',
          fields: ['created_at'],
        },
      ],
    });
  }

  static associate() {
    ChatHistory.belongsTo(User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

import { DataTypes, Model, Sequelize } from 'sequelize';
import { User } from './User';

export interface ChatHistoryAttributes {
  id?: number;
  userId: number;
  messages: object[];
  response: string;
  embedding?: number[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChatHistoryInstance extends Model<ChatHistoryAttributes>, ChatHistoryAttributes {}

export const defineChatHistoryModel = (sequelize: Sequelize) => {
  const ChatHistory = sequelize.define<ChatHistoryInstance>(
    'ChatHistory',
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
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
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'chat_history',
      timestamps: true,
      indexes: [
        {
          name: 'chat_history_user_id_idx',
          fields: ['userId'],
        },
        {
          name: 'chat_history_created_at_idx',
          fields: ['createdAt'],
        },
      ],
    }
  );

  // Define associations
  ChatHistory.associate = (models: any) => {
    ChatHistory.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  return ChatHistory;
};

export function initChatHistoryModel(sequelize: Sequelize): void {
  defineChatHistoryModel(sequelize);
}

export default defineChatHistoryModel;
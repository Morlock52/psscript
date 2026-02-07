// File has been checked for TypeScript errors
import { DataTypes, Model, Sequelize } from 'sequelize';

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

const ChatHistory = function(sequelize: Sequelize) {
  const ChatHistoryModel = sequelize.define<ChatHistoryInstance>(
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
        field: 'user_id',
        references: {
          model: 'users',
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
        // Provided by pgvector/sequelize registration (see database/connection.ts)
        type: (DataTypes as any).VECTOR(1536),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      tableName: 'chat_history',
      timestamps: true,
      underscored: true,
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

  // Add associate method
  // @ts-ignore - Dynamic association assignment pattern
  ChatHistoryModel.associate = function() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { User } = require('./index');
    ChatHistoryModel.belongsTo(User, {
      foreignKey: 'userId',
      as: 'user',
    });
  };

  return ChatHistoryModel;
};

// Initialize model
ChatHistory.initialize = function(sequelize: Sequelize) {
  return ChatHistory(sequelize);
};

export default ChatHistory;

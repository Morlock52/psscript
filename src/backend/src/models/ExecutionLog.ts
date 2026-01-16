import { Model, DataTypes, Sequelize } from 'sequelize';
import Script from './Script';
import User from './User';

export default class ExecutionLog extends Model {
  public id!: number;
  public scriptId!: number;
  public userId!: number | null;
  public parameters!: object;
  public status!: string;
  public errorMessage!: string | null;
  public executionTime!: number;
  
  public readonly createdAt!: Date;

  // References
  public readonly script?: Script;
  public readonly user?: User;

  static initialize(sequelize: Sequelize) {
    ExecutionLog.init({
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
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL'
      },
      parameters: {
        type: DataTypes.JSONB,
        defaultValue: {}
      },
      status: {
        type: DataTypes.STRING(50), // Matches VARCHAR(50) in database
        allowNull: false,
        validate: {
          isIn: [['success', 'failure', 'timeout', 'cancelled']]
        }
      },
      errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      executionTime: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
      },
    }, {
      sequelize,
      tableName: 'execution_logs',
      underscored: true,
      updatedAt: false, // execution_logs table only has created_at
      indexes: [
        {
          fields: ['scriptId']
        },
        {
          fields: ['userId']
        },
        {
          fields: ['createdAt']
        }
      ]
    });
  }

  static associate() {
    ExecutionLog.belongsTo(Script, { foreignKey: 'scriptId', as: 'script' });
    ExecutionLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
  }
}
import { Model, DataTypes, Sequelize } from 'sequelize';
import Script from './Script';
import ScriptTag from './ScriptTag';

export default class Tag extends Model {
  public id!: number;
  public name!: string;
  public description!: string | null;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // References
  public readonly scripts?: Script[];

  static initialize(sequelize: Sequelize) {
    Tag.init({
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    }, {
      sequelize,
      tableName: 'tags'
    });
  }

  static associate() {
    Tag.belongsToMany(Script, { 
      through: ScriptTag,
      foreignKey: 'tagId',
      otherKey: 'scriptId',
      as: 'scripts'
    });
  }
}
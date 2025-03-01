import { Model, DataTypes, Sequelize } from 'sequelize';
import Script from './Script';

export default class Category extends Model {
  public id!: number;
  public name!: string;
  public description!: string;
  public iconName!: string;
  public parentId!: number | null;
  
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // References
  public readonly scripts?: Script[];
  public readonly parent?: Category;
  public readonly children?: Category[];

  static initialize(sequelize: Sequelize) {
    Category.init({
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
      },
      iconName: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'categories',
          key: 'id'
        }
      }
    }, {
      sequelize,
      tableName: 'categories'
    });
  }

  static associate() {
    Category.hasMany(Script, { foreignKey: 'categoryId', as: 'scripts' });
    Category.belongsTo(Category, { foreignKey: 'parentId', as: 'parent' });
    Category.hasMany(Category, { foreignKey: 'parentId', as: 'children' });
  }
}
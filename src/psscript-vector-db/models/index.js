const PowerShellScript = require('./PowerShellScript');
const Category = require('./Category');
const MSLearnContent = require('./MSLearnContent');
const ScriptAnalysis = require('./ScriptAnalysis');

// Define relationships between models
PowerShellScript.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Category.hasMany(PowerShellScript, { foreignKey: 'categoryId', as: 'scripts' });

PowerShellScript.hasOne(ScriptAnalysis, { foreignKey: 'scriptId', as: 'analysis' });
ScriptAnalysis.belongsTo(PowerShellScript, { foreignKey: 'scriptId', as: 'script' });

module.exports = {
  PowerShellScript,
  Category,
  MSLearnContent,
  ScriptAnalysis
};

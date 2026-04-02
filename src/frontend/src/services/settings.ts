// Available AI models for the application (updated April 2026)
export const AI_MODELS = [
  { id: 'o4-mini', name: 'o4-mini (Efficient)', description: 'OpenAI\'s lightweight reasoning model optimized for speed and efficiency' },
  { id: 'gpt-4.1', name: 'GPT-4.1 (Optimal)', description: 'OpenAI\'s most advanced model with optimal balance of intelligence, speed, and cost' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (Balanced)', description: 'Efficient model with strong reasoning and smaller footprint' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (Fast)', description: 'Fast, cost-effective model for simpler analysis tasks' },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Premium)', description: 'Anthropic\'s most advanced model with superior reasoning abilities' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus (Advanced)', description: 'Exceptional at complex security analysis and code understanding' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet (Balanced)', description: 'Well-balanced model for script analysis with good performance' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku (Efficient)', description: 'Fast, efficient model for quick script assessment' },
  { id: 'mistral-large', name: 'Mistral Large (Alternative)', description: 'Open-weight alternative with strong code understanding capabilities' },
  { id: 'llama-3-70b', name: 'Llama 3 70B (Open)', description: 'Meta\'s open model with excellent code analysis abilities' },
];

// Default settings
const DEFAULT_SETTINGS: AppSettings = {
  aiModel: 'o4-mini',
  theme: 'dark',
  autoRunAnalysis: true,
  executionTimeout: 60,
};

// Type definition for settings
export interface AppSettings {
  aiModel: string;
  theme: 'light' | 'dark' | 'system';
  autoRunAnalysis: boolean;
  executionTimeout: number;
}

// Load settings from localStorage
export const loadSettings = (): AppSettings => {
  const savedSettings = localStorage.getItem('app_settings');
  if (savedSettings) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };
    } catch (e) {
      console.error('Failed to parse saved settings', e);
    }
  }
  return DEFAULT_SETTINGS;
};

// Save settings to localStorage
export const saveSettings = (settings: Partial<AppSettings>): AppSettings => {
  const currentSettings = loadSettings();
  const newSettings = { ...currentSettings, ...settings };
  localStorage.setItem('app_settings', JSON.stringify(newSettings));
  return newSettings;
};

// Set the AI model
export const setAiModel = (modelId: string): AppSettings => {
  return saveSettings({ aiModel: modelId });
};

// Get the current AI model details
export const getCurrentAiModel = () => {
  const settings = loadSettings();
  return AI_MODELS.find(model => model.id === settings.aiModel) || AI_MODELS[0];
};

// Initialize settings
export const initializeSettings = () => {
  const settings = loadSettings();
  console.log('Initializing settings - mock data functionality has been removed');
  // Remove any existing mock data settings from localStorage
  localStorage.removeItem('use_mock_data');
  return settings;
};

// Initialize on module load
initializeSettings();

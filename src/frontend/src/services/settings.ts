// Available AI models for the application (updated 2 April 2026)
export const AI_MODELS = [
  // OpenAI models
  { id: 'gpt-4.1', name: 'GPT-4.1 (Code)', description: 'Best for code generation — 1M token context, optimized for scripting tasks' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini (Fast)', description: 'Efficient model with strong reasoning and 1M token context' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano (Cheap)', description: 'Cheapest option for simpler analysis tasks' },
  { id: 'gpt-5.4', name: 'GPT-5.4 (Flagship)', description: 'Most capable OpenAI model for complex multi-step tasks' },
  { id: 'o4-mini', name: 'O4 Mini (Reasoning)', description: 'Lightweight reasoning model for step-by-step analysis' },
  { id: 'o3', name: 'O3 (Reasoning)', description: 'Full reasoning model for complex analysis tasks' },
  // Anthropic Claude 4.6 models (February 2026)
  { id: 'claude-sonnet-4-6-20260217', name: 'Claude Sonnet 4.6 (Balanced)', description: 'Anthropic\'s balanced model — 1M context, adaptive thinking' },
  { id: 'claude-opus-4-6-20260205', name: 'Claude Opus 4.6 (Best)', description: 'Most capable Claude model for complex reasoning and analysis' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5 (Fast)', description: 'Fast, cost-effective Claude model for quick assessments' },
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

// Migration map: old model IDs → current equivalents (April 2026 cleanup)
const MODEL_MIGRATIONS: Record<string, string> = {
  'claude-3-5-sonnet': 'claude-sonnet-4-6-20260217',
  'claude-3-opus': 'claude-opus-4-6-20260205',
  'claude-3-sonnet': 'claude-sonnet-4-6-20260217',
  'claude-3-haiku': 'claude-haiku-4-5-20251001',
  'claude-sonnet-4-20250514': 'claude-sonnet-4-6-20260217',
  'claude-opus-4-20250514': 'claude-opus-4-6-20260205',
  'claude-3-5-haiku-20241022': 'claude-haiku-4-5-20251001',
  'gpt-4o': 'gpt-4.1',
  'gpt-4o-mini': 'gpt-4.1-mini',
  'mistral-large': 'gpt-4.1',
  'llama-3-70b': 'gpt-4.1',
};

// Load settings from localStorage (with migration for stale model IDs)
export const loadSettings = (): AppSettings => {
  const savedSettings = localStorage.getItem('app_settings');
  if (savedSettings) {
    try {
      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) };

      // Migrate stale model IDs to current equivalents
      if (parsed.aiModel && MODEL_MIGRATIONS[parsed.aiModel]) {
        parsed.aiModel = MODEL_MIGRATIONS[parsed.aiModel];
        localStorage.setItem('app_settings', JSON.stringify(parsed));
      }

      // If the model ID doesn't match any known model, reset to default
      if (!AI_MODELS.some(m => m.id === parsed.aiModel)) {
        parsed.aiModel = DEFAULT_SETTINGS.aiModel;
        localStorage.setItem('app_settings', JSON.stringify(parsed));
      }

      return parsed;
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

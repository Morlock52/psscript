import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// Define theme type
type Theme = 'light' | 'dark';

// Define context type
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  isDark: boolean;
  isLight: boolean;
}

// Storage key constant
const THEME_STORAGE_KEY = 'psscript_theme';

// Create context with default values
const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  setTheme: () => {},
  isDark: false,
  isLight: true,
});

// Define props for ThemeProvider
interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

// Helper to get initial theme
const getInitialTheme = (defaultTheme: Theme): Theme => {
  // Check if we're in browser
  if (typeof window === 'undefined') {
    return defaultTheme;
  }

  // Try to get theme from localStorage
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return defaultTheme;
};

// Apply theme to document
const applyThemeToDocument = (theme: Theme) => {
  const root = document.documentElement;

  // Remove both classes first
  root.classList.remove('light', 'dark');

  // Add the current theme class
  root.classList.add(theme);

  // Update color-scheme meta
  root.style.colorScheme = theme;
};

// Create ThemeProvider component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'dark' // Default to dark for PSScript
}) => {
  // Initialize theme state
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme(defaultTheme));

  // Memoized toggle function
  const toggleTheme = useCallback(() => {
    setThemeState(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  }, []);

  // Memoized set theme function
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  // Computed values
  const isDark = theme === 'dark';
  const isLight = theme === 'light';

  // Update localStorage and document when theme changes (also runs on mount)
  useEffect(() => {
    // Save to localStorage
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    // Apply theme to document
    applyThemeToDocument(theme);

    // Clean up legacy storage keys (consolidate multiple implementations)
    localStorage.removeItem('color-theme');
    localStorage.removeItem('theme');
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't manually set a theme
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (!savedTheme) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    // Add listener
    mediaQuery.addEventListener('change', handleChange);

    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Provide theme context to children
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isDark, isLight }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Custom hook for using theme
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;

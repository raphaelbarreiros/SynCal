'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

type ThemeProviderValue = {
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setTheme: (preference: ThemePreference) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'syn-theme-preference';

const ThemeContext = createContext<ThemeProviderValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>('system');
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');
  const isMountedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const storedPreference = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;

    if (storedPreference === 'light' || storedPreference === 'dark' || storedPreference === 'system') {
      setThemeState(storedPreference);
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    isMountedRef.current = true;

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    if (!isMountedRef.current || typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    root.classList.toggle('dark', resolvedTheme === 'dark');
    root.dataset.theme = resolvedTheme;
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => {
    if (!isMountedRef.current || typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((preference: ThemePreference) => {
    setThemeState(preference);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const currentResolved = current === 'system' ? systemTheme : current;
      return currentResolved === 'dark' ? 'light' : 'dark';
    });
  }, [systemTheme]);

  const value = useMemo<ThemeProviderValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme
    }),
    [theme, resolvedTheme, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference(): ThemeProviderValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useThemePreference must be used within ThemeProvider');
  }

  return context;
}

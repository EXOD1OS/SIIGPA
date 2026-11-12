'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export const THEME_STORAGE_KEY = 'siigpa.theme';

/**
 * Tema por defecto cuando el usuario todavía no eligió uno.
 * Se mantiene oscuro mientras las vistas internas (Etapa 2+) sigan con colores fijos del tema anterior.
 */
export const DEFAULT_THEME: 'light' | 'dark' = 'dark';

/** Script inline para <head>: aplica `.dark` antes del primer pintado y evita el parpadeo de tema. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t?t==='dark':${DEFAULT_THEME === 'dark'};document.documentElement.classList.toggle('dark',d);}catch(e){document.documentElement.classList.toggle('dark',${DEFAULT_THEME === 'dark'});}})();`;

interface ThemeContextValue {
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(DEFAULT_THEME === 'dark');

  // Sincroniza el estado con la clase que dejó el script inicial.
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleTheme = useCallback(() => {
    const root = document.documentElement;
    const next = !root.classList.contains('dark');
    // Transición de colores solo durante el cambio de tema.
    root.classList.add('theme-transition');
    root.classList.toggle('dark', next);
    setIsDark(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      /* almacenamiento no disponible: la preferencia solo dura la sesión */
    }
    window.setTimeout(() => root.classList.remove('theme-transition'), 400);
  }, []);

  return <ThemeContext.Provider value={{ isDark, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>.');
  return ctx;
}

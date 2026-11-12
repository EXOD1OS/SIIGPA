import type { Config } from 'tailwindcss';

// Tokens del tema institucional (prototipo SIIGPA). Los valores viven como variables CSS en
// `src/app/globals.css` y cambian según la clase `.dark` en <html>.
// Nota: al ser variables sin canal alfa, los modificadores `/NN` no se generan para estos colores;
// usar `color-mix(in_srgb,var(--x)_NN%,transparent)` cuando haga falta transparencia.
const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--bg)',
        surface: 'var(--surface)',
        sidebar: 'var(--sidebar)',
        border: 'var(--border)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        soft: 'var(--soft)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
        },
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [],
};

export default config;

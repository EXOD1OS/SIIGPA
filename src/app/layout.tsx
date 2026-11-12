import type { Metadata } from 'next';
import './globals.css';
import { ReduxProvider } from '@/redux/provider';
import { AuthSessionProvider } from '@/components/AuthSessionProvider';
import { ThemeProvider, THEME_INIT_SCRIPT } from '@/components/theme/ThemeProvider';

export const metadata: Metadata = {
  title: 'SIIGPA | DACEFyN - UNLaR',
  description: 'Sistema Integral de Gestión de Planificaciones Académicas PAAC/PAAD - DACEFyN, UNLaR',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // La clase `dark` la decide el script inicial según localStorage; por eso se suprime el aviso de hidratación.
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-background text-ink antialiased">
        <ThemeProvider>
          <AuthSessionProvider>
            <ReduxProvider>{children}</ReduxProvider>
          </AuthSessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

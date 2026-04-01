import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './index.css';

import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeModeProvider, useThemeMode } from './contexts/ThemeContext';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppProviders: React.FC = () => {
  const { mode } = useThemeMode();

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'dark' ? '#ef4444' : '#dc2626',
            light: mode === 'dark' ? '#f87171' : '#ef4444',
            dark: mode === 'dark' ? '#dc2626' : '#b91c1c',
            contrastText: '#ffffff',
          },
          secondary: {
            main: mode === 'dark' ? '#fca5a5' : '#b91c1c',
            contrastText: '#ffffff',
          },
          error: {
            main: '#dc2626',
          },
          background: {
            default: mode === 'dark' ? '#1a1a1a' : '#ffffff',
            paper: mode === 'dark' ? '#242424' : '#ffffff',
          },
          text: {
            primary: mode === 'dark' ? '#fafaf9' : '#1c1917',
            secondary: mode === 'dark' ? '#a8a29e' : '#57534e',
          },
          divider: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.09)',
        },
        typography: {
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          fontWeightRegular: 400,
          fontWeightMedium: 500,
          fontWeightBold: 600,
          h1: { fontWeight: 700, letterSpacing: '-0.04em' },
          h2: { fontWeight: 600, letterSpacing: '-0.03em' },
          h3: { fontWeight: 600, letterSpacing: '-0.03em' },
          button: { textTransform: 'none', fontWeight: 500, letterSpacing: '-0.01em' },
        },
        shape: {
          borderRadius: 10,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
                boxShadow: 'none',
                '&:hover': { boxShadow: 'none' },
              },
              contained: {
                '&:hover': { boxShadow: 'none' },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
                border: mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.09)',
                borderRadius: 12,
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                boxShadow: '0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
                borderRadius: 12,
              },
            },
          },
          MuiTextField: {
            styleOverrides: {
              root: {
                '& .MuiOutlinedInput-root': {
                  borderRadius: 10,
                },
              },
            },
          },
          MuiChip: {
            styleOverrides: {
              root: { borderRadius: 6 },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <QueryClientProvider client={queryClient}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <App />
            <ToastContainer
              position="top-right"
              autoClose={5000}
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
            />
          </AuthProvider>
        </BrowserRouter>
      </MuiThemeProvider>
    </QueryClientProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeModeProvider>
      <AppProviders />
    </ThemeModeProvider>
  </React.StrictMode>
);

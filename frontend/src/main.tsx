import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App';
import 'leaflet/dist/leaflet.css';
import './styles.css';

const theme = createTheme({
  palette: {
    primary: { main: '#20715e' },
    background: { default: '#f5f7f6' },
    text: { primary: '#1a3028', secondary: '#68776f' },
  },
  typography: {
    fontFamily: '"DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { minHeight: 42 } },
    },
    MuiTextField: { defaultProps: { variant: 'outlined' } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: '#fff', fontSize: 14 } } },
    MuiAlert: { styleOverrides: { root: { fontSize: 13 } } },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);

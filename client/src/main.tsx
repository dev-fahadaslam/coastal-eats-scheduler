import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import { SocketProvider } from './context/SocketContext.js';
import { ToastProvider } from './context/ToastContext.js';
import { ModalProvider } from './context/ModalContext.js';
import { NotificationProvider } from './context/NotificationContext.js';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element.');

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <ModalProvider>
              <NotificationProvider>
                <App />
              </NotificationProvider>
            </ModalProvider>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import AcsLoader from './AcsLoader.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './styles.css';
import './campaigns.css';
import './app-shell.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AcsLoader />
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

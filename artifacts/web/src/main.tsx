import { createRoot } from 'react-dom/client';

import App from './App';

import './index.css';

import { installOfflineApi } from './lib/offline-api';
import { ProtectedBuildGate } from './components/protected-build-gate';

if (import.meta.env.VITE_OFFLINE_MODE === '1') {
  installOfflineApi();
}

const app = <App />;
createRoot(document.getElementById('root')!).render(
  import.meta.env.VITE_PROTECTED_BUILD === '1' ? <ProtectedBuildGate>{app}</ProtectedBuildGate> : app,
);

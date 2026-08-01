import { createRoot } from 'react-dom/client';
import App from './app/App';
import { useExplorerStore } from './state/ExplorerStore';
import './styles/index.css';

useExplorerStore.getState().loadSeedFromUrl();

createRoot(document.getElementById('root')!).render(<App />);

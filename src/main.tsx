import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { LiveGuestPage } from './components/LiveGuestPage';
import './index.css';

const invite = new URLSearchParams(window.location.search).get('invite');
createRoot(document.getElementById('root')!).render(invite ? <LiveGuestPage token={invite} /> : <App />);

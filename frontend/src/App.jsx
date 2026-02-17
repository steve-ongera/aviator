import { useState } from 'react';
import { AuthProvider, useAuth } from './store/AuthContext';
import AviatorGame from './components/AviatorGame';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import WalletPage from './pages/WalletPage';
import ProfilePage from './pages/ProfilePage';

// ─── Bottom Navigation ────────────────────────────────────────────────────────
function BottomNav({ page, setPage }) {
  const tabs = [
    { id: 'game', icon: '✈', label: 'GAME' },
    { id: 'wallet', icon: '💳', label: 'WALLET' },
    { id: 'profile', icon: '👤', label: 'PROFILE' },
  ];

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: '#13161f', borderTop: '1px solid #1e2230',
      display: 'flex', height: 56,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setPage(t.id)} style={{
          flex: 1, border: 'none', background: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 2, cursor: 'pointer',
          color: page === t.id ? '#1e90ff' : '#555',
          transition: 'color 0.2s',
          fontFamily: "'Rajdhani','Segoe UI',sans-serif",
        }}>
          <span style={{ fontSize: page === t.id ? 18 : 16, transition: 'font-size 0.2s' }}>{t.icon}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1,
            fontFamily: 'Orbitron, monospace',
          }}>{t.label}</span>
          {page === t.id && (
            <span style={{
              position: 'absolute', bottom: 0,
              width: 32, height: 2, background: '#1e90ff', borderRadius: 2
            }} />
          )}
        </button>
      ))}
    </nav>
  );
}

// ─── Protected App Shell ──────────────────────────────────────────────────────
function AppShell() {
  const { user, loading } = useAuth();
  const [authPage, setAuthPage] = useState('login');
  const [page, setPage] = useState('game');

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0d0f14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
        fontFamily: 'Orbitron, monospace',
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');`}</style>
        <div style={{ fontFamily: 'Orbitron', fontSize: 28, fontWeight: 900, color: '#00d2ff', letterSpacing: 4 }}>
          ✈ AVIATOR
        </div>
        <div style={{
          width: 40, height: 40, border: '3px solid #1e2230',
          borderTopColor: '#00d2ff', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  if (!user) {
    return authPage === 'login'
      ? <LoginPage onSwitch={() => setAuthPage('register')} />
      : <RegisterPage onSwitch={() => setAuthPage('login')} />;
  }

  return (
    <div style={{ paddingBottom: 56 }}>
      {page === 'game' && <AviatorGame />}
      {page === 'wallet' && <WalletPage />}
      {page === 'profile' && <ProfilePage />}
      <BottomNav page={page} setPage={setPage} />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
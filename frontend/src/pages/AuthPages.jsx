import { useState } from 'react';
import { useAuth } from '../store/AuthContext';

const inputStyle = {
  width: '100%',
  background: '#1a1d26',
  border: '1px solid #2a2d3a',
  borderRadius: 10,
  padding: '13px 16px',
  color: '#e0e0e0',
  fontSize: 15,
  fontFamily: 'inherit',
  transition: 'border-color 0.2s',
};

const labelStyle = { fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: 1, marginBottom: 6 };

export function LoginPage({ onSwitch }) {
  const { login } = useAuth();
  const [form, setForm] = useState({ phone_number: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.phone_number, form.password);
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Welcome Back" subtitle="Log in to your Aviator account">
      <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={labelStyle}>PHONE NUMBER</div>
          <input
            style={inputStyle}
            placeholder="+254712345678"
            value={form.phone_number}
            onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))}
            required
          />
        </div>
        <div>
          <div style={labelStyle}>PASSWORD</div>
          <input
            style={inputStyle}
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            required
          />
        </div>

        {error && (
          <div style={{ background: '#ff475722', border: '1px solid #ff475740', borderRadius: 8, padding: '10px 14px', color: '#ff4757', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            background: loading ? '#1e2230' : 'linear-gradient(135deg, #1e90ff, #0052d4)',
            border: 'none', borderRadius: 10, padding: '14px',
            color: '#fff', fontSize: 16, fontWeight: 700,
            fontFamily: 'Orbitron, monospace', cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: 1, boxShadow: loading ? 'none' : '0 4px 20px rgba(30,144,255,0.3)',
            transition: 'all 0.2s'
          }}>
          {loading ? 'LOGGING IN...' : '✈ LOG IN'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#666' }}>
          Don't have an account?{' '}
          <span style={{ color: '#1e90ff', cursor: 'pointer', fontWeight: 600 }} onClick={onSwitch}>
            Register
          </span>
        </div>
      </form>
    </AuthLayout>
  );
}

export function RegisterPage({ onSwitch }) {
  const { register } = useAuth();
  const [form, setForm] = useState({ phone_number: '', full_name: '', password: '', confirm_password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      await register(form.phone_number, form.password, form.confirm_password, form.full_name);
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.phone_number?.[0] || data?.password?.[0] || data?.confirm_password?.[0] || data?.message || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Create Account" subtitle="Join Aviator — get KES 50 welcome bonus!">
      <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <div style={labelStyle}>PHONE NUMBER</div>
          <input style={inputStyle} placeholder="+254712345678" value={form.phone_number}
            onChange={e => setForm(p => ({ ...p, phone_number: e.target.value }))} required />
        </div>
        <div>
          <div style={labelStyle}>FULL NAME (optional)</div>
          <input style={inputStyle} placeholder="John Doe" value={form.full_name}
            onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
        </div>
        <div>
          <div style={labelStyle}>PASSWORD</div>
          <input style={inputStyle} type="password" placeholder="Min. 6 characters" value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))} required />
        </div>
        <div>
          <div style={labelStyle}>CONFIRM PASSWORD</div>
          <input style={inputStyle} type="password" placeholder="••••••••" value={form.confirm_password}
            onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))} required />
        </div>

        {error && (
          <div style={{ background: '#ff475722', border: '1px solid #ff475740', borderRadius: 8, padding: '10px 14px', color: '#ff4757', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{
          background: '#2ed57311', border: '1px solid #2ed57330',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2ed573'
        }}>
          🎁 You'll receive a KES 50 welcome bonus on registration!
        </div>

        <button type="submit" disabled={loading} style={{
          background: loading ? '#1e2230' : 'linear-gradient(135deg, #2ed573, #1abc9c)',
          border: 'none', borderRadius: 10, padding: '14px',
          color: '#fff', fontSize: 16, fontWeight: 700,
          fontFamily: 'Orbitron, monospace', cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: 1, boxShadow: loading ? 'none' : '0 4px 20px rgba(46,213,115,0.3)',
          transition: 'all 0.2s'
        }}>
          {loading ? 'CREATING...' : '🚀 CREATE ACCOUNT'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#666' }}>
          Already have an account?{' '}
          <span style={{ color: '#1e90ff', cursor: 'pointer', fontWeight: 600 }} onClick={onSwitch}>
            Log In
          </span>
        </div>
      </form>
    </AuthLayout>
  );
}

function AuthLayout({ title, subtitle, children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0f14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: #1e90ff !important; outline: none; }
      `}</style>

      {/* Background effect */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse at 30% 50%, #00d2ff0d 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, #0052d40d 0%, transparent 50%)'
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            fontFamily: 'Orbitron, monospace', fontSize: 32, fontWeight: 900,
            color: '#00d2ff', letterSpacing: 4,
            textShadow: '0 0 40px #00d2ff66'
          }}>
            ✈ AVIATOR
          </div>
          <div style={{ color: '#555', fontSize: 12, marginTop: 4, letterSpacing: 2 }}>
            FLY HIGH · WIN BIG
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: '#13161f',
          border: '1px solid #1e2230',
          borderRadius: 16,
          padding: '32px 28px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#e0e0e0', marginBottom: 4 }}>{title}</h2>
          <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
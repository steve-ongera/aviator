import { useState, useEffect, useRef, useCallback } from 'react';
import { gameAPI } from '../api/api';
import { useAuth } from '../store/AuthContext';
import planePng from '../assets/plane.svg';

function HistoryBadge({ value }) {
  const getColor = (v) => {
    if (v < 2)  return { bg: '#c0392b', text: '#fff' };
    if (v < 5)  return { bg: '#e67e22', text: '#fff' };
    if (v < 10) return { bg: '#27ae60', text: '#fff' };
    return           { bg: '#2980b9', text: '#fff' };
  };
  const c = getColor(value);
  return (
    <span style={{
      background: c.bg, color: c.text, borderRadius: 3,
      padding: '2px 5px', fontSize: 10, fontWeight: 600,
      whiteSpace: 'nowrap', flexShrink: 0, lineHeight: 1.4,
    }}>
      {value.toFixed(2)}x
    </span>
  );
}

function HistoryDropdown({ history }) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const getColor = (v) => {
    if (v < 2)  return '#c0392b';
    if (v < 5)  return '#e67e22';
    if (v < 10) return '#27ae60';
    return           '#2980b9';
  };

  return (
    <div ref={dropRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          background: open ? '#2a3550' : '#1e2d45',
          border: '1px solid #2a3550', borderRadius: 4,
          color: '#8899aa', fontSize: 10, fontWeight: 600,
          padding: '3px 7px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
        }}
      >
        History {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 500,
          marginTop: 4, background: '#1a2035', border: '1px solid #2a3550',
          borderRadius: 8, padding: '10px 12px', width: 260,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', maxHeight: 280, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7f99', marginBottom: 8, letterSpacing: 0.5 }}>
            ROUND HISTORY ({history.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {history.map((r, i) => {
              const v = parseFloat(r.multiplier) || 1;
              return (
                <span key={i} style={{
                  background: getColor(v), color: '#fff',
                  borderRadius: 4, padding: '4px 8px', fontSize: 12, fontWeight: 600,
                }}>
                  {v.toFixed(2)}x
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FireEffect({ size = 40 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.4 }}>
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: size, height: size * 1.2,
        background: 'radial-gradient(ellipse at 50% 80%, #ff6b00 0%, #ff4400 40%, transparent 80%)',
        borderRadius: '50% 50% 30% 30%',
        animation: 'fire1 0.15s ease-in-out infinite',
        transformOrigin: 'bottom center', filter: 'blur(2px)',
      }}/>
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: size * 0.65, height: size,
        background: 'radial-gradient(ellipse at 50% 80%, #ffd32a 0%, #ff6b00 50%, transparent 85%)',
        borderRadius: '50% 50% 30% 30%',
        animation: 'fire2 0.12s ease-in-out infinite',
        transformOrigin: 'bottom center', filter: 'blur(1px)',
      }}/>
      <div style={{
        position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
        width: size * 0.35, height: size * 0.55,
        background: 'radial-gradient(ellipse at 50% 80%, #fff 0%, #ffd32a 60%, transparent 90%)',
        borderRadius: '50% 50% 30% 30%',
        animation: 'fire3 0.1s ease-in-out infinite',
        transformOrigin: 'bottom center',
      }}/>
    </div>
  );
}

function Plane({ crashed, flying }) {
  return (
    <div style={{
      position: 'relative', display: 'inline-flex', alignItems: 'flex-end',
      filter: crashed
        ? 'drop-shadow(0 0 6px #ef4444)'
        : 'drop-shadow(0 0 8px rgba(255,140,50,0.9))',
      transform: crashed ? 'rotate(30deg)' : 'rotate(-8deg)',
      transition: 'transform 0.3s ease',
    }}>
      {!crashed && (
        <div style={{
          position: 'absolute', right: '100%', bottom: 4, marginRight: -6,
          display: 'flex', alignItems: 'flex-end', gap: 2,
        }}>
          <FireEffect size={flying ? 38 : 26} />
          {flying && <FireEffect size={28} />}
        </div>
      )}
      <img src={planePng} alt="plane" style={{ width: 64, height: 'auto', display: 'block', objectFit: 'contain' }} />
    </div>
  );
}

// Clean canvas — background + grid + ambient glow only. No curve line, no axis labels.
function GameCanvas({ status, planeX, planeY }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const p = canvas.parentElement;
      if (p) { canvas.width = p.clientWidth; canvas.height = p.clientHeight; }
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#1a2035';
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let x = 0; x < W; x += 70) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      if (status === 'flying' || status === 'crashed') {
        const px = planeX * W;
        const py = planeY * H;
        const color = status === 'crashed' ? 'rgba(239,68,68,0.13)' : 'rgba(232,136,74,0.11)';
        const grad = ctx.createRadialGradient(px, py, 0, px, py, 130);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }
    };

    const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
    loop();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animRef.current);
    };
  }, [status, planeX, planeY]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

export default function AviatorGame() {
  const { user, refreshBalance } = useAuth();

  const [screenW, setScreenW] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setScreenW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = screenW < 640;
  const isTablet = screenW >= 640 && screenW < 1024;
  const isSmall  = screenW < 1024; // mobile + tablet → show bet panel inline, hide sidebar

  // Plane animated position
  const planeAnimRef   = useRef(null);
  const planeFrameRef  = useRef(0);
  const [planePos, setPlanePos]       = useState({ x: 0.08, y: 0.82 });
  const [planeVisible, setPlaneVisible] = useState(true);

  const [round, setRound]           = useState(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [status, setStatus]         = useState('waiting');
  const [history, setHistory]       = useState([]);
  const [allBets, setAllBets]       = useState([]);
  const [userBet, setUserBet]       = useState(null);
  const [messages, setMessages]     = useState([]);
  const [hasCashedOut, setHasCashedOut] = useState(false);

  const [betAmount, setBetAmount]           = useState('');
  const [autoCashout, setAutoCashout]       = useState('');
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [chatInput, setChatInput]           = useState('');

  const [isBetting, setIsBetting]       = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab]       = useState('bets');

  const pollRef       = useRef(null);
  const chatRef       = useRef(null);
  const prevStatusRef = useRef('waiting');

  // Plane movement logic
  const startPlaneAnim = useCallback(() => {
    cancelAnimationFrame(planeAnimRef.current);
    planeFrameRef.current = 0;
    setPlaneVisible(true);
    const animate = () => {
      planeFrameRef.current++;
      const t = planeFrameRef.current;
      const xP = Math.min(t / 480, 1);
      const yP = Math.min(t / 480, 1);
      const ease = 1 - Math.pow(1 - yP, 2.5);
      setPlanePos({ x: 0.08 + xP * 0.60, y: 0.82 - ease * 0.66 });
      planeAnimRef.current = requestAnimationFrame(animate);
    };
    planeAnimRef.current = requestAnimationFrame(animate);
  }, []);

  const stopPlaneAnim = useCallback(() => cancelAnimationFrame(planeAnimRef.current), []);

  const resetPlane = useCallback(() => {
    cancelAnimationFrame(planeAnimRef.current);
    setPlanePos({ x: 0.08, y: 0.82 });
    setPlaneVisible(true);
  }, []);

  useEffect(() => {
    if (prevStatusRef.current !== status) {
      if (status === 'flying')       startPlaneAnim();
      else if (status === 'crashed') stopPlaneAnim();
      else if (status === 'waiting') { resetPlane(); setHasCashedOut(false); }
      prevStatusRef.current = status;
    }
  }, [status, startPlaneAnim, stopPlaneAnim, resetPlane]);

  const notify = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchHistory = useCallback(async () => {
    try { const res = await gameAPI.getHistory(50); setHistory(res.data.history || []); } catch {}
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const { chatAPI } = await import('../api/api');
      const res = await chatAPI.messages(40);
      setMessages(res.data.messages || []);
    } catch {}
  }, []);

  const pollRound = useCallback(async () => {
    try {
      const res = await gameAPI.getCurrent();
      const data = res.data;
      if (data.round) {
        const r = data.round;
        setRound(r); setMultiplier(r.multiplier || 1.0);
        setStatus(r.status); setAllBets(data.bets || []);
        if (data.user_bet) {
          setUserBet(data.user_bet);
        } else {
          setUserBet(prev => {
            if (prev && r.status === 'crashed') { refreshBalance(); return null; }
            return prev;
          });
        }
        if (r.status === 'crashed') fetchHistory();
      } else {
        setRound(null); setStatus('waiting'); setMultiplier(1.0); setAllBets([]);
      }
    } catch {}
  }, [fetchHistory, refreshBalance]);

  useEffect(() => {
    fetchHistory(); fetchMessages();
    pollRef.current = setInterval(pollRound, 300);
    return () => clearInterval(pollRef.current);
  }, [pollRound, fetchHistory, fetchMessages]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const adjustAmount = (delta) =>
    setBetAmount(String(Math.max(10, (parseFloat(betAmount) || 0) + delta)));

  const handleBet = async () => {
    const amount = parseFloat(betAmount);
    if (!amount || amount < 10) { notify('Minimum bet is KES 10', 'error'); return; }
    if (userBet)                { notify('You already have a bet this round', 'error'); return; }
    if (status !== 'waiting')   { notify('Wait for the next round to bet', 'error'); return; }
    setIsBetting(true);
    try {
      const res = await gameAPI.placeBet({
        amount,
        auto_cashout: autoCashoutEnabled && autoCashout ? parseFloat(autoCashout) : null
      });
      setUserBet(res.data.bet); refreshBalance();
      notify(`Bet of KES ${amount} placed!`, 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to place bet', 'error');
    } finally { setIsBetting(false); }
  };

  const handleCashout = async () => {
    if (!userBet)            { notify('No active bet', 'error'); return; }
    if (status !== 'flying') { notify('Cannot cashout right now', 'error'); return; }
    setIsCashingOut(true);
    try {
      const res = await gameAPI.cashout({ bet_id: userBet.id, multiplier });
      setUserBet(null); setHasCashedOut(true); refreshBalance();
      notify(`Cashed out at ${res.data.multiplier}x! Won KES ${res.data.payout.toFixed(2)}`, 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Cashout failed', 'error');
    } finally { setIsCashingOut(false); }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    try {
      const { chatAPI } = await import('../api/api');
      const res = await chatAPI.send(chatInput.trim());
      setMessages(prev => [...prev, res.data.message]);
      setChatInput('');
    } catch {}
  };

  const quickAmounts = [50, 100, 500, '1K'];
  const quickValues  = [50, 100, 500, 1000];
  const canBet      = status === 'waiting' && !userBet && !isBetting;
  const canCashout  = status === 'flying' && userBet &&
    (userBet.status === 'active' || userBet.status === 'pending') && !isCashingOut;

  const multColor = status === 'crashed' ? '#ef4444'
    : status === 'flying'
      ? (multiplier < 2 ? '#e8884a' : multiplier < 5 ? '#f0c030' : '#4ade80')
      : '#8899aa';

  const canvasHeight = isMobile ? 230 : isTablet ? 310 : 420;

  // ── Shared Bet Panel ─────────────────────────────────────────────────────
  const BetPanel = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        paddingBottom: 13, borderBottom: '1px solid #2a3550'
      }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%', background: '#2a3550',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: '#8899aa'
        }}>$</span>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#e0e8f0' }}>Place Bet</span>
      </div>

      <div style={{ fontSize: 13, color: '#8899aa' }}>Amount (KES)</div>

      <div style={{
        display: 'flex', alignItems: 'center',
        background: '#111827', border: '1px solid #2a3550', borderRadius: 6, overflow: 'hidden'
      }}>
        <button onClick={() => adjustAmount(-100)} style={{
          width: 44, height: 44, background: '#1e2a3a', border: 'none',
          color: '#e0e8f0', fontSize: 22, cursor: 'pointer',
          borderRight: '1px solid #2a3550', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>−</button>
        <input
          type="number" value={betAmount}
          onChange={e => setBetAmount(e.target.value)}
          placeholder="10000"
          style={{
            flex: 1, background: 'transparent', border: 'none',
            color: '#e0e8f0', fontSize: 17, fontWeight: 600,
            textAlign: 'center', outline: 'none', padding: '0 8px', height: 44,
          }}
        />
        <button onClick={() => adjustAmount(100)} style={{
          width: 44, height: 44, background: '#1e2a3a', border: 'none',
          color: '#e0e8f0', fontSize: 22, cursor: 'pointer',
          borderLeft: '1px solid #2a3550', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>+</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {quickAmounts.map((label, i) => (
          <button key={i} onClick={() => setBetAmount(String(quickValues[i]))} style={{
            padding: '9px 0',
            background: betAmount === String(quickValues[i]) ? '#2563eb' : '#1e2a3a',
            border: `1px solid ${betAmount === String(quickValues[i]) ? '#3b82f6' : '#2a3550'}`,
            borderRadius: 5, color: '#e0e8f0', fontSize: 13,
            fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s'
          }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#111827', border: '1px solid #2a3550',
        borderRadius: 6, padding: '10px 12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={() => setAutoCashoutEnabled(p => !p)}
            style={{
              width: 16, height: 16, borderRadius: 3,
              border: `2px solid ${autoCashoutEnabled ? '#3b82f6' : '#4a5568'}`,
              background: autoCashoutEnabled ? '#3b82f6' : 'transparent',
              cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            {autoCashoutEnabled && <span style={{ color: '#fff', fontSize: 10, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontSize: 13, color: '#8899aa' }}>Auto cashout at</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number" value={autoCashout}
            onChange={e => setAutoCashout(e.target.value)}
            disabled={!autoCashoutEnabled} placeholder="20"
            style={{
              width: 64, background: '#1e2a3a', border: '1px solid #2a3550', borderRadius: 4,
              padding: '6px 8px', color: autoCashoutEnabled ? '#e0e8f0' : '#4a5568',
              fontSize: 14, textAlign: 'right', outline: 'none'
            }}
          />
          <span style={{ color: '#8899aa', fontSize: 14 }}>x</span>
        </div>
      </div>

      {canCashout ? (
        <button onClick={handleCashout} disabled={isCashingOut} style={{
          width: '100%', padding: '14px', borderRadius: 7, border: 'none',
          background: isCashingOut ? '#1e3a2a' : 'linear-gradient(135deg, #16a34a, #15803d)',
          color: '#fff', fontSize: 15, fontWeight: 700,
          cursor: isCashingOut ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: isCashingOut ? 'none' : '0 2px 12px rgba(22,163,74,0.35)',
          transition: 'all 0.15s'
        }}>
          {isCashingOut ? 'CASHING OUT...' : `CASHOUT ${multiplier.toFixed(2)}x`}
        </button>
      ) : (
        <button onClick={handleBet} disabled={!canBet} style={{
          width: '100%', padding: '14px', borderRadius: 7, border: 'none',
          background: canBet ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : '#1e2a3a',
          color: canBet ? '#fff' : '#4a5568', fontSize: 15, fontWeight: 700,
          cursor: canBet ? 'pointer' : 'not-allowed',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: canBet ? '0 2px 12px rgba(37,99,235,0.35)' : 'none',
          transition: 'all 0.15s'
        }}>
          {isBetting ? 'PLACING BET...' : userBet ? '✓ BET PLACED' : (
            <><span style={{ fontSize: 16 }}>✓</span> PLACE BET</>
          )}
        </button>
      )}

      <div style={{
        background: '#111827', border: '1px solid #2a3550',
        borderRadius: 8, overflow: 'hidden'
      }}>
        <div style={{
          padding: '12px 14px', borderBottom: '1px solid #2a3550',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span style={{ fontSize: 14, color: '#8899aa' }}>👥</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#e0e8f0' }}>Active Bets</span>
        </div>
        <div style={{ padding: '12px 14px' }}>
          {userBet ? (
            <div style={{
              background: '#1e2a3a', borderRadius: 6, padding: '10px 12px',
              border: '1px solid #2a3550'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: '#8899aa', fontSize: 13 }}>
                  KES {parseFloat(userBet.amount).toFixed(2)}
                </span>
                <span style={{ color: '#3b82f6', fontSize: 13, fontWeight: 600 }}>
                  @{multiplier.toFixed(2)}x
                </span>
              </div>
              {userBet.auto_cashout && (
                <div style={{ color: '#6b7280', fontSize: 12 }}>
                  Auto cashout @{parseFloat(userBet.auto_cashout).toFixed(2)}x
                </div>
              )}
              {!hasCashedOut && (
                <div style={{ color: '#16a34a', fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                  Potential: KES {(parseFloat(userBet.amount) * multiplier).toFixed(2)}
                </div>
              )}
              {hasCashedOut && (
                <div style={{ color: '#4ade80', fontSize: 13, marginTop: 4, fontWeight: 600 }}>
                  ✓ Cashed out — waiting for next round
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#4a5568', fontSize: 14, textAlign: 'center', padding: '8px 0' }}>
              No active bets
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh', background: '#0f1623', color: '#e0e8f0',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f1623; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #1a2035; }
        ::-webkit-scrollbar-thumb { background: #2a3550; border-radius: 2px; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        button { font-family: inherit; }
        @keyframes fire1 {
          0%,100%{transform:scaleX(1) scaleY(1);opacity:0.9}
          25%{transform:scaleX(1.3) scaleY(0.85);opacity:1}
          50%{transform:scaleX(0.8) scaleY(1.2);opacity:0.85}
          75%{transform:scaleX(1.15) scaleY(0.9);opacity:1}
        }
        @keyframes fire2 {
          0%,100%{transform:scaleX(0.9) scaleY(1.1);opacity:0.7}
          33%{transform:scaleX(1.2) scaleY(0.8);opacity:0.9}
          66%{transform:scaleX(0.75) scaleY(1.25);opacity:0.75}
        }
        @keyframes fire3 {
          0%,100%{transform:scaleX(1.1) scaleY(0.9);opacity:0.5}
          50%{transform:scaleX(0.85) scaleY(1.15);opacity:0.8}
        }
        @keyframes pulse-mult { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.85;transform:scale(0.97)} }
        @keyframes crash-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-4px)} 40%{transform:translateX(4px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        background: '#0f1623', borderBottom: '1px solid #1e2d45',
        height: 56, display: 'flex', alignItems: 'center',
        padding: '0 16px', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="28" height="18" viewBox="0 0 28 18">
              <path d="M2 12 L16 2 L24 8 L10 14 Z" fill="#e8884a"/>
              <path d="M10 14 L24 8 L26 13 L14 15 Z" fill="#c96f2e" opacity="0.8"/>
              <path d="M2 12 L10 14 L9 17 Z" fill="#c96f2e" opacity="0.7"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 18, color: '#e8884a', letterSpacing: 0.3 }}>
              Avi<span style={{ color: '#e0e8f0' }}>ator</span>
            </span>
          </div>
          {/* Full nav labels on desktop only */}
          {!isSmall && (
            <div style={{ display: 'flex', gap: 4 }}>
              {[
                { label: 'Play', icon: '🎮' },
                { label: 'Bets', icon: '📋' },
                { label: 'Transactions', icon: '💳' },
                { label: 'Profile', icon: '👤' },
              ].map((item, i) => (
                <span key={item.label} style={{
                  color: i === 0 ? '#e0e8f0' : '#6b7f99',
                  fontSize: 14, fontWeight: i === 0 ? 600 : 400,
                  cursor: 'pointer', padding: '6px 12px', borderRadius: 5,
                  background: i === 0 ? '#1e2d45' : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {item.icon} {item.label}
                </span>
              ))}
            </div>
          )}
          {/* Icon-only nav on tablet */}
          {isTablet && (
            <div style={{ display: 'flex', gap: 2 }}>
              {['🎮', '📋', '💳', '👤'].map((icon, i) => (
                <span key={i} style={{
                  color: i === 0 ? '#e0e8f0' : '#6b7f99',
                  fontSize: 18, cursor: 'pointer',
                  padding: '6px 10px', borderRadius: 5,
                  background: i === 0 ? '#1e2d45' : 'transparent',
                }}>
                  {icon}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
          {user && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!isMobile && (
                  <span style={{ fontSize: 11, color: '#6b7f99', fontWeight: 600, letterSpacing: 1 }}>BALANCE</span>
                )}
                <span style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, color: '#e0e8f0' }}>
                  {parseFloat(user.total_balance || 0).toFixed(2)}
                </span>
              </div>
              <button style={{
                background: 'linear-gradient(135deg, #f97316, #ea580c)',
                border: 'none', borderRadius: 6,
                padding: isMobile ? '7px 12px' : '8px 18px',
                color: '#fff', fontSize: isMobile ? 12 : 14, fontWeight: 600,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: '0 2px 10px rgba(249,115,22,0.35)', whiteSpace: 'nowrap',
              }}>
                <span>+</span> {isMobile ? 'Dep' : 'Deposit'}
              </button>
            </>
          )}
          <button style={{
            background: 'none', border: '1px solid #1e2d45', borderRadius: 5,
            padding: '7px 10px', color: '#6b7f99', cursor: 'pointer', fontSize: 14
          }}>⇥</button>
        </div>
      </nav>

      {/* ── NOTIFICATION ── */}
      {notification && (
        <div style={{
          position: 'fixed', top: 64, left: '50%', transform: 'translateX(-50%)',
          background: notification.type === 'success' ? '#16a34a'
            : notification.type === 'error' ? '#dc2626' : '#2563eb',
          color: '#fff', padding: '10px 20px', borderRadius: 7,
          fontSize: 14, fontWeight: 500, zIndex: 1100,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'fadeSlide 0.2s ease', whiteSpace: 'nowrap',
          maxWidth: 'calc(100vw - 32px)', textAlign: 'center',
        }}>
          {notification.msg}
        </div>
      )}

      {/* ── HISTORY BAR ── */}
      <div style={{
        background: '#0f1623', borderBottom: '1px solid #1e2d45',
        padding: '0 16px', display: 'flex', alignItems: 'stretch',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '8px 12px 8px 0',
          borderRight: '1px solid #1e2d45', marginRight: 10, flexShrink: 0
        }}>
          <div style={{
            background: '#1e2d45', borderRadius: 6, padding: '5px 10px',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1
          }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
              color: status === 'flying' ? '#4ade80' : status === 'crashed' ? '#ef4444' : '#f59e0b',
            }}>
              {status === 'flying' ? 'FLYING!' : status === 'crashed' ? 'CRASHED' : 'WAITING'}
            </span>
            <span style={{ fontSize: 10, color: '#6b7f99' }}>#{round?.round_number || '—'}</span>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          overflowX: 'auto', padding: '8px 0', flex: 1, minWidth: 0,
        }}>
          {history.slice(0, isMobile ? 5 : isTablet ? 8 : 12).map((r, i) => (
            <HistoryBadge key={i} value={parseFloat(r.multiplier) || 1} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0 8px 8px', flexShrink: 0 }}>
          <HistoryDropdown history={history} />
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: isMobile ? '10px 10px 24px' : isTablet ? '14px 14px 24px' : '20px 24px',
        display: 'grid',
        // Desktop: canvas left + sidebar right. Small screens: single column.
        gridTemplateColumns: isSmall ? '1fr' : '1fr 340px',
        gap: 20, alignItems: 'start',
      }}>

        {/* ── LEFT / MAIN COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Game canvas */}
          <div style={{
            background: '#1a2035', border: '1px solid #1e2d45',
            borderRadius: 10, overflow: 'hidden',
            position: 'relative', height: canvasHeight,
          }}>
            <GameCanvas status={status} planeX={planePos.x} planeY={planePos.y} />

            {/* Multiplier overlay */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center', pointerEvents: 'none', zIndex: 5,
            }}>
              {status === 'waiting' && (
                <div style={{ color: '#6b7f99', fontSize: isMobile ? 13 : 15 }}>
                  Waiting for next round...
                </div>
              )}
              {status === 'flying' && (
                <div style={{
                  fontSize: isMobile ? 44 : isTablet ? 58 : 72,
                  fontWeight: 800, color: multColor,
                  textShadow: `0 0 40px ${multColor}99`,
                  letterSpacing: -1, lineHeight: 1,
                  animation: 'pulse-mult 1.5s ease infinite'
                }}>
                  {multiplier.toFixed(2)}x
                </div>
              )}
              {status === 'crashed' && (
                <div style={{ animation: 'crash-shake 0.35s ease' }}>
                  <div style={{
                    fontSize: isMobile ? 44 : isTablet ? 58 : 72,
                    fontWeight: 800, color: '#ef4444',
                    textShadow: '0 0 40px rgba(239,68,68,0.6)',
                    lineHeight: 1, letterSpacing: -1
                  }}>
                    {multiplier.toFixed(2)}x
                  </div>
                  <div style={{
                    fontSize: isMobile ? 11 : 14, color: '#ef4444', marginTop: 6,
                    fontWeight: 600, letterSpacing: 2, opacity: 0.8
                  }}>
                    FLEW AWAY
                  </div>
                </div>
              )}
            </div>

            {/* Animated plane */}
            {planeVisible && (
              <div style={{
                position: 'absolute',
                left: `${planePos.x * 100}%`,
                top: `${planePos.y * 100}%`,
                transform: 'translate(-30%, -50%)',
                zIndex: 10,
              }}>
                <Plane crashed={status === 'crashed'} flying={status === 'flying'} />
              </div>
            )}
          </div>

          {/* ── Bet Panel — INLINE only on mobile & tablet (< 1024px) ── */}
          {isSmall && (
            <div style={{
              background: '#1a2035', border: '1px solid #1e2d45',
              borderRadius: 10, padding: isMobile ? '14px' : '18px',
            }}>
              <BetPanel />
            </div>
          )}

          {/* ── Tabs ── */}
          <div style={{
            background: '#1a2035', border: '1px solid #1e2d45',
            borderRadius: 10, overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #1e2d45' }}>
              {[
                { id: 'bets', label: `Live Bets (${allBets.length})` },
                { id: 'chat', label: '💬 Chat' }
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                  flex: 1, padding: '12px',
                  background: activeTab === tab.id ? '#111827' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                  color: activeTab === tab.id ? '#e0e8f0' : '#6b7f99',
                  fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'bets' && (
              <div style={{ overflowY: 'auto', maxHeight: 200, padding: '4px 0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#1a2035' }}>
                    <tr>
                      <th style={{ textAlign: 'left', color: '#6b7f99', fontWeight: 500, padding: '8px 16px', fontSize: 12 }}>Player</th>
                      <th style={{ textAlign: 'right', color: '#6b7f99', fontWeight: 500, padding: '8px 12px', fontSize: 12 }}>Bet</th>
                      <th style={{ textAlign: 'right', color: '#6b7f99', fontWeight: 500, padding: '8px 16px', fontSize: 12 }}>Cashout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBets.length === 0 ? (
                      <tr><td colSpan={3} style={{ textAlign: 'center', color: '#4a5568', padding: '20px', fontSize: 13 }}>No bets yet</td></tr>
                    ) : allBets.slice(0, 20).map(b => (
                      <tr key={b.id} style={{ borderTop: '1px solid #1e2d45' }}>
                        <td style={{ padding: '9px 16px', color: '#c8d5e8', fontSize: 13 }}>{b.username}</td>
                        <td style={{ textAlign: 'right', padding: '9px 12px', color: '#c8d5e8', fontSize: 13 }}>
                          {parseFloat(b.amount).toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', padding: '9px 16px' }}>
                          {b.cashout_multiplier ? (
                            <span style={{ color: '#4ade80', fontSize: 13, fontWeight: 600 }}>
                              {parseFloat(b.cashout_multiplier).toFixed(2)}x
                            </span>
                          ) : (
                            <span style={{ color: '#4a5568', fontSize: 13 }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: 200 }}>
                <div ref={chatRef} style={{
                  flex: 1, overflowY: 'auto', padding: '10px 14px',
                  display: 'flex', flexDirection: 'column', gap: 6
                }}>
                  {messages.map(m => (
                    <div key={m.id} style={{ fontSize: 13 }}>
                      {m.is_system ? (
                        <div style={{ color: '#f59e0b', textAlign: 'center', fontSize: 12, opacity: 0.8 }}>
                          {m.message}
                        </div>
                      ) : (
                        <div>
                          <span style={{ color: '#3b82f6', fontWeight: 600, marginRight: 6 }}>{m.username}</span>
                          <span style={{ color: '#8899aa' }}>{m.message}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendChat} style={{
                  display: 'flex', gap: 8, padding: '8px 12px',
                  borderTop: '1px solid #1e2d45'
                }}>
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                    placeholder="Type a message..." maxLength={200}
                    style={{
                      flex: 1, background: '#111827', border: '1px solid #2a3550',
                      borderRadius: 5, padding: '7px 10px', color: '#e0e8f0',
                      fontSize: 13, outline: 'none'
                    }} />
                  <button type="submit" style={{
                    background: '#2563eb', border: 'none', borderRadius: 5,
                    padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: 13
                  }}>→</button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN — Sidebar (desktop ≥ 1024px only) ── */}
        {!isSmall && (
          <div style={{
            background: '#1a2035', border: '1px solid #1e2d45',
            borderRadius: 10, padding: '20px',
            position: 'sticky', top: 72,
          }}>
            <BetPanel />
          </div>
        )}
      </div>
    </div>
  );
}


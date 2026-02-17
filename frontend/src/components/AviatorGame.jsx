import { useState, useEffect, useRef, useCallback } from 'react';
import { gameAPI } from '../api/api';
import { useAuth } from '../store/AuthContext';

// ─── Multiplier color helper ──────────────────────────────────────────────────
const getMultiplierColor = (m) => {
  if (m < 1.5) return '#ff4757';
  if (m < 2) return '#ffa502';
  if (m < 5) return '#2ed573';
  if (m < 10) return '#1e90ff';
  return '#a29bfe';
};

// ─── History badge ────────────────────────────────────────────────────────────
function HistoryBadge({ value }) {
  const color = getMultiplierColor(value);
  return (
    <span style={{
      background: color + '22', border: `1px solid ${color}`,
      color, borderRadius: 6, padding: '2px 8px',
      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap'
    }}>
      {value.toFixed(2)}x
    </span>
  );
}

// ─── Plane SVG ────────────────────────────────────────────────────────────────
function Plane({ crashed }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" style={{
      filter: crashed ? 'drop-shadow(0 0 8px #ff4757)' : 'drop-shadow(0 0 12px #00d2ff)',
      transform: crashed ? 'rotate(30deg)' : 'rotate(-15deg)',
      transition: 'transform 0.3s ease'
    }}>
      <g fill={crashed ? '#ff4757' : '#00d2ff'}>
        <path d="M8 32 L28 8 L40 20 L20 28 Z" opacity="0.9"/>
        <path d="M20 28 L40 20 L44 28 L28 30 Z" opacity="0.7"/>
        <path d="M8 32 L20 28 L18 38 Z" opacity="0.8"/>
        <path d="M26 22 L36 18 L36 26 Z" opacity="0.6"/>
      </g>
      {!crashed && (
        <>
          <ellipse cx="10" cy="33" rx="3" ry="2" fill="#ff6b35" opacity="0.9">
            <animate attributeName="rx" values="3;5;3" dur="0.15s" repeatCount="indefinite"/>
          </ellipse>
          <ellipse cx="6" cy="34" rx="2" ry="1.5" fill="#ffd32a" opacity="0.7">
            <animate attributeName="rx" values="2;4;2" dur="0.15s" repeatCount="indefinite"/>
          </ellipse>
        </>
      )}
    </svg>
  );
}

// ─── Canvas Game Renderer ─────────────────────────────────────────────────────
function GameCanvas({ multiplier, status }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const pathRef = useRef([]);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const W = canvas.width;
    const H = canvas.height;
    const PAD = 40;

    // Map multiplier to canvas y position
    const multToY = (m) => {
      const maxM = Math.max(multiplier * 1.2, 3);
      return H - PAD - ((m - 1) / (maxM - 1)) * (H - PAD * 2);
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background grid
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      for (let x = 0; x < W; x += 60) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }

      if (status === 'waiting') {
        pathRef.current = [];
        frameRef.current = 0;
        return;
      }

      // Add new point
      if (status === 'flying' || status === 'crashed') {
        const progress = Math.min(frameRef.current / 300, 1);
        const x = PAD + progress * (W - PAD * 2);
        const y = multToY(multiplier);
        pathRef.current.push({ x, y });
        frameRef.current++;
      }

      if (pathRef.current.length < 2) return;

      // Draw gradient fill under curve
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      if (status === 'crashed') {
        gradient.addColorStop(0, 'rgba(255,71,87,0.3)');
        gradient.addColorStop(1, 'rgba(255,71,87,0.02)');
      } else {
        gradient.addColorStop(0, 'rgba(0,210,255,0.2)');
        gradient.addColorStop(1, 'rgba(0,210,255,0.02)');
      }

      ctx.beginPath();
      ctx.moveTo(PAD, H - PAD);
      for (const pt of pathRef.current) ctx.lineTo(pt.x, pt.y);
      ctx.lineTo(pathRef.current[pathRef.current.length - 1].x, H - PAD);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw path line
      ctx.beginPath();
      ctx.moveTo(pathRef.current[0].x, pathRef.current[0].y);
      for (let i = 1; i < pathRef.current.length; i++) {
        ctx.lineTo(pathRef.current[i].x, pathRef.current[i].y);
      }
      ctx.strokeStyle = status === 'crashed' ? '#ff4757' : '#00d2ff';
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Glow on line
      ctx.shadowColor = status === 'crashed' ? '#ff4757' : '#00d2ff';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Y-axis labels
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '11px monospace';
      const maxM = Math.max(multiplier * 1.2, 3);
      for (let m = 1; m <= maxM; m++) {
        const y = multToY(m);
        if (y > PAD && y < H - PAD / 2) {
          ctx.fillText(`${m}x`, 4, y + 4);
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.moveTo(PAD, y); ctx.lineTo(W, y); ctx.stroke();
        }
      }
    };

    const loop = () => { draw(); animRef.current = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(animRef.current);
  }, [multiplier, status]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={320}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
}

// ─── Main AviatorGame Component ───────────────────────────────────────────────
export default function AviatorGame() {
  const { user, refreshBalance } = useAuth();

  const [round, setRound] = useState(null);
  const [multiplier, setMultiplier] = useState(1.0);
  const [status, setStatus] = useState('waiting');
  const [history, setHistory] = useState([]);
  const [allBets, setAllBets] = useState([]);
  const [userBet, setUserBet] = useState(null);
  const [messages, setMessages] = useState([]);

  const [betAmount, setBetAmount] = useState('');
  const [autoCashout, setAutoCashout] = useState('');
  const [chatInput, setChatInput] = useState('');

  const [isBetting, setIsBetting] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [notification, setNotification] = useState(null);

  const pollRef = useRef(null);
  const chatRef = useRef(null);

  const notify = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── Load history & initial round ──────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const res = await gameAPI.getHistory(20);
      setHistory(res.data.history || []);
    } catch {}
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const { default: chatAPI } = await import('../api/api').then(m => ({ default: m.chatAPI }));
      const res = await chatAPI.messages(40);
      setMessages(res.data.messages || []);
    } catch {}
  }, []);

  // ── Poll current round every 200ms ───────────────────────────────────────
  const pollRound = useCallback(async () => {
    try {
      const res = await gameAPI.getCurrent();
      const data = res.data;

      if (data.round) {
        const r = data.round;
        setRound(r);
        setMultiplier(r.multiplier || 1.0);
        setStatus(r.status);
        setAllBets(data.bets || []);

        // Our bet
        if (data.user_bet) {
          setUserBet(data.user_bet);
        } else {
          // Check if we had a bet and round just crashed → refresh balance
          setUserBet(prev => {
            if (prev && r.status === 'crashed') {
              refreshBalance();
              return null;
            }
            return prev;
          });
        }

        // When round crashes, refresh history
        if (r.status === 'crashed') {
          fetchHistory();
        }
      } else {
        // No current round
        setRound(null);
        setStatus('waiting');
        setMultiplier(1.0);
        setAllBets([]);
      }
    } catch {}
  }, [fetchHistory, refreshBalance]);

  useEffect(() => {
    fetchHistory();
    fetchMessages();
    pollRef.current = setInterval(pollRound, 300);
    return () => clearInterval(pollRef.current);
  }, [pollRound, fetchHistory, fetchMessages]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // ── Place Bet ─────────────────────────────────────────────────────────────
  const handleBet = async () => {
    const amount = parseFloat(betAmount);
    if (!amount || amount < 10) { notify('Minimum bet is KES 10', 'error'); return; }
    if (userBet) { notify('You already have a bet this round', 'error'); return; }
    if (status !== 'waiting') { notify('Wait for the next round to bet', 'error'); return; }

    setIsBetting(true);
    try {
      const res = await gameAPI.placeBet({
        amount,
        auto_cashout: autoCashout ? parseFloat(autoCashout) : null
      });
      setUserBet(res.data.bet);
      refreshBalance();
      notify(`Bet of KES ${amount} placed! ✈️`, 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Failed to place bet', 'error');
    } finally {
      setIsBetting(false);
    }
  };

  // ── Cashout ───────────────────────────────────────────────────────────────
  const handleCashout = async () => {
    if (!userBet) { notify('No active bet', 'error'); return; }
    if (status !== 'flying') { notify('Cannot cashout right now', 'error'); return; }

    setIsCashingOut(true);
    try {
      const res = await gameAPI.cashout({ bet_id: userBet.id, multiplier });
      setUserBet(null);
      refreshBalance();
      notify(`💰 Cashed out at ${res.data.multiplier}x! Won KES ${res.data.payout.toFixed(2)}`, 'success');
    } catch (err) {
      notify(err.response?.data?.message || 'Cashout failed', 'error');
    } finally {
      setIsCashingOut(false);
    }
  };

  // ── Send Chat ─────────────────────────────────────────────────────────────
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

  const quickAmounts = [20, 50, 100, 200, 500, 1000];
  const canBet = status === 'waiting' && !userBet && !isBetting;
  const canCashout = status === 'flying' && userBet && (userBet.status === 'active' || userBet.status === 'pending') && !isCashingOut;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0f14',
      fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      color: '#e0e0e0',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Google Font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;600;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: #1a1d26; }
        ::-webkit-scrollbar-thumb { background: #2a2d3a; border-radius: 4px; }
        input:focus, textarea:focus { outline: none; }
        .bet-btn { transition: all 0.18s ease; }
        .bet-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.15); }
        .bet-btn:active:not(:disabled) { transform: translateY(0); }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.5 } }
        @keyframes slideIn { from { transform:translateY(-20px); opacity:0 } to { transform:translateY(0); opacity:1 } }
        @keyframes crashShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)} 40%{transform:translateX(6px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
      `}</style>

      {/* ── TOP NAV ── */}
      <nav style={{
        background: '#13161f',
        borderBottom: '1px solid #1e2230',
        padding: '0 16px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontFamily: 'Orbitron, monospace',
            fontWeight: 900,
            fontSize: 20,
            color: '#00d2ff',
            letterSpacing: 2,
            textShadow: '0 0 20px #00d2ff66'
          }}>
            ✈ AVIATOR
          </span>
          <span style={{ background: '#ff475720', color: '#ff4757', fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, border: '1px solid #ff475740' }}>LIVE</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && (
            <>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#888', lineHeight: 1 }}>Balance</div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#2ed573', fontWeight: 700 }}>
                  KES {parseFloat(user.total_balance || 0).toFixed(2)}
                </div>
              </div>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'linear-gradient(135deg, #00d2ff, #0072ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer'
              }}>
                {(user.full_name || user.phone_number || 'U')[0].toUpperCase()}
              </div>
            </>
          )}
        </div>
      </nav>

      {/* ── NOTIFICATION ── */}
      {notification && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: notification.type === 'success' ? '#2ed573' : notification.type === 'error' ? '#ff4757' : '#1e90ff',
          color: '#fff', padding: '10px 22px', borderRadius: 8, zIndex: 999,
          fontWeight: 600, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.2s ease'
        }}>
          {notification.msg}
        </div>
      )}

      {/* ── HISTORY BAR ── */}
      <div style={{
        background: '#13161f',
        borderBottom: '1px solid #1e2230',
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        overflowX: 'auto',
      }}>
        <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap', marginRight: 4 }}>HISTORY</span>
        {history.slice(0, 15).map((r, i) => (
          <HistoryBadge key={i} value={parseFloat(r.multiplier) || 1} />
        ))}
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gridTemplateRows: 'auto 1fr',
        gap: 0,
        maxWidth: 1200,
        width: '100%',
        margin: '0 auto',
        padding: '12px',
      }}>

        {/* ── GAME CANVAS ── */}
        <div style={{
          background: '#13161f',
          border: '1px solid #1e2230',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 340,
          marginBottom: 12,
          gridColumn: '1 / 2',
        }}>
          <GameCanvas multiplier={multiplier} status={status} />

          {/* Multiplier overlay */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -60%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}>
            {status === 'waiting' && (
              <div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 13, color: '#888', marginBottom: 8, letterSpacing: 2 }}>
                  PREPARING...
                </div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 40, color: '#fff', fontWeight: 900, animation: 'pulse 1s infinite' }}>
                  🛫
                </div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>Place your bet now!</div>
              </div>
            )}
            {status === 'flying' && (
              <div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 52, fontWeight: 900, color: getMultiplierColor(multiplier), textShadow: `0 0 30px ${getMultiplierColor(multiplier)}88`, lineHeight: 1 }}>
                  {multiplier.toFixed(2)}x
                </div>
                {userBet && (
                  <div style={{ fontSize: 13, color: '#2ed573', marginTop: 6, fontWeight: 600 }}>
                    Potential: KES {(parseFloat(userBet.amount) * multiplier).toFixed(2)}
                  </div>
                )}
              </div>
            )}
            {status === 'crashed' && (
              <div style={{ animation: 'crashShake 0.4s ease' }}>
                <div style={{ fontFamily: 'Orbitron', fontSize: 22, color: '#ff4757', fontWeight: 700, letterSpacing: 3, marginBottom: 4 }}>
                  FLEW AWAY!
                </div>
                <div style={{ fontFamily: 'Orbitron', fontSize: 48, fontWeight: 900, color: '#ff4757', textShadow: '0 0 30px #ff475788' }}>
                  {multiplier.toFixed(2)}x
                </div>
              </div>
            )}
          </div>

          {/* Plane position indicator */}
          {status === 'flying' && (
            <div style={{ position: 'absolute', bottom: 20, right: 20 }}>
              <Plane crashed={false} />
            </div>
          )}
          {status === 'crashed' && (
            <div style={{ position: 'absolute', bottom: 10, right: 20, opacity: 0.6 }}>
              <Plane crashed={true} />
            </div>
          )}
        </div>

        {/* ── CHAT ── */}
        <div style={{
          gridColumn: '2 / 3',
          gridRow: '1 / 3',
          background: '#13161f',
          border: '1px solid #1e2230',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginLeft: 12,
          maxHeight: 600,
        }}>
          <div style={{
            padding: '10px 14px',
            borderBottom: '1px solid #1e2230',
            fontSize: 12,
            fontWeight: 700,
            color: '#888',
            letterSpacing: 1
          }}>
            💬 LIVE CHAT
          </div>
          <div ref={chatRef} style={{
            flex: 1, overflowY: 'auto', padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 6
          }}>
            {messages.map((m) => (
              <div key={m.id} style={{ fontSize: 12 }}>
                {m.is_system ? (
                  <div style={{ color: '#ffd32a', fontStyle: 'italic', opacity: 0.8, textAlign: 'center', fontSize: 11 }}>
                    {m.message}
                  </div>
                ) : (
                  <div>
                    <span style={{ color: '#00d2ff', fontWeight: 700, marginRight: 6 }}>
                      {m.username}
                    </span>
                    <span style={{ color: '#bbb' }}>{m.message}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleSendChat} style={{
            padding: '8px 10px',
            borderTop: '1px solid #1e2230',
            display: 'flex',
            gap: 6
          }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              style={{
                flex: 1, background: '#0d0f14', border: '1px solid #2a2d3a',
                borderRadius: 6, padding: '6px 10px', color: '#e0e0e0',
                fontSize: 12,
              }}
            />
            <button type="submit" style={{
              background: '#1e90ff', border: 'none', borderRadius: 6,
              padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700
            }}>→</button>
          </form>
        </div>

        {/* ── BET PANEL ── */}
        <div style={{
          gridColumn: '1 / 2',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
        }}>
          {/* Bet Controls */}
          <div style={{
            background: '#13161f',
            border: '1px solid #1e2230',
            borderRadius: 12,
            padding: '16px',
          }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>
              PLACE BET
            </div>

            {/* Amount input */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>BET AMOUNT (KES)</div>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                placeholder="e.g. 100"
                min={10}
                style={{
                  width: '100%', background: '#0d0f14',
                  border: '1px solid #2a2d3a', borderRadius: 8,
                  padding: '10px 12px', color: '#e0e0e0', fontSize: 15,
                  fontFamily: 'Orbitron, monospace',
                }}
              />
            </div>

            {/* Quick amounts */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {quickAmounts.map(q => (
                <button key={q} className="bet-btn" onClick={() => setBetAmount(String(q))}
                  style={{
                    background: betAmount === String(q) ? '#1e90ff22' : '#0d0f14',
                    border: `1px solid ${betAmount === String(q) ? '#1e90ff' : '#2a2d3a'}`,
                    color: betAmount === String(q) ? '#1e90ff' : '#888',
                    borderRadius: 6, padding: '4px 10px',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer'
                  }}>
                  {q}
                </button>
              ))}
            </div>

            {/* Auto cashout */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>AUTO CASHOUT AT (optional)</div>
              <input
                type="number"
                value={autoCashout}
                onChange={e => setAutoCashout(e.target.value)}
                placeholder="e.g. 2.00"
                min={1.01}
                step={0.1}
                style={{
                  width: '100%', background: '#0d0f14',
                  border: '1px solid #2a2d3a', borderRadius: 8,
                  padding: '8px 12px', color: '#e0e0e0', fontSize: 13,
                }}
              />
            </div>

            {/* Place Bet / Cashout button */}
            {canCashout ? (
              <button
                className="bet-btn"
                onClick={handleCashout}
                disabled={isCashingOut}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 10,
                  border: 'none',
                  background: isCashingOut ? '#555' : 'linear-gradient(135deg, #2ed573, #1abc9c)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: 'Orbitron, monospace',
                  cursor: isCashingOut ? 'not-allowed' : 'pointer',
                  letterSpacing: 1,
                  boxShadow: '0 4px 20px rgba(46,213,115,0.3)',
                }}>
                {isCashingOut ? '...' : `💰 CASHOUT ${multiplier.toFixed(2)}x`}
              </button>
            ) : (
              <button
                className="bet-btn"
                onClick={handleBet}
                disabled={!canBet}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 10,
                  border: 'none',
                  background: canBet
                    ? 'linear-gradient(135deg, #1e90ff, #0052d4)'
                    : '#1e2230',
                  color: canBet ? '#fff' : '#555',
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: 'Orbitron, monospace',
                  cursor: canBet ? 'pointer' : 'not-allowed',
                  letterSpacing: 1,
                  boxShadow: canBet ? '0 4px 20px rgba(30,144,255,0.3)' : 'none',
                }}>
                {isBetting ? '...' : userBet ? '✓ BET PLACED' : status !== 'waiting' ? 'NEXT ROUND' : '✈ BET'}
              </button>
            )}

            {/* Current bet display */}
            {userBet && (
              <div style={{
                marginTop: 10,
                background: '#0d2a0d',
                border: '1px solid #2ed57340',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 12,
              }}>
                <div style={{ color: '#2ed573', fontWeight: 700 }}>Active Bet</div>
                <div style={{ color: '#bbb', marginTop: 2 }}>
                  KES {parseFloat(userBet.amount).toFixed(2)}
                  {userBet.auto_cashout && (
                    <span style={{ color: '#ffd32a', marginLeft: 8 }}>
                      Auto @{parseFloat(userBet.auto_cashout).toFixed(2)}x
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Live Bets Table */}
          <div style={{
            background: '#13161f',
            border: '1px solid #1e2230',
            borderRadius: 12,
            padding: '16px',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: 12, color: '#888', fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>
              LIVE BETS ({allBets.length})
            </div>
            <div style={{ overflowY: 'auto', maxHeight: 200 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e2230' }}>
                    <th style={{ textAlign: 'left', color: '#555', fontWeight: 600, paddingBottom: 6, fontSize: 10 }}>USER</th>
                    <th style={{ textAlign: 'right', color: '#555', fontWeight: 600, paddingBottom: 6, fontSize: 10 }}>BET</th>
                    <th style={{ textAlign: 'right', color: '#555', fontWeight: 600, paddingBottom: 6, fontSize: 10 }}>MULTI</th>
                  </tr>
                </thead>
                <tbody>
                  {allBets.slice(0, 20).map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid #1a1d26' }}>
                      <td style={{ padding: '4px 0', color: '#888' }}>{b.username}</td>
                      <td style={{ textAlign: 'right', color: '#e0e0e0' }}>
                        {parseFloat(b.amount).toFixed(0)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {b.cashout_multiplier ? (
                          <span style={{ color: '#2ed573', fontWeight: 700 }}>
                            {parseFloat(b.cashout_multiplier).toFixed(2)}x
                          </span>
                        ) : (
                          <span style={{ color: '#555', animation: 'pulse 1.5s infinite' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {allBets.length === 0 && (
                    <tr><td colSpan={3} style={{ color: '#444', textAlign: 'center', padding: '20px 0', fontSize: 11 }}>No bets yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
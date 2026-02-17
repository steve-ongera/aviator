import { useState, useEffect } from 'react';
import { gameAPI, leaderboardAPI } from '../api/api';
import { useAuth } from '../store/AuthContext';

const cardStyle = {
  background: '#13161f',
  border: '1px solid #1e2230',
  borderRadius: 12,
  padding: '20px',
};

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [bets, setBets] = useState([]);
  const [leaders, setLeaders] = useState([]);
  const [tab, setTab] = useState('stats');
  const [loadingBets, setLoadingBets] = useState(false);

  useEffect(() => {
    if (tab === 'history') loadBets();
    if (tab === 'leaders') loadLeaders();
  }, [tab]);

  const loadBets = async () => {
    setLoadingBets(true);
    try {
      const res = await gameAPI.myHistory(30, 0);
      setBets(res.data.bets || []);
    } catch {} finally { setLoadingBets(false); }
  };

  const loadLeaders = async () => {
    try {
      const res = await leaderboardAPI.top(10);
      setLeaders(res.data.leaders || []);
    } catch {}
  };

  const stats = user?.statistics;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0f14',
      fontFamily: "'Rajdhani','Segoe UI',sans-serif",
      color: '#e0e0e0',
      padding: 16,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
      `}</style>

      <div style={{ maxWidth: 700, margin: '0 auto' }}>

        {/* Profile header card */}
        <div style={{
          ...cardStyle,
          marginBottom: 16,
          background: 'linear-gradient(135deg, #13161f, #1a1d26)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #00d2ff, #0072ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0
            }}>
              {(user?.full_name || user?.phone_number || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: '#e0e0e0' }}>
                {user?.full_name || 'Player'}
              </div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                {user?.phone_number}
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                Joined {new Date(user?.date_joined || Date.now()).toLocaleDateString()}
              </div>
            </div>
          </div>
          <button onClick={logout} style={{
            background: '#ff475722', border: '1px solid #ff475740',
            color: '#ff4757', borderRadius: 8, padding: '8px 16px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer', letterSpacing: 1
          }}>
            LOGOUT
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#13161f', borderRadius: 10, padding: 4, border: '1px solid #1e2230' }}>
          {['stats', 'history', 'leaders'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: tab === t ? '#1e90ff' : 'transparent',
              color: tab === t ? '#fff' : '#666',
              fontFamily: 'Orbitron, monospace', fontSize: 10, fontWeight: 700, letterSpacing: 1,
              transition: 'all 0.2s'
            }}>
              {t === 'stats' ? '📊 STATS' : t === 'history' ? '✈ HISTORY' : '🏆 LEADERS'}
            </button>
          ))}
        </div>

        {/* Stats Tab */}
        {tab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Total Bets', val: stats?.total_bets ?? 0, color: '#1e90ff' },
              { label: 'Total Wins', val: stats?.total_wins ?? 0, color: '#2ed573' },
              { label: 'Win Rate', val: `${parseFloat(stats?.win_rate ?? 0).toFixed(1)}%`, color: '#ffd32a' },
              { label: 'Biggest Multiplier', val: `${parseFloat(stats?.biggest_multiplier ?? 0).toFixed(2)}x`, color: '#a29bfe' },
              { label: 'Total Wagered', val: `KES ${parseFloat(stats?.total_wagered ?? 0).toFixed(2)}`, color: '#ff6b81', span: true },
              { label: 'Total Won', val: `KES ${parseFloat(stats?.total_won ?? 0).toFixed(2)}`, color: '#2ed573', span: true },
              { label: 'Biggest Win', val: `KES ${parseFloat(stats?.biggest_win ?? 0).toFixed(2)}`, color: '#ffd32a', span: true },
            ].map((item, i) => (
              <div key={i} style={{
                ...cardStyle,
                gridColumn: item.span ? '1 / 3' : 'auto',
              }}>
                <div style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: 1 }}>{item.label}</div>
                <div style={{
                  fontFamily: 'Orbitron, monospace', fontSize: item.span ? 22 : 26,
                  fontWeight: 700, color: item.color, marginTop: 6
                }}>
                  {item.val}
                </div>
              </div>
            ))}

            {/* Profit/Loss */}
            {stats && (() => {
              const profit = parseFloat(stats.total_won) - parseFloat(stats.total_wagered);
              return (
                <div style={{
                  ...cardStyle,
                  gridColumn: '1 / 3',
                  borderColor: profit >= 0 ? '#2ed57340' : '#ff475740',
                  background: profit >= 0 ? '#0d2a1a' : '#1a0d0d',
                }}>
                  <div style={{ fontSize: 11, color: '#555', fontWeight: 700, letterSpacing: 1 }}>NET P&L</div>
                  <div style={{
                    fontFamily: 'Orbitron, monospace', fontSize: 22,
                    fontWeight: 700, color: profit >= 0 ? '#2ed573' : '#ff4757', marginTop: 6
                  }}>
                    {profit >= 0 ? '+' : ''}KES {profit.toFixed(2)}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Bet History Tab */}
        {tab === 'history' && (
          <div style={cardStyle}>
            {loadingBets ? (
              <div style={{ textAlign: 'center', color: '#444', padding: '30px 0' }}>Loading...</div>
            ) : bets.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#444', padding: '30px 0' }}>No bets yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bets.map(b => (
                  <div key={b.id} style={{
                    background: '#0d0f14', borderRadius: 10, padding: '12px 14px',
                    border: `1px solid ${b.status === 'won' ? '#2ed57330' : b.status === 'lost' ? '#ff475730' : '#1e2230'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        Round #{b.round_number}
                        {b.crash_at && (
                          <span style={{ color: '#ff475788', fontSize: 11, marginLeft: 8 }}>
                            crashed @{b.crash_at.toFixed(2)}x
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                        {new Date(b.created_at).toLocaleString()}
                        {b.auto_cashout && (
                          <span style={{ color: '#ffd32a88', marginLeft: 8 }}>
                            Auto @{parseFloat(b.auto_cashout).toFixed(2)}x
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        Bet: KES {parseFloat(b.amount).toFixed(2)}
                      </div>
                      {b.status === 'won' && (
                        <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#2ed573', fontWeight: 700 }}>
                          +KES {parseFloat(b.payout).toFixed(2)} @{parseFloat(b.cashout_multiplier).toFixed(2)}x
                        </div>
                      )}
                      {b.status === 'lost' && (
                        <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#ff4757', fontWeight: 700 }}>
                          Lost
                        </div>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                        background: b.status === 'won' ? '#2ed57320' : b.status === 'lost' ? '#ff475720' : '#1e90ff20',
                        color: b.status === 'won' ? '#2ed573' : b.status === 'lost' ? '#ff4757' : '#1e90ff',
                        border: `1px solid ${b.status === 'won' ? '#2ed57340' : b.status === 'lost' ? '#ff475740' : '#1e90ff40'}`
                      }}>
                        {b.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Tab */}
        {tab === 'leaders' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 14, fontStyle: 'italic' }}>
              Top players by total winnings
            </div>
            {leaders.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#444', padding: '30px 0' }}>No data</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {leaders.map((l, i) => (
                  <div key={i} style={{
                    background: '#0d0f14', borderRadius: 10, padding: '12px 14px',
                    border: i === 0 ? '1px solid #ffd32a40' : '1px solid #1e2230',
                    display: 'flex', alignItems: 'center', gap: 12
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: i === 0 ? '#ffd32a' : i === 1 ? '#bdc3c7' : i === 2 ? '#e67e22' : '#2a2d3a',
                      color: i < 3 ? '#fff' : '#666',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'Orbitron', fontSize: 12, fontWeight: 700
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#e0e0e0' }}>{l.username}</div>
                      <div style={{ fontSize: 11, color: '#555' }}>
                        Best: {parseFloat(l.biggest_multiplier).toFixed(2)}x · Win rate: {parseFloat(l.win_rate).toFixed(1)}%
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'Orbitron', fontSize: 14, fontWeight: 700, color: '#ffd32a' }}>
                        KES {parseFloat(l.total_won).toFixed(0)}
                      </div>
                      <div style={{ fontSize: 10, color: '#555' }}>total won</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { transactionAPI } from '../api/api';
import { useAuth } from '../store/AuthContext';

const cardStyle = {
  background: '#13161f',
  border: '1px solid #1e2230',
  borderRadius: 12,
  padding: '20px',
};

const inputStyle = {
  width: '100%', background: '#0d0f14',
  border: '1px solid #2a2d3a', borderRadius: 10,
  padding: '12px 14px', color: '#e0e0e0', fontSize: 15,
  fontFamily: 'inherit',
};

const labelStyle = { fontSize: 11, color: '#666', fontWeight: 700, letterSpacing: 1, marginBottom: 6 };

function StatusBadge({ status }) {
  const map = {
    completed: { bg: '#2ed57320', border: '#2ed57340', color: '#2ed573' },
    pending: { bg: '#ffd32a20', border: '#ffd32a40', color: '#ffd32a' },
    failed: { bg: '#ff475720', border: '#ff475740', color: '#ff4757' },
    cancelled: { bg: '#55555520', border: '#55555540', color: '#888' },
  };
  const s = map[status] || map.cancelled;
  return (
    <span style={{
      background: s.bg, border: `1px solid ${s.border}`,
      color: s.color, borderRadius: 5, padding: '2px 8px',
      fontSize: 11, fontWeight: 700
    }}>
      {status}
    </span>
  );
}

function TypeIcon({ type }) {
  const icons = { deposit: '↓', withdrawal: '↑', bet: '✈', win: '💰', bonus: '🎁', rain: '🌧', refund: '↩' };
  const colors = { deposit: '#2ed573', withdrawal: '#ff4757', bet: '#1e90ff', win: '#ffd32a', bonus: '#a29bfe', rain: '#74b9ff', refund: '#fd79a8' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 30, height: 30, borderRadius: 8,
      background: (colors[type] || '#888') + '22',
      color: colors[type] || '#888',
      fontSize: type === 'deposit' || type === 'withdrawal' ? 16 : 14,
      fontWeight: 900,
    }}>
      {icons[type] || '•'}
    </span>
  );
}

export default function WalletPage() {
  const { user, refreshBalance } = useAuth();
  const [tab, setTab] = useState('deposit'); // deposit | withdraw | history
  const [transactions, setTransactions] = useState([]);
  const [totalTx, setTotalTx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const [depositForm, setDepositForm] = useState({ amount: '', phone_number: '' });
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', phone_number: '' });
  const [pendingTx, setPendingTx] = useState(null);

  const notify = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchTransactions = async () => {
    try {
      const res = await transactionAPI.list({ limit: 30 });
      setTransactions(res.data.transactions || []);
      setTotalTx(res.data.total || 0);
    } catch {}
  };

  useEffect(() => { fetchTransactions(); }, []);

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(depositForm.amount);
    if (!amount || amount < 10) { notify('Minimum deposit is KES 10', 'error'); return; }

    setLoading(true);
    try {
      const res = await transactionAPI.deposit({
        amount,
        phone_number: depositForm.phone_number || user?.phone_number
      });
      setPendingTx(res.data.transaction_id);
      notify('STK push sent! Confirm the payment on your phone 📱', 'info');
    } catch (err) {
      notify(err.response?.data?.message || 'Deposit failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeposit = async (success) => {
    if (!pendingTx) return;
    setLoading(true);
    try {
      const res = await transactionAPI.completeDeposit({ transaction_id: pendingTx, success });
      if (res.data.success) {
        notify(`✅ KES ${res.data.amount} deposited! New balance: KES ${res.data.new_balance?.toFixed(2)}`, 'success');
        refreshBalance();
        fetchTransactions();
        setPendingTx(null);
        setDepositForm({ amount: '', phone_number: '' });
      } else {
        notify('Deposit cancelled.', 'error');
        setPendingTx(null);
      }
    } catch (err) {
      notify(err.response?.data?.message || 'Error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawForm.amount);
    if (!amount || amount < 100) { notify('Minimum withdrawal is KES 100', 'error'); return; }

    setLoading(true);
    try {
      const res = await transactionAPI.withdraw({
        amount,
        phone_number: withdrawForm.phone_number || user?.phone_number
      });
      notify(`✅ Withdrawal of KES ${amount} processed!`, 'success');
      refreshBalance();
      fetchTransactions();
      setWithdrawForm({ amount: '', phone_number: '' });
    } catch (err) {
      notify(err.response?.data?.message || 'Withdrawal failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0d0f14',
      fontFamily: "'Rajdhani', 'Segoe UI', sans-serif",
      color: '#e0e0e0',
      padding: '16px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Orbitron:wght@400;600;700&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        input:focus { border-color:#1e90ff !important; outline:none; }
      `}</style>

      {msg && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: msg.type === 'success' ? '#2ed573' : msg.type === 'error' ? '#ff4757' : '#1e90ff',
          color: '#fff', padding: '10px 22px', borderRadius: 8, zIndex: 999, fontWeight: 600, fontSize: 14
        }}>
          {msg.text}
        </div>
      )}

      <div style={{ maxWidth: 700, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'Orbitron', fontSize: 22, fontWeight: 700, color: '#e0e0e0' }}>
            💳 Wallet
          </div>
        </div>

        {/* Balance Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #0d2a1a, #13161f)', borderColor: '#2ed57340' }}>
            <div style={{ fontSize: 11, color: '#2ed57388', fontWeight: 700, letterSpacing: 1 }}>MAIN BALANCE</div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 24, fontWeight: 700, color: '#2ed573', marginTop: 6 }}>
              KES {parseFloat(user?.balance || 0).toFixed(2)}
            </div>
          </div>
          <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #1a1228, #13161f)', borderColor: '#a29bfe40' }}>
            <div style={{ fontSize: 11, color: '#a29bfe88', fontWeight: 700, letterSpacing: 1 }}>BONUS BALANCE</div>
            <div style={{ fontFamily: 'Orbitron', fontSize: 24, fontWeight: 700, color: '#a29bfe', marginTop: 6 }}>
              KES {parseFloat(user?.bonus_balance || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#13161f', borderRadius: 10, padding: 4, border: '1px solid #1e2230' }}>
          {['deposit', 'withdraw', 'history'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: 8, cursor: 'pointer',
              background: tab === t ? '#1e90ff' : 'transparent',
              color: tab === t ? '#fff' : '#666',
              fontFamily: 'Orbitron, monospace', fontSize: 11, fontWeight: 700, letterSpacing: 1,
              transition: 'all 0.2s'
            }}>
              {t === 'deposit' ? '↓ DEPOSIT' : t === 'withdraw' ? '↑ WITHDRAW' : '📋 HISTORY'}
            </button>
          ))}
        </div>

        {/* Deposit Tab */}
        {tab === 'deposit' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
              Deposit via M-Pesa. Enter amount and confirm on your phone.
            </div>

            {pendingTx ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📱</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#e0e0e0', marginBottom: 8 }}>
                  Check your phone
                </div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>
                  Enter your M-Pesa PIN to complete the deposit
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => handleConfirmDeposit(true)} disabled={loading}
                    style={{
                      flex: 1, padding: '13px', background: '#2ed573', border: 'none',
                      borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'Orbitron, monospace'
                    }}>
                    ✓ PAID
                  </button>
                  <button onClick={() => handleConfirmDeposit(false)} disabled={loading}
                    style={{
                      flex: 1, padding: '13px', background: '#1e2230', border: '1px solid #2a2d3a',
                      borderRadius: 10, color: '#888', fontSize: 15, fontWeight: 700, cursor: 'pointer'
                    }}>
                    ✗ CANCEL
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleDeposit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <div style={labelStyle}>AMOUNT (KES)</div>
                  <input
                    style={inputStyle} type="number" placeholder="Min. 10" min={10} max={300000}
                    value={depositForm.amount}
                    onChange={e => setDepositForm(p => ({ ...p, amount: e.target.value }))}
                    required
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {quickAmounts.map(q => (
                    <button key={q} type="button"
                      onClick={() => setDepositForm(p => ({ ...p, amount: String(q) }))}
                      style={{
                        background: depositForm.amount === String(q) ? '#1e90ff22' : '#0d0f14',
                        border: `1px solid ${depositForm.amount === String(q) ? '#1e90ff' : '#2a2d3a'}`,
                        color: depositForm.amount === String(q) ? '#1e90ff' : '#888',
                        borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                      }}>
                      {q}
                    </button>
                  ))}
                </div>
                <div>
                  <div style={labelStyle}>PHONE NUMBER (leave blank to use account phone)</div>
                  <input
                    style={inputStyle} placeholder="+254712345678"
                    value={depositForm.phone_number}
                    onChange={e => setDepositForm(p => ({ ...p, phone_number: e.target.value }))}
                  />
                </div>
                <button type="submit" disabled={loading} style={{
                  background: loading ? '#1e2230' : 'linear-gradient(135deg, #2ed573, #1abc9c)',
                  border: 'none', borderRadius: 10, padding: '14px', color: '#fff',
                  fontSize: 15, fontWeight: 700, fontFamily: 'Orbitron, monospace',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(46,213,115,0.3)'
                }}>
                  {loading ? '...' : '📲 SEND STK PUSH'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Withdraw Tab */}
        {tab === 'withdraw' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
              Withdraw to M-Pesa. Only main balance (not bonus) can be withdrawn.
            </div>
            <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={labelStyle}>AMOUNT (KES)</div>
                <input
                  style={inputStyle} type="number" placeholder="Min. 100"
                  min={100} max={parseFloat(user?.balance || 0)}
                  value={withdrawForm.amount}
                  onChange={e => setWithdrawForm(p => ({ ...p, amount: e.target.value }))}
                  required
                />
                <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                  Available: KES {parseFloat(user?.balance || 0).toFixed(2)}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {quickAmounts.map(q => (
                  <button key={q} type="button"
                    onClick={() => setWithdrawForm(p => ({ ...p, amount: String(q) }))}
                    style={{
                      background: withdrawForm.amount === String(q) ? '#ff475722' : '#0d0f14',
                      border: `1px solid ${withdrawForm.amount === String(q) ? '#ff4757' : '#2a2d3a'}`,
                      color: withdrawForm.amount === String(q) ? '#ff4757' : '#888',
                      borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}>
                    {q}
                  </button>
                ))}
              </div>
              <div>
                <div style={labelStyle}>PHONE NUMBER</div>
                <input
                  style={inputStyle} placeholder="+254712345678"
                  value={withdrawForm.phone_number}
                  onChange={e => setWithdrawForm(p => ({ ...p, phone_number: e.target.value }))}
                />
              </div>
              <button type="submit" disabled={loading} style={{
                background: loading ? '#1e2230' : 'linear-gradient(135deg, #ff4757, #c0392b)',
                border: 'none', borderRadius: 10, padding: '14px', color: '#fff',
                fontSize: 15, fontWeight: 700, fontFamily: 'Orbitron, monospace',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}>
                {loading ? '...' : '↑ WITHDRAW'}
              </button>
            </form>
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 14 }}>
              {totalTx} total transactions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {transactions.length === 0 && (
                <div style={{ textAlign: 'center', color: '#444', padding: '30px 0' }}>
                  No transactions yet
                </div>
              )}
              {transactions.map(tx => (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: '#0d0f14', borderRadius: 10, padding: '12px 14px',
                  border: '1px solid #1e2230'
                }}>
                  <TypeIcon type={tx.transaction_type} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e0e0e0' }}>
                      {tx.description || tx.transaction_type}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                      {new Date(tx.created_at).toLocaleString()} · {tx.reference}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontFamily: 'Orbitron, monospace', fontSize: 14, fontWeight: 700,
                      color: ['deposit', 'win', 'bonus', 'rain', 'refund'].includes(tx.transaction_type) ? '#2ed573' : '#ff4757'
                    }}>
                      {['deposit', 'win', 'bonus', 'rain', 'refund'].includes(tx.transaction_type) ? '+' : '-'}
                      KES {parseFloat(tx.amount).toFixed(2)}
                    </div>
                    <StatusBadge status={tx.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
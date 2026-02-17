import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, transactionAPI } from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await authAPI.me();
      setUser(res.data.user);
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (phone_number, password) => {
    const res = await authAPI.login({ phone_number, password });
    const { tokens, user: userData } = res.data;
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    setUser(userData);
    return userData;
  };

  const register = async (phone_number, password, confirm_password, full_name) => {
    const res = await authAPI.register({ phone_number, password, confirm_password, full_name });
    const { tokens, user: userData } = res.data;
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      await authAPI.logout(refresh);
    } catch {}
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const refreshBalance = async () => {
    try {
      const res = await transactionAPI.balance();
      setUser(prev => prev ? {
        ...prev,
        balance: res.data.balance,
        bonus_balance: res.data.bonus_balance,
        total_balance: res.data.total_balance
      } : prev);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshBalance, fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
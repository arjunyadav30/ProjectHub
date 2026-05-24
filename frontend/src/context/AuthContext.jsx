import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, userAPI } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await userAPI.getMe();
      setUser(data.data.user);
      setProfile(data.data.profile);
    } catch {
      setUser(null);
      setProfile(null);
      localStorage.removeItem('accessToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) fetchMe();
    else setLoading(false);
  }, [fetchMe]);

  const login = async (credentials) => {
    const { data } = await authAPI.login(credentials);
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    setProfile(data.data.profile);
    return data.data;
  };

  const signup = async (formData) => {
    const { data } = await authAPI.signup(formData);
    localStorage.setItem('accessToken', data.data.accessToken);
    setUser(data.data.user);
    setProfile(data.data.profile);
    return data.data;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('accessToken');
    setUser(null);
    setProfile(null);
  };

  const updateProfile = (newProfile) => setProfile(newProfile);
  const updateUser = (newUser) => setUser(prev => ({ ...prev, ...newUser }));
  const refreshUser = fetchMe; // alias

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      login, signup, logout,
      updateProfile, updateUser,
      fetchMe, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

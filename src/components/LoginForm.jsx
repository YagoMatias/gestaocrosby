import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth } from './AuthContext';
import { authenticateUser, testSupabaseConnection, testCreateUser, getValidRoles } from '../lib/userProfiles';
import { checkSupabaseConfig } from '../lib/supabase';

const Logo = () => (
  <div className="flex justify-center mb-6">
    <img src="/crosbyazul.png" alt="Logo" />
  </div>
);

const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);
  const navigate = useNavigate();
  const { setUser } = useAuth();

  // Testar conectividade ao carregar o componente
  useEffect(() => {
    const testConnection = async () => {
      // Verificar configuração primeiro
      const config = checkSupabaseConfig();
      console.log('Configuração do Supabase:', config);
      
      // Mostrar roles válidos
      const validRoles = getValidRoles();
      console.log('Roles válidos:', validRoles);
      
      const result = await testSupabaseConnection();
      setConnectionStatus(result);
      if (!result.success) {
        console.error('Problema de conectividade com Supabase:', result.error);
      } else {
        // Se a conexão estiver OK, testar criação de usuário
        console.log('Testando criação de usuário...');
        const createTest = await testCreateUser();
        console.log('Resultado do teste de criação:', createTest);
      }
    };
    testConnection();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userData = await authenticateUser(username, password);
      
      // Salvar usuário sem senha
      const { password: _, ...userWithoutPassword } = userData;
      setUser(userWithoutPassword);
      setLoading(false);
      navigate('/home');
    } catch (err) {
      setError(err.message || 'Erro ao autenticar.');
      setLoading(false);
    }
  };

  return (
    <div className="w-screen h-screen flex items-center justify-center bg-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm mx-auto p-8 rounded-lg shadow-lg bg-white flex flex-col justify-center">
        <Logo />
        <h2 className="text-center text-2xl font-light tracking-wide text-gray-700 mb-2">HEADCOACH CROSBY</h2>
        <div className="text-center text-cyan-600 text-xl font-medium mb-6">Boas-vindas</div>
        
        {/* Status da conexão */}
        {connectionStatus && !connectionStatus.success && (
          <div className="mb-4 bg-yellow-100 border border-yellow-300 text-yellow-700 px-4 py-2 rounded text-center text-sm">
            ⚠️ Problema de conectividade: {connectionStatus.error}
            {connectionStatus.suggestion && (
              <div className="mt-2 text-xs">
                💡 {connectionStatus.suggestion}
              </div>
            )}
          </div>
        )}
        
        {error && <div className="mb-4 bg-red-100 border border-red-300 text-red-700 px-4 py-2 rounded text-center">{error}</div>}
        
        <div className="mb-4 relative flex items-center">
          <span className="absolute left-3 mt-1.5 -translate-y-1/2 text-gray-400 flex items-center justify-center">
            <User size={20} />
          </span>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="pl-10 pr-3 py-2 w-full border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition placeholder-gray-400"
            placeholder="Usuário"
            autoComplete="username"
            required
          />
        </div>
        <div className="mb-6 relative flex items-center">
          <span className="absolute left-3 mt-1.5 -translate-y-1/2 text-gray-400 flex items-center justify-center">
            <Lock size={20} />
          </span>
          <input
            type={showPassword ? 'text' : 'password'}
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pl-10 pr-10 py-2 w-full border border-gray-400 rounded focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 transition placeholder-gray-400"
            placeholder="Senha"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            tabIndex={-1}
            className="absolute right-3 mt-1.5 -translate-y-1/2 text-gray-400 focus:outline-none p-0 m-0 bg-transparent border-none flex items-center justify-center"
            style={{ boxShadow: 'none' }}
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? (
              <Eye size={20} />
            ) : (
              <EyeSlash size={20} />
            )}
          </button>
        </div>
        <button
          type="submit"
          className="w-full bg-gray-400 text-white p-2 rounded font-semibold hover:bg-gray-500 transition disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
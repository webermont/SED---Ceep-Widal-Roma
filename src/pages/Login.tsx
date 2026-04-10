import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { School } from 'lucide-react';

export default function Login() {
  const { user, signInWithGoogle, loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (user) {
    return <Navigate to="/" />;
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await loginWithEmail(email, password);
    } catch (err: any) {
      setError('Falha ao fazer login. Verifique suas credenciais ou se o provedor E-mail/Senha está ativado no Firebase.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-body">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center text-[#0F2C59]">
          <School size={48} />
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-900 font-heading">
          Sistema de Avaliação e Desempenho
        </h2>
        <h3 className="text-center text-lg font-bold text-[#0F2C59] font-heading">
          SAD Ceep Widal Roma
        </h3>
        <p className="mt-2 text-center text-xs text-gray-500 font-medium">
          Autor: Wéber Monteiro
        </p>
        <p className="mt-4 text-center text-sm text-gray-600">
          Acesso para Coordenadores e Professores
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-[#E2E8F0]">
          
          <form onSubmit={handleEmailLogin} className="space-y-6 mb-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">E-mail</label>
              <div className="mt-1">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-[#0F2C59] focus:outline-none focus:ring-[#0F2C59] sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Senha</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-[#0F2C59] focus:outline-none focus:ring-[#0F2C59] sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                className="flex w-full justify-center rounded-md border border-transparent bg-[#0F2C59] py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-[#0f3b7d] focus:outline-none focus:ring-2 focus:ring-[#0F2C59] focus:ring-offset-2"
              >
                Entrar
              </button>
            </div>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-gray-500">Ou continue com</span>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={signInWithGoogle}
              className="flex w-full justify-center items-center gap-3 rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#0F2C59] focus:ring-offset-2"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

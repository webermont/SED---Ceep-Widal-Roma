/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ModuloCorrecao = lazy(() => import('./pages/ModuloCorrecao'));
const AnaliseTurma = lazy(() => import('./pages/AnaliseTurma'));
const MapaCalorBNCC = lazy(() => import('./pages/MapaCalorBNCC'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-full w-full">
    <Loader2 className="w-8 h-8 animate-spin text-[#0F2C59]" />
  </div>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="correcao" element={<ModuloCorrecao />} />
              <Route path="analise" element={<AnaliseTurma />} />
              <Route path="mapa" element={<MapaCalorBNCC />} />
              <Route path="configuracoes" element={<Configuracoes />} />
            </Route>
            {/* Fallback to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}


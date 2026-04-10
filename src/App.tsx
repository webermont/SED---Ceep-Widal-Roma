/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ModuloCorrecao from './pages/ModuloCorrecao';
import AnaliseTurma from './pages/AnaliseTurma';
import MapaCalorBNCC from './pages/MapaCalorBNCC';
import Configuracoes from './pages/Configuracoes';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  );
}


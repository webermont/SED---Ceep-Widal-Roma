import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { School, LayoutDashboard, FileUp, Users, Grid, Settings, Bell } from 'lucide-react';
import { clsx } from 'clsx';

export default function Layout() {
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Módulo de Correção', path: '/correcao', icon: FileUp },
    { name: 'Análise de Turma', path: '/analise', icon: Users },
    { name: 'Mapa de Calor BNCC', path: '/mapa', icon: Grid },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F6F8] font-body">
      {/* Top NavBar */}
      <header className="flex items-center justify-between px-6 h-16 bg-[#0F2C59] text-white sticky top-0 z-50 shadow-sm shrink-0">
        <div className="flex items-center gap-4">
          <School className="w-6 h-6" />
          <h2 className="text-xl font-heading font-bold leading-tight tracking-tight">
            SAD - Ceep Widal Roma
          </h2>
        </div>
        <div className="flex flex-1 justify-end gap-6 items-center">
          <Link
            to="/correcao"
            className="flex min-w-[84px] cursor-pointer items-center justify-center rounded h-10 px-6 bg-white text-[#0F2C59] text-sm font-bold hover:bg-gray-100 transition-colors"
          >
            Nova Avaliação
          </Link>
          <button className="text-white hover:text-gray-200 transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 relative">
            <div className="text-right hidden md:block">
              <p className="text-sm font-semibold text-white">Administrador</p>
              <p className="text-xs text-blue-200">Acesso Livre</p>
            </div>
            <div className="rounded-full w-10 h-10 border-2 border-blue-300 bg-blue-800 flex items-center justify-center">
              <span className="text-sm font-bold">A</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-[240px] bg-white border-r border-[#E2E8F0] h-full flex-shrink-0 hidden md:flex flex-col py-6 z-10">
          <div className="px-4 mb-2">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-4">
              Menu Principal
            </p>
          </div>
          <nav className="flex-1 flex flex-col gap-1 px-3">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-blue-50 text-[#0F2C59] border-l-2 border-[#0F2C59]'
                      : 'text-[#1A202C] hover:bg-gray-50 border-l-2 border-transparent'
                  )}
                >
                  <Icon className={clsx("w-5 h-5", isActive ? "text-[#0F2C59]" : "text-gray-500")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="px-6 pb-4 flex flex-col gap-4">
            <Link to="/configuracoes" className="flex items-center gap-3 text-[#64748B] hover:text-[#1A202C] transition-colors w-full">
              <Settings className="w-5 h-5" />
              <span className="text-sm font-medium">Configurações</span>
            </Link>
            <div className="pt-4 border-t border-[#E2E8F0]">
              <p className="text-[10px] text-[#64748B] uppercase font-bold tracking-widest">Autor</p>
              <p className="text-xs font-medium text-[#1A202C]">Wéber Monteiro</p>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

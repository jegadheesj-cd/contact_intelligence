import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { useToastStore } from '../store/useToastStore';
import {
  LayoutDashboard,
  Users,
  ScanLine,
  QrCode,
  Nfc,
  UserCheck,
  LogOut,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);
  const { isSidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();

  const handleLogout = () => {
    logout();
    addToast('You have been logged out successfully.', 'info');
    navigate('/login', { replace: true });
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
    { name: 'Contacts', path: '/contacts', icon: <Users className="h-5 w-5" /> },
    { name: 'Card Scanner', path: '/scanner', icon: <ScanLine className="h-5 w-5" /> },
    { name: 'QR Code', path: '/qr', icon: <QrCode className="h-5 w-5" /> },
    { name: 'NFC Reader', path: '/nfc', icon: <Nfc className="h-5 w-5" /> },
    { name: 'Face Match', path: '/face', icon: <UserCheck className="h-5 w-5" /> },
    { name: 'Face History', path: '/face-history', icon: <ScanLine className="h-5 w-5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 bg-dot-grid-light flex flex-col md:flex-row relative">
      {/* Mobile Header */}
      <header className="md:hidden w-full h-16 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 z-40 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-650 animate-pulse" />
          <span className="font-extrabold text-slate-800 text-base tracking-tight">Contact Intelligence</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-slate-50 text-slate-550 rounded-lg outline-none cursor-pointer"
        >
          {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 md:sticky md:top-0 h-screen w-64 bg-zinc-950 text-zinc-400 z-50 flex flex-col shrink-0 border-r border-zinc-900 transition-transform duration-250 md:transform-none
          ${isSidebarOpen ? 'transform-none' : '-translate-x-full'}`}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-900">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-indigo-400" />
            <span className="font-extrabold text-white text-base tracking-tight">Contact Intelligence</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 text-zinc-400 hover:text-white rounded-lg outline-none cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 text-sm font-semibold rounded-lg transition-all duration-200 group border
                ${
                  isActive
                    ? 'bg-indigo-600/15 border-indigo-500/25 text-indigo-400 font-bold shadow-sm'
                    : 'bg-transparent border-transparent hover:bg-zinc-900/60 hover:text-zinc-200 hover:border-zinc-900'
                }`
              }
            >
              {item.icon}
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer (User Info & Logout) */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-900/20">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 px-2">
              <div className="h-9 w-9 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 flex items-center justify-center font-extrabold text-sm tracking-wide shrink-0">
                {(user?.fullName || user?.name || 'U').substring(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-zinc-200 truncate leading-none mb-1">
                  {user?.fullName || user?.name || 'Platform User'}
                </p>
                <p className="text-[10px] text-zinc-500 truncate leading-none">
                  {user?.email || 'user@enterprise.com'}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-350 rounded-lg transition-all cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-45 transition-opacity"
        />
      )}

      {/* Primary Layout Main Canvas */}
      <main className="flex-1 flex flex-col min-w-0 h-[calc(100vh-4rem)] md:h-screen overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl w-full mx-auto flex-1 flex flex-col animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

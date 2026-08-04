import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  Sun,
  Moon,
  Plus,
  Settings,
  HelpCircle,
  Sparkles,
  Eye,
  History
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);
  
  const { 
    isSidebarOpen, 
    toggleSidebar, 
    setSidebarOpen, 
    themeMode, 
    setThemeMode,
    cacheBypass,
    setCacheBypass,
    cosineThreshold,
    setCosineThreshold,
    deepIdentityScan,
    setDeepIdentityScan,
    serpApiKey,
    setSerpApiKey,
    tavilyApiKey,
    setTavilyApiKey,
    enableSoundAlerts,
    setEnableSoundAlerts
  } = useUIStore();

  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Custom states for Settings and Help dialog overlays
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // API key visibility states
  const [showSerpKey, setShowSerpKey] = useState(false);
  const [showTavilyKey, setShowTavilyKey] = useState(false);

  // Sync theme class with document root
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

  const handleLogout = () => {
    logout();
    addToast('You have been logged out successfully.', 'info');
    navigate('/login', { replace: true });
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard className="h-4.5 w-4.5" /> },
    { name: 'Contacts', path: '/contacts', icon: <Users className="h-4.5 w-4.5" /> },
    { name: 'Business Cards', path: '/scanner', icon: <ScanLine className="h-4.5 w-4.5" /> },
    { name: 'QR Scanner', path: '/qr', icon: <QrCode className="h-4.5 w-4.5" /> },
    { name: 'NFC Reader', path: '/nfc', icon: <Nfc className="h-4.5 w-4.5" /> },
    { name: 'Face Recognition', path: '/face', icon: <UserCheck className="h-4.5 w-4.5" /> },
    { name: 'Face History', path: '/face-history', icon: <History className="h-4.5 w-4.5" /> },
    { name: 'AI Intelligence', path: '/contacts', icon: <Sparkles className="h-4.5 w-4.5" />, badge: 'AI' },
    { name: 'Profile Discovery', path: '/contacts', icon: <Eye className="h-4.5 w-4.5" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 bg-dot-grid-light flex flex-col md:flex-row relative font-sans">
      
      {/* Top Navbar - Fixed */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-slate-100/80 flex items-center justify-between px-4 z-40 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSidebar}
            className="md:hidden p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg outline-none cursor-pointer"
          >
            {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-gradient-to-tr from-indigo-500 to-purple-650 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="h-5 w-5 animate-pulse-soft" />
            </div>
            <span className="font-extrabold text-slate-900 text-base tracking-tight hidden sm:inline-block">
              CI <span className="bg-gradient-to-r from-indigo-650 to-purple-650 bg-clip-text text-transparent">Intelligence</span>
            </span>
          </div>

          <div className="h-4 w-px bg-slate-100 hidden md:block" />

          {/* Activity Glow indicator */}
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100 text-[10px] font-bold">
            <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping" />
            <span>OSINT Engine Active</span>
          </div>
        </div>

        {/* Search and Navigation Tools */}
        <div className="flex items-center gap-4">
          
          {/* Global Search Bar */}
          <div className="relative hidden md:block w-64 lg:w-80">
            <input
              type="text"
              placeholder="Search contacts globally..."
              onFocus={() => navigate('/contacts')}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-150 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-50/50 rounded-lg text-xs outline-none transition-all duration-200"
            />
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Quick Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Actions</span>
            </button>
            
            {showQuickActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowQuickActions(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-lg py-1.5 z-50 animate-slide-down">
                  <button
                    onClick={() => { setShowQuickActions(false); navigate('/scanner'); }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <ScanLine className="h-3.5 w-3.5 text-slate-400" /> Scan Business Card
                  </button>
                  <button
                    onClick={() => { setShowQuickActions(false); navigate('/qr'); }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <QrCode className="h-3.5 w-3.5 text-slate-400" /> Scan QR Code
                  </button>
                  <button
                    onClick={() => { setShowQuickActions(false); navigate('/nfc'); }}
                    className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Nfc className="h-3.5 w-3.5 text-slate-400" /> Read NFC Card
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
            className="p-1.5 hover:bg-slate-50 text-slate-500 rounded-lg outline-none cursor-pointer transition-colors"
            title="Toggle Dark Mode"
          >
            {themeMode === 'dark' ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          {/* Notification bell with count badge */}
          <button className="p-1.5 hover:bg-slate-50 text-slate-550 rounded-lg relative outline-none cursor-pointer">
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-indigo-500 rounded-full border border-white animate-pulse" />
          </button>

          {/* User profile dropdown and metadata */}
          <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 border border-indigo-100 text-indigo-650 flex items-center justify-center font-extrabold text-xs tracking-wide shrink-0">
              {(user?.fullName || user?.name || 'U').substring(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar Navigation - Left */}
      <aside
        className={`fixed inset-y-0 left-0 pt-16 md:sticky md:top-16 h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] bg-zinc-950 text-zinc-400 z-30 flex flex-col shrink-0 border-r border-zinc-900 transition-all duration-250
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Toggle Collapse bar for sidebar - desktop only */}
        <div className="hidden md:flex justify-end px-3 py-2 border-b border-zinc-900">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 rounded-md cursor-pointer outline-none transition-colors"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Sidebar Nav Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 group border
                ${isCollapsed ? 'justify-center' : ''}
                ${
                  isActive
                    ? 'bg-indigo-600/15 border-indigo-500/25 text-indigo-400 font-bold shadow-xs'
                    : 'bg-transparent border-transparent hover:bg-zinc-900/60 hover:text-zinc-200 hover:border-zinc-900'
                }`
              }
              title={isCollapsed ? item.name : undefined}
            >
              {item.icon}
              {!isCollapsed && (
                <span className="flex-1 truncate">{item.name}</span>
              )}
              {!isCollapsed && item.badge && (
                <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 text-[9px] font-bold rounded">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer actions */}
        <div className="p-3 border-t border-zinc-900 bg-zinc-900/20">
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setShowSettings(true)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer
                ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Settings className="h-4.5 w-4.5 text-zinc-500" />
              {!isCollapsed && <span>Settings</span>}
            </button>
            
            <button
              onClick={() => setShowHelp(true)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer
                ${isCollapsed ? 'justify-center' : ''}`}
            >
              <HelpCircle className="h-4.5 w-4.5 text-zinc-500" />
              {!isCollapsed && <span>Help Center</span>}
            </button>

            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-350 rounded-lg transition-all cursor-pointer mt-2
                ${isCollapsed ? 'justify-center' : ''}`}
            >
              <LogOut className="h-4.5 w-4.5" />
              {!isCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-zinc-950/60 backdrop-blur-xs z-20 transition-opacity"
        />
      )}

      {/* Primary Layout Main Canvas */}
      <main className="flex-1 flex flex-col min-w-0 pt-16 h-screen overflow-y-auto">
        <div className="p-4 md:p-8 max-w-7xl w-full mx-auto flex-1 flex flex-col animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Settings Dialog Overlay */}
      {showSettings && (
        <div 
          onClick={() => setShowSettings(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg p-6 animate-slide-up relative overflow-hidden"
          >
            <button 
              onClick={() => setShowSettings(false)} 
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wider mb-1 flex items-center gap-2">
              <Settings className="h-4.5 w-4.5 text-indigo-500" /> Platform Settings
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5">
              Customize local search parameters, SerpApi credentials, and Tavily search rates.
            </p>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
              
              {/* Theme Settings */}
              <div className="p-3 bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-850 rounded-xl">
                <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-2">Display & Theme</h4>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-350">Dark Mode</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">Toggle dark visual mode for the dashboard</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={themeMode === 'dark'} 
                      onChange={(e) => setThemeMode(e.target.checked ? 'dark' : 'light')} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650" />
                  </label>
                </div>
              </div>

              {/* Engine Preferences */}
              <div className="p-3 bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-850 rounded-xl space-y-3">
                <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Engine Preferences</h4>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-350">Cache Bypass</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">Force live API scraping on queries</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={cacheBypass} 
                      onChange={(e) => setCacheBypass(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650" />
                  </label>
                </div>

                <div className="h-px bg-slate-100/50 dark:bg-zinc-850" />

                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-350">Deep Identity Scan</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">Enable deep OSINT search heuristics</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={deepIdentityScan} 
                      onChange={(e) => setDeepIdentityScan(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650" />
                  </label>
                </div>

                <div className="h-px bg-slate-100/50 dark:bg-zinc-850" />

                {/* Cosine Similarity Slider */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-350">Cosine Similarity Threshold</span>
                    <span className="font-mono text-xs font-bold text-indigo-500">{cosineThreshold.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.10" 
                    max="0.90" 
                    step="0.05" 
                    value={cosineThreshold} 
                    onChange={(e) => setCosineThreshold(parseFloat(e.target.value))} 
                    className="w-full h-1 bg-slate-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-650"
                  />
                  <div className="text-[9px] text-slate-400 dark:text-zinc-500">
                    Determines precision margin for face matches. Stricter &lt; 0.20 &lt; Lenient.
                  </div>
                </div>
              </div>

              {/* API Credentials */}
              <div className="p-3 bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-850 rounded-xl space-y-3">
                <h4 className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Third-Party APIs</h4>
                
                {/* SerpApi Key */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider">SerpApi Key</label>
                  <div className="relative">
                    <input 
                      type={showSerpKey ? "text" : "password"} 
                      placeholder="Enter SerpApi Credentials..." 
                      value={serpApiKey} 
                      onChange={(e) => setSerpApiKey(e.target.value)} 
                      className="w-full pl-3 pr-9 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg text-xs outline-none"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowSerpKey(!showSerpKey)} 
                      className="absolute right-2.5 top-2 text-slate-450 hover:text-indigo-500 dark:hover:text-indigo-400"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tavily Key */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 dark:text-zinc-400 uppercase tracking-wider">Tavily Key</label>
                  <div className="relative">
                    <input 
                      type={showTavilyKey ? "text" : "password"} 
                      placeholder="Enter Tavily Credentials..." 
                      value={tavilyApiKey} 
                      onChange={(e) => setTavilyApiKey(e.target.value)} 
                      className="w-full pl-3 pr-9 py-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-lg text-xs outline-none"
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowTavilyKey(!showTavilyKey)} 
                      className="absolute right-2.5 top-2 text-slate-450 hover:text-indigo-500 dark:hover:text-indigo-400"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sound Settings */}
              <div className="p-3 bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-100 dark:border-zinc-850 rounded-xl">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-350">Sound Alerts</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500">Play confirmation chime on successful scan/match</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={enableSoundAlerts} 
                      onChange={(e) => setEnableSoundAlerts(e.target.checked)} 
                      className="sr-only peer" 
                    />
                    <div className="w-9 h-5 bg-slate-200 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-650" />
                  </label>
                </div>
              </div>

            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="bg-indigo-650 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Close & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Dialog Overlay */}
      {showHelp && (
        <div 
          onClick={() => setShowHelp(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-xs"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-md p-6 animate-slide-up relative"
          >
            <button 
              onClick={() => setShowHelp(false)} 
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm font-bold text-slate-800 dark:text-zinc-100 uppercase tracking-wider mb-2 flex items-center gap-2">
              <HelpCircle className="h-4.5 w-4.5 text-indigo-500" /> Help Center & Guides
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
              Learn how to ingest contacts using Card scanning, QR Codes, NFC, and biometric face match.
            </p>
            <div className="space-y-4 font-semibold text-xs text-slate-700 dark:text-zinc-300">
              <div className="flex gap-2">
                <span className="text-indigo-500 font-bold">•</span>
                <p><b>Card Scanner:</b> Upload photos of business cards to extract fields using local OCR.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-indigo-500 font-bold">•</span>
                <p><b>Face Recognition:</b> Enroll contact photos and perform reverse face searches to locate LinkedIn profiles.</p>
              </div>
              <div className="flex gap-2">
                <span className="text-indigo-500 font-bold">•</span>
                <p><b>Identity Resolution:</b> Engine merges OSINT fields using 15 identity signals.</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHelp(false)}
                className="bg-indigo-650 hover:bg-indigo-700 text-white px-5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


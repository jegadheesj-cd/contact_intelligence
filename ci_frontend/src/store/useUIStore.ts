import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (isOpen: boolean) => void;
  
  // Theme Mode
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
  
  // Functional Settings
  cacheBypass: boolean;
  setCacheBypass: (enabled: boolean) => void;
  
  cosineThreshold: number;
  setCosineThreshold: (threshold: number) => void;
  
  deepIdentityScan: boolean;
  setDeepIdentityScan: (enabled: boolean) => void;
  
  enableSoundAlerts: boolean;
  setEnableSoundAlerts: (enabled: boolean) => void;

  // Third-Party API Keys
  serpApiKey: string;
  setSerpApiKey: (key: string) => void;
  
  tavilyApiKey: string;
  setTavilyApiKey: (key: string) => void;
  
  geminiApiKey: string;
  setGeminiApiKey: (key: string) => void;
  
  groqApiKey: string;
  setGroqApiKey: (key: string) => void;
  
  googleKnowledgeGraphApiKey: string;
  setGoogleKnowledgeGraphApiKey: (key: string) => void;
  
  phantombusterApiKey: string;
  setPhantombusterApiKey: (key: string) => void;
  
  scrapecreatorsApiKey: string;
  setScrapecreatorsApiKey: (key: string) => void;
}

const getStoredBool = (key: string, fallback: boolean): boolean => {
  const item = localStorage.getItem(key);
  return item !== null ? item === 'true' : fallback;
};

const getStoredNum = (key: string, fallback: number): number => {
  const item = localStorage.getItem(key);
  return item !== null ? parseFloat(item) : fallback;
};

const getStoredStr = (key: string, fallback: string): string => {
  const item = localStorage.getItem(key);
  return item !== null ? item : fallback;
};

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  
  // Theme Mode
  themeMode: (localStorage.getItem('themeMode') as 'light' | 'dark') || 'light',
  setThemeMode: (themeMode) => {
    localStorage.setItem('themeMode', themeMode);
    set({ themeMode });
  },

  // Functional Settings
  cacheBypass: getStoredBool('cacheBypass', true),
  setCacheBypass: (cacheBypass) => {
    localStorage.setItem('cacheBypass', String(cacheBypass));
    set({ cacheBypass });
  },

  cosineThreshold: getStoredNum('cosineThreshold', 0.20),
  setCosineThreshold: (cosineThreshold) => {
    localStorage.setItem('cosineThreshold', String(cosineThreshold));
    set({ cosineThreshold });
  },

  deepIdentityScan: getStoredBool('deepIdentityScan', true),
  setDeepIdentityScan: (deepIdentityScan) => {
    localStorage.setItem('deepIdentityScan', String(deepIdentityScan));
    set({ deepIdentityScan });
  },

  enableSoundAlerts: getStoredBool('enableSoundAlerts', true),
  setEnableSoundAlerts: (enableSoundAlerts) => {
    localStorage.setItem('enableSoundAlerts', String(enableSoundAlerts));
    set({ enableSoundAlerts });
  },

  // Third-Party API Keys
  serpApiKey: getStoredStr('serpApiKey', ''),
  setSerpApiKey: (serpApiKey) => {
    localStorage.setItem('serpApiKey', serpApiKey);
    set({ serpApiKey });
  },

  tavilyApiKey: getStoredStr('tavilyApiKey', ''),
  setTavilyApiKey: (tavilyApiKey) => {
    localStorage.setItem('tavilyApiKey', tavilyApiKey);
    set({ tavilyApiKey });
  },

  geminiApiKey: getStoredStr('geminiApiKey', ''),
  setGeminiApiKey: (geminiApiKey) => {
    localStorage.setItem('geminiApiKey', geminiApiKey);
    set({ geminiApiKey });
  },

  groqApiKey: getStoredStr('groqApiKey', ''),
  setGroqApiKey: (groqApiKey) => {
    localStorage.setItem('groqApiKey', groqApiKey);
    set({ groqApiKey });
  },

  googleKnowledgeGraphApiKey: getStoredStr('googleKnowledgeGraphApiKey', ''),
  setGoogleKnowledgeGraphApiKey: (googleKnowledgeGraphApiKey) => {
    localStorage.setItem('googleKnowledgeGraphApiKey', googleKnowledgeGraphApiKey);
    set({ googleKnowledgeGraphApiKey });
  },


  phantombusterApiKey: getStoredStr('phantombusterApiKey', ''),
  setPhantombusterApiKey: (phantombusterApiKey) => {
    localStorage.setItem('phantombusterApiKey', phantombusterApiKey);
    set({ phantombusterApiKey });
  },

  scrapecreatorsApiKey: getStoredStr('scrapecreatorsApiKey', ''),
  setScrapecreatorsApiKey: (scrapecreatorsApiKey) => {
    localStorage.setItem('scrapecreatorsApiKey', scrapecreatorsApiKey);
    set({ scrapecreatorsApiKey });
  },
}));

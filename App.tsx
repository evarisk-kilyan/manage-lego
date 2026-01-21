
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  BarChart3, 
  LayoutGrid, 
  Camera, 
  CheckCircle2, 
  BrainCircuit,
  Loader2,
  X,
  Box,
  ChevronRight,
  ExternalLink,
  Info,
  Layers,
  Grid,
  Activity,
  History,
  Trophy
} from 'lucide-react';
import { LegoSet, BuildStatus } from './types';
import { StatsCards } from './components/StatsCards';
import { Timer } from './components/Timer';
import { analyzeBuildPerformance, identifySetFromImage, searchLegoSet } from './services/geminiService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { translations, Language } from './translations';

const STORAGE_KEY = 'trackmybrick_sets_v2';
const LANG_KEY = 'trackmybrick_lang_v2';

type ViewMode = 'tracker' | 'gallery';

const App: React.FC = () => {
  const [sets, setSets] = useState<LegoSet[]>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>('tracker');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [groundingSources, setGroundingSources] = useState<{title: string, uri: string}[]>([]);
  const [lang, setLang] = useState<Language>((localStorage.getItem(LANG_KEY) as Language) || 'fr');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [newSetName, setNewSetName] = useState('');
  const [newSetNumber, setNewSetNumber] = useState('');
  const [newPieces, setNewPieces] = useState('');
  const [newBags, setNewBags] = useState('');
  const [newTheme, setNewTheme] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  const t = translations[lang];

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load sets", e);
      }
    }
  }, []);

  useEffect(() => {
    if (sets.length >= 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
    }
  }, [sets]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  const addSet = () => {
    const newSet: LegoSet = {
      id: crypto.randomUUID(),
      name: newSetName || 'Unnamed Set',
      setNumber: newSetNumber,
      totalPieces: parseInt(newPieces) || 0,
      totalBags: parseInt(newBags) || 1,
      image: newImageUrl,
      status: BuildStatus.PLANNING,
      sessions: [],
      currentBag: 0,
      createdAt: new Date().toISOString(),
      theme: newTheme,
    };
    setSets([newSet, ...sets]);
    setShowAddModal(false);
    resetForm();
    setActiveSetId(newSet.id);
  };

  const resetForm = () => {
    setNewSetName('');
    setNewSetNumber('');
    setNewPieces('');
    setNewBags('');
    setNewTheme('');
    setNewImageUrl('');
    setSearchQuery('');
    setGroundingSources([]);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setGroundingSources([]);
    try {
      const result = await searchLegoSet(searchQuery);
      if (result) {
        setNewSetName(result.name || '');
        setNewSetNumber(result.setNumber || '');
        setNewPieces(result.totalPieces?.toString() || '');
        setNewBags(result.totalBags?.toString() || '');
        setNewTheme(result.theme || '');
        setNewImageUrl(result.imageUrl || '');
        setGroundingSources(result.sources || []);
      }
    } catch (error) {
      console.error("Search failed", error);
    } finally {
      setSearchLoading(false);
    }
  };

  const deleteSet = (id: string) => {
    if (confirm(t.deleteConfirm)) {
      const updatedSets = sets.filter(s => s.id !== id);
      setSets(updatedSets);
      if (activeSetId === id) setActiveSetId(null);
    }
  };

  const handleLogBag = (seconds: number, bagNum: number) => {
    if (!activeSetId) return;
    setSets(prev => prev.map(s => {
      if (s.id === activeSetId) {
        const newSessions = [...s.sessions, {
          bagNumber: bagNum,
          durationInSeconds: seconds,
          timestamp: new Date().toISOString()
        }];
        const maxBag = Math.max(...newSessions.map(sess => sess.bagNumber));
        const isComplete = maxBag >= s.totalBags;
        return {
          ...s,
          sessions: newSessions,
          currentBag: maxBag,
          status: isComplete ? BuildStatus.COMPLETED : BuildStatus.IN_PROGRESS
        };
      }
      return s;
    }));
  };

  const handleAiAnalyze = async () => {
    if (sets.length === 0) return;
    setIsAnalyzing(true);
    try {
      const insight = await analyzeBuildPerformance(sets, lang);
      setAiInsight(insight);
    } catch (err) {
      setAiInsight("Failed analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCameraLoading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const result = await identifySetFromImage(base64);
      if (result) {
        setNewSetName(result.name || '');
        setNewSetNumber(result.setNumber || '');
        setNewPieces(result.totalPieces?.toString() || '');
        setNewBags(result.totalBags?.toString() || '');
        setNewTheme(result.theme || '');
      }
      setCameraLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const activeSet = sets.find(s => s.id === activeSetId);
  const bagGroups = activeSet?.sessions.reduce((acc, sess) => {
    const bagNum = sess.bagNumber;
    if (!acc[bagNum]) acc[bagNum] = 0;
    acc[bagNum] += sess.durationInSeconds;
    return acc;
  }, {} as Record<number, number>) || {};

  const chartData = Object.entries(bagGroups).map(([bag, seconds]) => ({
    name: `Bag ${bag}`,
    bag: parseInt(bag),
    seconds: seconds,
    minutes: Math.round((Number(seconds) / 60) * 10) / 10
  })).sort((a, b) => a.bag - b.bag);

  return (
    <div className="min-h-screen pb-20 bg-slate-50 selection:bg-red-200">
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-40 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {/* Lego 2x2 Brick Logo */}
          <div className="relative group cursor-pointer" onClick={() => setView('tracker')}>
            <div className="bg-[#E3000B] w-10 h-10 rounded-lg flex flex-wrap p-1 shadow-[0_4px_0_0_#991b1b] transform group-hover:-translate-y-1 transition-all">
               {[1, 2, 3, 4].map(i => (
                 <div key={i} className="w-1/2 h-1/2 p-0.5">
                    <div className="w-full h-full bg-[#E3000B] rounded-full border-2 border-[#FFD700] shadow-inner opacity-90"></div>
                 </div>
               ))}
               <div className="absolute top-0 left-0 w-full h-0.5 bg-white/20 rounded-t-lg"></div>
            </div>
          </div>
          <h1 className="text-2xl font-black text-slate-900 hidden sm:block tracking-tighter uppercase italic group-hover:text-red-600 transition-colors">
            TrackMy<span className="text-red-600 px-1 border-2 border-yellow-400 rounded-md shadow-sm ml-1">Brick</span>
          </h1>
        </div>
        
        <div className="flex gap-2 items-center">
          <div className="hidden md:flex bg-slate-100 rounded-xl p-1 mr-2 border border-slate-200">
            <button 
              onClick={() => setView('tracker')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${view === 'tracker' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Activity className="w-4 h-4" />
              {t.viewTracker}
            </button>
            <button 
              onClick={() => setView('gallery')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${view === 'gallery' ? 'bg-white shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Grid className="w-4 h-4" />
              {t.viewGallery}
            </button>
          </div>

          <div className="flex bg-slate-100 rounded-xl p-1 mr-2 border border-slate-200">
            <button onClick={() => setLang('en')} className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all ${lang === 'en' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>EN</button>
            <button onClick={() => setLang('fr')} className={`px-2 py-1 text-[10px] font-black rounded-lg transition-all ${lang === 'fr' ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>FR</button>
          </div>

          <button 
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="flex items-center gap-2 px-6 py-2 bg-[#FFD700] text-slate-900 rounded-xl font-black hover:bg-yellow-400 transition-all shadow-[4px_4px_0px_0px_rgba(202,138,4,0.3)] active:translate-y-1 active:shadow-none uppercase text-sm tracking-tight border-2 border-slate-900/5"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">{t.newSet}</span>
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md border border-slate-200 rounded-full p-2 shadow-2xl flex gap-2 z-50">
        <button onClick={() => setView('tracker')} className={`p-4 rounded-full ${view === 'tracker' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400'}`}><Activity className="w-6 h-6" /></button>
        <button onClick={() => setView('gallery')} className={`p-4 rounded-full ${view === 'gallery' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400'}`}><Grid className="w-6 h-6" /></button>
      </div>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {view === 'tracker' ? (
          <>
            <StatsCards sets={sets} lang={lang} />
            {aiInsight && (
              <div className="bg-white border-2 border-red-100 p-8 rounded-[2.5rem] mb-8 relative overflow-hidden group shadow-xl">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                  <BrainCircuit className="w-48 h-48 text-red-600" />
                </div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-red-50 p-3 rounded-2xl"><BrainCircuit className="w-6 h-6 text-red-600" /></div>
                  <h3 className="font-black text-2xl text-slate-800 uppercase tracking-tight italic">{t.masterBuilderInsights}</h3>
                  <button onClick={() => setAiInsight(null)} className="ml-auto p-2 hover:bg-slate-100 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed whitespace-pre-line text-lg">{aiInsight}</div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-1 space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h2 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><LayoutGrid className="w-4 h-4" />{t.buildQueue}</h2>
                  <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-lg uppercase tracking-wider">{sets.length} {t.projects}</span>
                </div>
                <div className="space-y-3 overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar pb-4">
                  {sets.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200">
                      <Plus className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t.noSets}</p>
                    </div>
                  )}
                  {sets.map(set => (
                    <button
                      key={set.id}
                      onClick={() => setActiveSetId(set.id)}
                      className={`w-full text-left p-4 rounded-[2rem] border-2 transition-all relative group overflow-hidden ${activeSetId === set.id ? 'bg-white border-red-500 shadow-xl' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'}`}
                    >
                      <div className="flex gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-50 flex-shrink-0 flex items-center justify-center overflow-hidden border border-slate-100">
                          {set.image ? <img src={set.image} alt={set.name} className="w-full h-full object-contain" /> : <Box className="w-8 h-8 text-slate-200" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-[8px] font-black px-1.5 py-0.5 rounded bg-slate-900 text-white uppercase">{set.theme || 'Expert'}</span>
                            <span className="text-[8px] font-black text-slate-400">#{set.setNumber}</span>
                          </div>
                          <h4 className="font-black text-slate-800 text-sm mb-1 truncate group-hover:text-red-600 transition-colors uppercase">{set.name}</h4>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold">
                            <span>{set.totalPieces} PIECES</span>
                            <span>{set.sessions.length}/{set.totalBags} BAGS</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-2 space-y-6">
                {!activeSet ? (
                  <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 p-12 text-center shadow-inner">
                    <div className="bg-slate-50 p-10 rounded-full mb-6 border-4 border-white shadow-xl"><Layers className="w-16 h-16 text-slate-200" /></div>
                    <h3 className="text-2xl font-black text-slate-300 uppercase italic tracking-tighter mb-2">{t.buildStandby}</h3>
                    <p className="text-slate-400 max-w-xs font-medium">{t.selectProject}</p>
                  </div>
                ) : (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-8 items-center md:items-start relative">
                      <div className="absolute top-8 right-8 flex gap-2">
                        <button onClick={handleAiAnalyze} className="p-3 text-red-600 hover:bg-red-50 rounded-2xl transition-all"><BrainCircuit className="w-6 h-6" /></button>
                        <button onClick={() => deleteSet(activeSet.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><Trash2 className="w-6 h-6" /></button>
                      </div>
                      <div className="w-48 h-48 bg-slate-50 rounded-[2.5rem] flex items-center justify-center overflow-hidden border-4 border-white shadow-inner flex-shrink-0 group">
                        {activeSet.image ? <img src={activeSet.image} alt={activeSet.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" /> : <Box className="w-20 h-20 text-slate-100" />}
                      </div>
                      <div className="flex-1 text-center md:text-left">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase mb-1">{activeSet.name}</h2>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-6">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">#{activeSet.setNumber}</span>
                          <span className="w-1 h-1 bg-red-600 rounded-full"></span>
                          <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{activeSet.totalPieces} {t.pieces.toUpperCase()}</span>
                          <span className="w-1 h-1 bg-yellow-400 rounded-full"></span>
                          <span className="text-xs font-black text-red-600 uppercase tracking-widest">{activeSet.theme}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div className="bg-slate-50 p-4 rounded-3xl border border-white shadow-sm">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.status}</div>
                            <div className="text-xs font-black uppercase text-red-600">
                              {activeSet.status === BuildStatus.COMPLETED ? t.completed : activeSet.status === BuildStatus.IN_PROGRESS ? t.inProgress : t.planning}
                            </div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-3xl border border-white shadow-sm">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.timeLog}</div>
                            <div className="text-sm font-black text-slate-800">{Math.floor(activeSet.sessions.reduce((a, b) => a + Number(b.durationInSeconds), 0) / 60)}m</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-3xl border border-white shadow-sm">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.bags}</div>
                            <div className="text-sm font-black text-slate-800">{activeSet.currentBag}/{activeSet.totalBags}</div>
                          </div>
                          <div className="bg-slate-50 p-4 rounded-3xl border border-white shadow-sm">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.speed}</div>
                            <div className="text-sm font-black text-slate-800">{activeSet.sessions.length > 0 ? (Number(activeSet.totalPieces) / (activeSet.sessions.reduce((a, b) => a + Number(b.durationInSeconds), 0) / 60 || 1)).toFixed(1) : '0'} {t.ppm}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    {activeSet.status !== BuildStatus.COMPLETED && <Timer onSave={handleLogBag} currentBag={activeSet.currentBag} totalBags={activeSet.totalBags} lang={lang} />}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                        <h3 className="font-black text-slate-800 uppercase tracking-tight mb-8 flex items-center gap-2 italic"><BarChart3 className="w-6 h-6 text-red-600" /> {t.paceChart}</h3>
                        <div className="h-72 w-full">
                          {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                                <YAxis fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} unit="m" tick={{ fill: '#94a3b8' }} />
                                <Tooltip cursor={{ fill: '#fef2f2' }} contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                                <Bar dataKey="minutes" fill="#ef4444" radius={[8, 8, 8, 8]} barSize={32}>
                                   {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#ef4444' : '#fbbf24'} />)}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : <div className="h-full flex flex-col items-center justify-center text-slate-300 text-sm font-black uppercase tracking-widest gap-2">{t.logBagPrompt}</div>}
                        </div>
                      </div>
                      <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col max-h-[450px]">
                        <h3 className="font-black text-slate-800 uppercase tracking-tight mb-6 italic"><History className="w-5 h-5 inline mr-2 text-red-600" />{t.bagHistory}</h3>
                        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
                          {activeSet.sessions.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase tracking-widest text-xs italic">{t.archiveEmpty}</div>}
                          {activeSet.sessions.slice().reverse().map((sess, idx) => (
                            <div key={idx} className="group flex items-center justify-between p-4 bg-slate-50 rounded-[1.5rem] border-2 border-transparent hover:border-red-500 transition-all hover:shadow-md">
                              <div className="flex items-center gap-4">
                                <div className="bg-white w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center font-black text-slate-500 shadow-sm group-hover:bg-red-600 group-hover:text-white group-hover:border-red-600 transition-colors">{sess.bagNumber}</div>
                                <div>
                                  <div className="text-base font-black text-slate-800 tracking-tight italic">{Math.floor(Number(sess.durationInSeconds) / 60)}m {Number(sess.durationInSeconds) % 60}s</div>
                                  <div className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{new Date(sess.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                              </div>
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6">
              <div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tighter italic uppercase mb-2">{t.myCollection}</h2>
                <p className="text-slate-500 font-medium">{t.collectionSummary}</p>
              </div>
              <div className="bg-red-600 text-white p-6 rounded-[2.5rem] shadow-xl flex items-center gap-6 border-b-4 border-red-800">
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{t.setsCompleted}</div>
                  <div className="text-3xl font-black">{sets.filter(s => s.status === BuildStatus.COMPLETED).length}</div>
                </div>
                <div className="w-px h-10 bg-white/20"></div>
                <div className="text-center">
                  <div className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{t.pieces}</div>
                  <div className="text-3xl font-black">{sets.reduce((acc, s) => acc + s.totalPieces, 0)}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {sets.map(set => (
                <div key={set.id} className="bg-white group rounded-[3rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                  <div className="h-64 bg-slate-50 relative p-8 flex items-center justify-center border-b border-slate-50 overflow-hidden">
                    {set.image ? (
                      <img src={set.image} alt={set.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <Box className="w-24 h-24 text-slate-100" />
                    )}
                    <div className="absolute top-6 left-6 flex flex-col gap-2">
                      <span className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">{set.theme || 'Expert'}</span>
                      <span className="bg-yellow-400 text-slate-900 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-lg">#{set.setNumber}</span>
                    </div>
                    {set.status === BuildStatus.COMPLETED && (
                      <div className="absolute top-6 right-6 bg-green-500 text-white p-2 rounded-full shadow-lg">
                        <Trophy className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div className="p-8">
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-4 truncate group-hover:text-red-600 transition-colors">{set.name}</h3>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.pieces}</span>
                        <span className="font-black text-slate-800">{set.totalPieces}</span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.status}</span>
                        <span className={`font-black uppercase text-xs ${set.status === BuildStatus.COMPLETED ? 'text-green-500' : 'text-blue-500'}`}>
                          {set.status === BuildStatus.COMPLETED ? t.completed : set.status === BuildStatus.IN_PROGRESS ? t.inProgress : t.planning}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setView('tracker'); setActiveSetId(set.id); }}
                      className="w-full bg-slate-50 text-slate-900 py-4 rounded-2xl font-black uppercase italic tracking-tighter hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      {t.details}
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {sets.length === 0 && (
                <div className="col-span-full py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100">
                  <Box className="w-24 h-24 text-slate-100 mx-auto mb-6" />
                  <h4 className="text-2xl font-black text-slate-300 uppercase italic tracking-tighter mb-4">{t.noSets}</h4>
                  <button onClick={() => setShowAddModal(true)} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase italic tracking-tighter hover:bg-red-700 transition-all shadow-xl active:scale-95">{t.newSet}</button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in duration-300 my-8">
            <div className="bg-red-600 p-8 flex justify-between items-center relative overflow-hidden">
              <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 2px, transparent 0)', backgroundSize: '20px 20px' }}></div>
              <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter relative z-10">{t.newBuild}</h2>
              <button onClick={() => setShowAddModal(false)} className="p-3 bg-white/20 hover:bg-white/40 rounded-2xl transition-all relative z-10 active:scale-90"><X className="w-6 h-6 text-white" /></button>
            </div>
            <div className="p-10 space-y-8">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder={t.searchPlaceholder} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} className="w-full bg-slate-50 border-2 border-slate-100 focus:border-red-500 rounded-2xl p-4 pl-12 outline-none transition-all font-bold shadow-sm" />
                  </div>
                  <button onClick={handleSearch} disabled={searchLoading} className="bg-slate-900 text-white px-6 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2">
                    {searchLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : t.search}
                  </button>
                </div>
                {newImageUrl && (
                  <div className="flex items-center gap-4 bg-green-50 p-4 rounded-2xl border border-green-100 animate-in zoom-in">
                    <div className="w-20 h-20 bg-white rounded-xl overflow-hidden border border-green-100 flex-shrink-0">
                      <img src={newImageUrl} alt="Set Preview" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <div className="text-green-800 font-black text-xs uppercase tracking-widest">Image Trouvée !</div>
                      <p className="text-[10px] text-green-600 font-medium">Récupérée depuis le store officiel.</p>
                    </div>
                  </div>
                )}
                {groundingSources.length > 0 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 animate-in fade-in">
                    <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-xs uppercase tracking-widest"><Info className="w-4 h-4" />{t.sources}</div>
                    <div className="flex flex-wrap gap-2">
                      {groundingSources.map((source, i) => (
                        <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1 font-bold">
                          {source.title.length > 20 ? source.title.substring(0, 20) + '...' : source.title}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-center">
                <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-3 p-6 border-4 border-dashed border-slate-100 rounded-[2rem] hover:border-red-500 hover:bg-red-50 transition-all group w-full relative shadow-inner">
                  {cameraLoading ? <Loader2 className="w-10 h-10 text-red-500 animate-spin" /> : <Camera className="w-8 h-8 text-slate-300 group-hover:text-red-500" />}
                  <p className="font-black text-slate-800 uppercase italic tracking-tight text-xs">{t.scanBox}</p>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.name}</label>
                  <input type="text" value={newSetName} onChange={e => setNewSetName(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-red-500 rounded-[1.2rem] p-4 outline-none transition-all font-bold shadow-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.serial}</label>
                  <input type="text" value={newSetNumber} onChange={e => setNewSetNumber(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-red-500 rounded-[1.2rem] p-4 outline-none transition-all font-bold shadow-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.theme}</label>
                  <input type="text" value={newTheme} onChange={e => setNewTheme(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-red-500 rounded-[1.2rem] p-4 outline-none transition-all font-bold shadow-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.pieces}</label>
                  <input type="number" value={newPieces} onChange={e => setNewPieces(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-red-500 rounded-[1.2rem] p-4 outline-none transition-all font-bold shadow-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">{t.bagsLabel}</label>
                  <input type="number" value={newBags} onChange={e => setNewBags(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-red-500 rounded-[1.2rem] p-4 outline-none transition-all font-bold shadow-sm" />
                </div>
              </div>
              <button onClick={addSet} className="w-full bg-slate-900 text-white p-5 rounded-[1.8rem] font-black uppercase italic tracking-tighter text-lg hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-[0_8px_0_0_#991b1b] active:translate-y-1 active:shadow-none">
                <Plus className="w-6 h-6 text-red-500" /> {t.initializeBuild}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>
    </div>
  );
};

export default App;

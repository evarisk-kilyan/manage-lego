
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Save, RotateCcw, Box, Hash } from 'lucide-react';
import { translations, Language } from '../translations';

interface TimerProps {
  onSave: (seconds: number, bagNumber: number) => void;
  currentBag: number;
  totalBags: number;
  lang: Language;
}

export const Timer: React.FC<TimerProps> = ({ onSave, currentBag, totalBags, lang }) => {
  const t = translations[lang];
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [bagNumber, setBagNumber] = useState(currentBag + 1);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    setBagNumber(currentBag + 1);
  }, [currentBag]);

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const toggle = () => setIsActive(!isActive);
  
  const reset = () => {
    setIsActive(false);
    setSeconds(0);
  };

  const save = () => {
    onSave(seconds, bagNumber);
    reset();
    setBagNumber(prev => prev + 1);
  };

  const formatTime = (total: number) => {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col gap-6 border-4 border-yellow-400">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="bg-yellow-400 p-3 rounded-2xl text-slate-900">
            <Box className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-yellow-400 uppercase tracking-wider">{t.activeSession}</h3>
            <div className="flex items-center gap-2 mt-1">
              <Hash className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 font-medium">{t.buildingBag}:</span>
              <input 
                type="number" 
                value={bagNumber}
                onChange={(e) => setBagNumber(parseInt(e.target.value) || 1)}
                className="bg-slate-800 border-0 rounded-lg px-3 py-1 w-16 text-white font-bold focus:ring-2 focus:ring-yellow-400 outline-none"
                min="1"
                max={totalBags + 5}
              />
              <span className="text-slate-500 text-sm">of {totalBags}</span>
            </div>
          </div>
        </div>

        <div className="text-6xl font-mono font-bold tracking-tighter tabular-nums text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          {formatTime(seconds)}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className={`p-4 rounded-full transition-all shadow-lg active:scale-95 ${isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
          >
            {isActive ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
          </button>
          <button
            onClick={reset}
            className="p-4 rounded-full bg-slate-700 hover:bg-slate-600 transition-all shadow-lg active:scale-95"
          >
            <RotateCcw className="w-6 h-6" />
          </button>
          <button
            onClick={save}
            disabled={seconds === 0}
            className="flex items-center gap-2 bg-yellow-400 text-slate-900 px-8 py-4 rounded-2xl font-black hover:bg-yellow-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95 uppercase text-sm"
          >
            <Save className="w-5 h-5" />
            {t.finishBag}
          </button>
        </div>
      </div>
    </div>
  );
};

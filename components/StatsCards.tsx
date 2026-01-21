
import React from 'react';
import { LegoSet } from '../types';
import { Clock, Box, Layers, Zap } from 'lucide-react';
import { translations, Language } from '../translations';

interface StatsProps {
  sets: LegoSet[];
  lang: Language;
}

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

export const StatsCards: React.FC<StatsProps> = ({ sets, lang }) => {
  const t = translations[lang];
  const completedSets = sets.filter(s => s.status === 'COMPLETED');
  const totalSeconds = sets.reduce((acc, s) => acc + s.sessions.reduce((a, sess) => a + sess.durationInSeconds, 0), 0);
  const totalPieces = sets.reduce((acc, s) => acc + (s.status === 'COMPLETED' ? s.totalPieces : 0), 0);
  const totalBags = sets.reduce((acc, s) => acc + s.sessions.length, 0);
  
  const avgBagTime = totalBags > 0 ? totalSeconds / totalBags : 0;
  const ppm = totalSeconds > 0 ? (totalPieces / (totalSeconds / 60)).toFixed(1) : '0';

  const stats = [
    { label: t.totalBuildTime, value: formatDuration(totalSeconds), icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: t.setsCompleted, value: completedSets.length.toString(), icon: Layers, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: t.avgBagTime, value: formatDuration(avgBagTime), icon: Box, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: `${t.speed} (${t.ppm})`, value: ppm, icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, idx) => (
        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <span className="text-sm font-medium text-slate-500">{stat.label}</span>
          </div>
          <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
        </div>
      ))}
    </div>
  );
};

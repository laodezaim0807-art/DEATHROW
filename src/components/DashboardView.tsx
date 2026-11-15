import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CheckCircle2,
  FolderKanban,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateTime, getRiskTextClass } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';
import type { NavPageId } from './LayoutShell';
import { DashboardPanelSkeleton } from './Skeletons';
import { useToast } from './ToastProvider';
import type { AuthUser, SatriaDashboardData, SatriaPillar } from '../types/satria';

interface DashboardViewProps {
  user: AuthUser;
  data: SatriaDashboardData;
  onNavigate: (page: NavPageId) => void;
  onMarkNotificationRead: (id: string) => void;
  onRefreshData: () => Promise<boolean>;
}

const DOMAIN_SHORT_NAMES: Record<SatriaPillar, string> = {
  'Disinformasi & Hoaks': 'Disinformasi',
  'Rekayasa Sosial & Impersonasi': 'Rekayasa Sosial',
  'Analisis Narasi & Sentimen': 'Narasi & Sentimen',
  'Operasi Kognitif & Bot': 'Operasi Kognitif',
};

function toLocalDateKey(dateInput: Date | string): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DashboardView({
  user,
  data,
  onNavigate,
  onMarkNotificationRead,
  onRefreshData,
}: DashboardViewProps) {
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user.role === 'admin';
  const totalAnalyses = data.socialAnalyses.length + data.phishingAnalyses.length;
  const openIncidents = data.incidents.filter((i) => i.status !== 'Selesai').length;
  const totalIncidents = data.incidents.length;

  const highRiskSocialCount =
    data.socialAnalyses.filter((s) => s.sentiment === 'Negatif').length +
    data.phishingAnalyses.filter((p) => p.riskCategory === 'Tinggi').length;

  const anomalyActivityCount = data.securityLogs.filter(
    (l) =>
      l.status === 'Gagal' ||
      l.status === 'Diblokir' ||
      l.status === 'Peringatan' ||
      l.severity === 'Tinggi' ||
      l.severity === 'Kritis',
  ).length;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const ok = await onRefreshData();
      if (ok) {
        showToast({
          variant: 'info',
          title: 'Data Siber Sosial disegarkan',
          description: 'Ringkasan narasi, log aktivitas, dan kasus terbaru telah dimuat.',
        });
      } else {
        showToast({
          variant: 'error',
          title: 'Gagal menyegarkan data',
          description: 'Server tidak merespons. Coba beberapa saat lagi.',
        });
      }
    } finally {
      setRefreshing(false);
    }
  }

  // Build 6-day time series from Siber Sosial timestamps using local calendar day
  const dayBuckets = new Map<
    string,
    { label: string; normal: number; verifikasi: number; risikoTinggi: number }
  >();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400 * 1000);
    const key = toLocalDateKey(d);
    const label = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
    }).format(d);
    dayBuckets.set(key, { label, normal: 0, verifikasi: 0, risikoTinggi: 0 });
  }

  for (const soc of data.socialAnalyses) {
    const key = toLocalDateKey(soc.createdAt);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    if (soc.sentiment === 'Negatif') bucket.risikoTinggi += 1;
    else if (soc.sentiment === 'Netral') bucket.verifikasi += 1;
    else bucket.normal += 1;
  }

  for (const ph of data.phishingAnalyses) {
    const key = toLocalDateKey(ph.createdAt);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    if (ph.riskCategory === 'Tinggi') bucket.risikoTinggi += 1;
    else if (ph.riskCategory === 'Sedang') bucket.verifikasi += 1;
    else bucket.normal += 1;
  }

  for (const log of data.securityLogs) {
    const key = toLocalDateKey(log.timestamp);
    const bucket = dayBuckets.get(key);
    if (!bucket) continue;
    if (log.severity === 'Tinggi' || log.severity === 'Kritis') {
      bucket.risikoTinggi += 1;
    } else if (log.status === 'Peringatan' || log.severity === 'Sedang') {
      bucket.verifikasi += 1;
    } else {
      bucket.normal += 1;
    }
  }

  const activitySeries = Array.from(dayBuckets.values());

  // Build 4-sub-domain Siber Sosial counts
  const pillarCounts: Record<SatriaPillar, number> = {
    'Disinformasi & Hoaks': 0,
    'Rekayasa Sosial & Impersonasi': 0,
    'Analisis Narasi & Sentimen': 0,
    'Operasi Kognitif & Bot': 0,
  };

  for (const p of data.phishingAnalyses) {
    if (p.pillar in pillarCounts) pillarCounts[p.pillar] += 1;
  }
  for (const s of data.socialAnalyses) {
    if (s.pillar in pillarCounts) pillarCounts[s.pillar] += 1;
  }
  for (const inc of data.incidents) {
    if (inc.pillar in pillarCounts) pillarCounts[inc.pillar] += 1;
  }
  for (const log of data.securityLogs) {
    if (log.pillar in pillarCounts) pillarCounts[log.pillar] += 1;
  }

  const categorySeries = (Object.keys(pillarCounts) as SatriaPillar[]).map((pillar) => ({
    name: DOMAIN_SHORT_NAMES[pillar],
    fullName: pillar,
    jumlah: pillarCounts[pillar],
  }));

  const recentLogs = data.securityLogs.slice(0, 6);
  const recentNotifications = data.notifications.slice(0, 4);

  const kpiCards = [
    {
      title: 'Total Analisis Siber Sosial',
      value: totalAnalyses,
      detail: `${data.socialAnalyses.length} narasi media · ${data.phishingAnalyses.length} rekayasa sosial`,
      icon: MessageSquareWarning,
      iconColor: 'text-emerald-400',
      valueColor: 'text-white',
      target: 'social' as NavPageId,
      actionLabel: 'Buka Analisis',
    },
    {
      title: 'Kasus Siber Sosial',
      value: totalIncidents,
      detail: `${openIncidents} kasus aktif butuh klarifikasi`,
      icon: FolderKanban,
      iconColor: 'text-sky-400',
      valueColor: 'text-white',
      target: 'incidents' as NavPageId,
      actionLabel: 'Kelola Kasus',
    },
    {
      title: 'Konten Risiko & Sentimen Negatif',
      value: highRiskSocialCount,
      detail: 'Klaim provokatif & umpan impersonasi',
      icon: ShieldAlert,
      iconColor: 'text-red-400',
      valueColor: 'text-red-400',
      target: 'phishing' as NavPageId,
      actionLabel: 'Tinjau Risiko',
    },
    {
      title: 'Anomali & Peringatan Sosial',
      value: anomalyActivityCount,
      detail: 'Lonjakan bot, DM palsu & peringatan',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      valueColor: 'text-amber-400',
      target: 'monitoring' as NavPageId,
      actionLabel: 'Pantau Tren',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Operational Overview & Active Role Context */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-[#1B2B48]">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
            {isAdmin ? (
              <span className="text-red-400 font-semibold flex items-center gap-1">
                <UserCog className="w-3.5 h-3.5" />
                Sesi Admin Siber Sosial
              </span>
            ) : (
              <span className="text-sky-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Sesi Analyst Siber Sosial
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{user.organization}</span>
            <span aria-hidden="true">·</span>
            <span>{data.mode === 'demo' ? 'Mode DEMO Lokal' : 'Supabase Live'}</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Selamat datang, {user.name}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isAdmin
              ? 'Anda memiliki kendali penuh ruang Siber Sosial: analisis narasi publik, simulasi lonjakan bot/hoaks, penghapusan tiket kasus, dan ekspor laporan terpadu.'
              : 'Anda berada pada mode Analyst Siber Sosial: evaluasi narasi media sosial, deteksi rekayasa sosial DM/bio, pencatatan bukti kasus, dan unduh laporan PDF.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={refreshing}
            onClick={() => void handleRefresh()}
            className="py-2.5 px-3.5 rounded-lg bg-[#0E1A33] hover:bg-[#152548] border border-[#24375C] text-xs font-medium text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-400' : ''}`} />
            <span>{refreshing ? 'Menyegarkan...' : 'Segarkan'}</span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('social')}
            className="py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <MessageSquareWarning className="w-3.5 h-3.5" />
            <span>Analisis Narasi Sosial</span>
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('phishing')}
            className="py-2.5 px-4 rounded-lg bg-[#101C36] hover:bg-[#17284B] border border-[#24375C] text-xs font-semibold text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Deteksi Rekayasa Sosial</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>

      {refreshing ? (
        <DashboardPanelSkeleton />
      ) : (
        <>
          {/* Interactive 4 KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {kpiCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.button
                  key={card.title}
                  type="button"
                  onClick={() => onNavigate(card.target)}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className="text-left p-5 rounded-xl bg-[#0B1428] hover:bg-[#0E1932] border border-[#1B2B48] hover:border-[#2C4470] transition-colors group"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{card.title}</span>
                    <Icon className={`w-4 h-4 ${card.iconColor}`} />
                  </div>
                  <div className={`mt-3 text-3xl font-bold font-mono tabular-nums ${card.valueColor}`}>
                    <AnimatedNumber value={card.value} />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-400 truncate">{card.detail}</span>
                    <span className="text-sky-400 opacity-80 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                      {card.actionLabel}
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7 p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48]"
            >
              <div className="mb-4">
                <h2 className="text-base font-semibold text-white">
                  Tren Aktivitas Siber Sosial (6 Hari Terakhir)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Perbandingan narasi edukatif, konten perlu verifikasi, dan risiko manipulasi tinggi
                </p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <AreaChart data={activitySeries} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRisiko" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradWarn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradAman" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B2B48" />
                    <XAxis dataKey="label" stroke="#64748B" fontSize={12} />
                    <YAxis stroke="#64748B" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#091226',
                        borderColor: '#24375C',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#F1F5F9',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="risikoTinggi"
                      name="Risiko / Sentimen Negatif"
                      stroke="#EF4444"
                      fill="url(#gradRisiko)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="verifikasi"
                      name="Perlu Verifikasi"
                      stroke="#F59E0B"
                      fill="url(#gradWarn)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="normal"
                      name="Edukatif / Normal"
                      stroke="#22C55E"
                      fill="url(#gradAman)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48]"
            >
              <div className="mb-4">
                <h2 className="text-base font-semibold text-white">
                  Distribusi 4 Sub-Domain Siber Sosial
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Akumulasi aktivitas Disinformasi, Rekayasa Sosial, Narasi, dan Operasi Kognitif
                </p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <BarChart data={categorySeries} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1B2B48" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                    <YAxis stroke="#64748B" fontSize={12} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#091226',
                        borderColor: '#24375C',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#F1F5F9',
                      }}
                    />
                    <Bar dataKey="jumlah" name="Total Aktivitas" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          {/* Bottom Row: Recent Activity Table + Notifications Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-8 p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-white">Aktivitas Siber Sosial Terbaru</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Rekaman pemantauan narasi, rekayasa sosial, dan simulasi berlabel DEMO
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('monitoring')}
                  className="text-xs font-medium text-sky-400 hover:text-sky-300 whitespace-nowrap transition-colors"
                >
                  Lihat Semua Log
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1B2B48] text-[11px] font-semibold text-slate-400">
                      <th className="py-2.5 pr-3">Waktu</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3">Keparahan</th>
                      <th className="py-2.5 px-3">Peristiwa</th>
                      <th className="py-2.5 pl-3 text-right">Sumber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#15223C] text-xs">
                    {recentLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada aktivitas Siber Sosial yang tercatat.
                        </td>
                      </tr>
                    ) : (
                      recentLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-[#0F1B35]/60 transition-colors">
                          <td className="py-3 pr-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                            {formatDateTime(log.timestamp)}
                          </td>
                          <td className="py-3 px-3 text-slate-200 whitespace-nowrap">{log.category}</td>
                          <td
                            className={`py-3 px-3 font-semibold whitespace-nowrap ${getRiskTextClass(
                              log.severity,
                            )}`}
                          >
                            {log.severity}
                          </td>
                          <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{log.event}</td>
                          <td className="py-3 pl-3 text-right font-mono whitespace-nowrap">
                            <span
                              className={
                                log.sourceType === 'DEMO' ? 'text-amber-400' : 'text-emerald-400'
                              }
                            >
                              {log.sourceType}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-4 p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BellRing className="w-4 h-4 text-red-400" />
                  <h2 className="text-base font-semibold text-white">Peringatan Siber Sosial</h2>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {data.notifications.filter((n) => !n.read).length} baru
                </span>
              </div>

              <div className="space-y-3">
                {recentNotifications.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">
                    Belum ada peringatan Siber Sosial terbaru.
                  </p>
                ) : (
                  recentNotifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      layout
                      className={`p-3.5 rounded-lg border transition-colors ${
                        notif.read
                          ? 'bg-[#081022] border-[#172540] opacity-75'
                          : 'bg-[#0F1B35] border-[#253B63]'
                      }`}
                    >
                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className={`font-semibold ${getRiskTextClass(notif.severity)}`}>
                        {notif.severity} · {notif.category}
                      </span>
                      <span className="font-mono tabular-nums">
                        {notif.isDemo ? 'DEMO' : 'LIVE'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs font-semibold text-white">{notif.title}</div>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="font-mono text-slate-500 tabular-nums">
                        {formatDateTime(notif.createdAt)}
                      </span>
                      {!notif.read ? (
                        <button
                          type="button"
                          onClick={() => {
                            onMarkNotificationRead(notif.id);
                            showToast({
                              variant: 'success',
                              title: 'Notifikasi ditandai dibaca',
                            });
                          }}
                          className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
                        >
                          Tandai Dibaca
                        </button>
                      ) : (
                        <span className="text-emerald-500 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Dibaca
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

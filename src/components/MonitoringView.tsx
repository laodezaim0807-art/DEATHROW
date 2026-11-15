import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  AlertOctagon,
  Filter,
  Info,
  Loader2,
  Lock,
  PlusCircle,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { formatDateTime, getRiskTextClass } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';
import { TableSkeleton } from './Skeletons';
import { useToast } from './ToastProvider';
import type { AuthUser, LogCategory, SecurityLog, SeverityLevel } from '../types/satria';

interface MonitoringViewProps {
  user: AuthUser;
  logs: SecurityLog[];
  onLogAdded: (log: SecurityLog) => void;
}

const CATEGORIES: Array<LogCategory | 'Semua'> = [
  'Semua',
  'Siber Sosial',
  'Rekayasa Sosial',
  'Disinformasi',
  'Investigasi Kasus',
  'Autentikasi',
  'Sistem',
];

const SEVERITIES: Array<SeverityLevel | 'Semua'> = [
  'Semua',
  'Rendah',
  'Sedang',
  'Tinggi',
  'Kritis',
];

export function MonitoringView({ user, logs, onLogAdded }: MonitoringViewProps) {
  const { showToast } = useToast();
  const isAdmin = user.role === 'admin';
  const [quickView, setQuickView] = useState<'all' | 'social' | 'alerts'>('all');
  const [categoryFilter, setCategoryFilter] = useState<LogCategory | 'Semua'>('Semua');
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'Semua'>('Semua');
  const [sourceFilter, setSourceFilter] = useState<'Semua' | 'APP LOG' | 'DEMO'>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [isFilteringSkeleton, setIsFilteringSkeleton] = useState(false);
  const filterTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (filterTimerRef.current !== null) {
        window.clearTimeout(filterTimerRef.current);
      }
    };
  }, []);

  const hasActiveFilters =
    quickView !== 'all' ||
    categoryFilter !== 'Semua' ||
    severityFilter !== 'Semua' ||
    sourceFilter !== 'Semua' ||
    searchQuery.trim().length > 0;

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (
        quickView === 'social' &&
        !['Siber Sosial', 'Rekayasa Sosial', 'Disinformasi'].includes(log.category)
      ) {
        return false;
      }
      if (
        quickView === 'alerts' &&
        !(
          log.status === 'Peringatan' ||
          log.status === 'Diblokir' ||
          log.status === 'Gagal' ||
          log.severity === 'Tinggi' ||
          log.severity === 'Kritis'
        )
      ) {
        return false;
      }
      if (categoryFilter !== 'Semua' && log.category !== categoryFilter) return false;
      if (severityFilter !== 'Semua' && log.severity !== severityFilter) return false;
      if (sourceFilter !== 'Semua' && log.sourceType !== sourceFilter) return false;
      if (
        q &&
        !`${log.actor} ${log.event} ${log.ipAddress} ${log.category} ${log.pillar}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [logs, quickView, categoryFilter, severityFilter, sourceFilter, searchQuery]);

  const socialIntelLogsCount = logs.filter((l) =>
    ['Siber Sosial', 'Rekayasa Sosial', 'Disinformasi'].includes(l.category),
  ).length;
  const blockedOrFailedCount = logs.filter(
    (l) => l.status === 'Gagal' || l.status === 'Diblokir',
  ).length;
  const highSeverityLogs = logs.filter(
    (l) => l.severity === 'Tinggi' || l.severity === 'Kritis',
  );

  function triggerQuickView(next: 'all' | 'social' | 'alerts') {
    setQuickView(next);
    setIsFilteringSkeleton(true);
    if (filterTimerRef.current !== null) {
      window.clearTimeout(filterTimerRef.current);
    }
    filterTimerRef.current = window.setTimeout(() => {
      setIsFilteringSkeleton(false);
    }, 180);
  }

  function handleResetFilters() {
    setQuickView('all');
    setCategoryFilter('Semua');
    setSeverityFilter('Semua');
    setSourceFilter('Semua');
    setSearchQuery('');
    showToast({ variant: 'info', title: 'Filter monitoring direset' });
  }

  async function handleSimulateSocialSpike() {
    if (!isAdmin) return;
    setSimulating(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'Siber Sosial',
          severity: 'Tinggi',
          actor: 'Detektor Lonjakan Narasi (Simulasi)',
          ipAddress: '103.88.14.202',
          event:
            'Simulasi Uji Siber Sosial: Terdeteksi 180 unggahan seragam berpola bot memicu kepanikan di TikTok & X',
          status: 'Peringatan',
          pillar: 'Operasi Kognitif & Bot',
          sourceType: 'DEMO',
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { log?: SecurityLog; error?: string };
      if (res.ok && json.log) {
        onLogAdded(json.log);
        showToast({
          variant: 'warning',
          title: 'Simulasi Lonjakan Narasi Dicatat',
          description: 'Peristiwa uji DEMO ditambahkan ke log dan panel notifikasi.',
        });
      } else {
        showToast({
          variant: 'error',
          title: 'Gagal mencatat simulasi',
          description: json.error || 'Terjadi kendala pada server.',
        });
      }
    } catch {
      showToast({
        variant: 'error',
        title: 'Gagal terhubung ke server',
        description: 'Tidak dapat mencatat peristiwa simulasi saat ini.',
      });
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#1B2B48]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Monitoring Siber Sosial — Tren Narasi & Audit Aktivitas
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Pemantauan peristiwa narasi publik, deteksi lonjakan bot, serta log autentikasi konsol secara transparan.
          </p>
        </div>

        {isAdmin ? (
          <motion.button
            type="button"
            disabled={simulating}
            whileTap={{ scale: 0.97 }}
            onClick={() => void handleSimulateSocialSpike()}
            className="py-2 px-4 rounded-lg bg-[#101C36] hover:bg-[#17284B] border border-[#24375C] text-xs font-semibold text-slate-100 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {simulating ? (
              <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
            ) : (
              <PlusCircle className="w-4 h-4 text-amber-400" />
            )}
            <span>{simulating ? 'Mencatat...' : 'Catat Simulasi Lonjakan Narasi (DEMO)'}</span>
          </motion.button>
        ) : (
          <div className="py-2 px-3 rounded-lg bg-[#081022] border border-[#1B2B48] text-xs text-slate-400 flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Simulasi Uji Khusus Admin (Yahya)</span>
          </div>
        )}
      </div>

      {/* Explicit Authorization & Ethics Notice */}
      <div className="p-4 rounded-xl bg-[#0B1428] border border-[#24375C] flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white">Kepatuhan Pemantauan Siber Sosial:</strong> Seluruh catatan berasal dari aktivitas analisis di dalam aplikasi (<span className="font-mono text-emerald-400">APP LOG</span>) dan skenario simulasi terkurasi (<span className="font-mono text-amber-400">DEMO</span>). Sistem tidak melakukan scraping paksa atau pelacakan pribadi di luar izin pengguna.
        </p>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#0B1428] border border-[#1B2B48]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Aktivitas Modul Siber Sosial</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-400">
            <AnimatedNumber value={socialIntelLogsCount} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B1428] border border-[#1B2B48]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Impersonasi Diblokir / Gagal</span>
            <AlertOctagon className="w-4 h-4 text-red-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-400">
            <AnimatedNumber value={blockedOrFailedCount} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B1428] border border-[#1B2B48]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Peringatan Keparahan Tinggi / Kritis</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-400">
            <AnimatedNumber value={highSeverityLogs.length} />
          </div>
        </div>
      </div>

      {/* Animated Segmented Quick Tabs + Filter Bar */}
      <div className="p-4 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-[#060C1A] border border-[#1B2B48] w-fit relative">
            {(
              [
                { id: 'all', label: 'Semua Aktivitas' },
                { id: 'social', label: 'Peristiwa Siber Sosial' },
                { id: 'alerts', label: 'Peringatan & Blokir' },
              ] as const
            ).map((item) => {
              const active = quickView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => triggerQuickView(item.id)}
                  className={`relative py-1.5 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap z-10 ${
                    active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="monitoringQuickTab"
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 bg-[#162544] rounded-md -z-10"
                    />
                  )}
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-mono tabular-nums">
            <span>
              Menampilkan {filteredLogs.length} dari {logs.length} entri
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-sky-400 hover:text-sky-300 flex items-center gap-1 font-sans font-medium"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari aktor, akun, sub-domain Siber Sosial, atau deskripsi..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>

            <select
              aria-label="Filter kategori log"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as LogCategory | 'Semua')}
              className="px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white focus:outline-none focus:border-red-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  Kategori: {cat}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter keparahan log"
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel | 'Semua')}
              className="px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white focus:outline-none focus:border-red-500"
            >
              {SEVERITIES.map((sev) => (
                <option key={sev} value={sev}>
                  Keparahan: {sev}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter sumber data log"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as 'Semua' | 'APP LOG' | 'DEMO')}
              className="px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white focus:outline-none focus:border-red-500"
            >
              <option value="Semua">Sumber: Semua</option>
              <option value="APP LOG">Sumber: APP LOG</option>
              <option value="DEMO">Sumber: DEMO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Logs Data Grid with Skeleton transition */}
      <div className="rounded-xl bg-[#0B1428] border border-[#1B2B48] overflow-hidden">
        {isFilteringSkeleton ? (
          <TableSkeleton rows={5} />
        ) : (
          <motion.div
            key={`${quickView}-${categoryFilter}-${severityFilter}-${sourceFilter}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.16 }}
            className="overflow-x-auto"
          >
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#081022] border-b border-[#1B2B48] text-[11px] font-semibold text-slate-400">
                  <th className="py-3 px-4">Waktu Kejadian</th>
                  <th className="py-3 px-3">Kategori</th>
                  <th className="py-3 px-3">Keparahan</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Aktor & Sumber</th>
                  <th className="py-3 px-3">Detail Aktivitas Siber Sosial</th>
                  <th className="py-3 px-4 text-right">Label</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#15223C] text-xs">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Tidak ada rekaman log yang sesuai dengan kriteria filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-[#0F1B35]/60 transition-colors">
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-400 whitespace-nowrap">
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
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={
                            log.status === 'Berhasil'
                              ? 'text-emerald-400'
                              : log.status === 'Peringatan'
                                ? 'text-amber-400'
                                : 'text-red-400'
                          }
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="text-slate-200">{log.actor}</div>
                        <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                          {log.pillar}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 min-w-[260px]">{log.event}</td>
                      <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
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
          </motion.div>
        )}
      </div>
    </div>
  );
}

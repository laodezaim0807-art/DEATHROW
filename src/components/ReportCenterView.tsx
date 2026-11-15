import { useMemo, useRef, useState, type RefObject } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Calendar, CheckCircle2, Download, FileText, Lock } from 'lucide-react';
import {
  formatDateTime,
  getIncidentStatusClass,
  getRiskTextClass,
  getSentimentTextClass,
} from '../lib/format';
import { exportReportPdf, type ReportCategoryType } from '../lib/pdfExport';
import { useToast } from './ToastProvider';
import type { AuthUser, SatriaDashboardData } from '../types/satria';

interface ReportCenterViewProps {
  user: AuthUser;
  data: SatriaDashboardData;
}

const REPORT_TABS: Array<{ id: ReportCategoryType; label: string; adminOnly?: boolean }> = [
  { id: 'social', label: 'Intelijen Narasi Sosial' },
  { id: 'phishing', label: 'Deteksi Rekayasa Sosial' },
  { id: 'monitoring', label: 'Monitoring Siber Sosial' },
  { id: 'incidents', label: 'Investigasi Kasus Sosial' },
  { id: 'executive', label: 'Laporan Terpadu (Admin)', adminOnly: true },
];

function toDateInputString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inDateRange(iso: string, startDate: string, endDate: string): boolean {
  const parsed = new Date(iso);
  const time = parsed.getTime();
  if (Number.isNaN(time)) return true;

  if (startDate) {
    const [y, m, d] = startDate.split('-').map(Number);
    if (y && m && d) {
      const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
      if (time < start) return false;
    }
  }
  if (endDate) {
    const [y, m, d] = endDate.split('-').map(Number);
    if (y && m && d) {
      const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
      if (time > end) return false;
    }
  }
  return true;
}

export function ReportCenterView({ user, data }: ReportCenterViewProps) {
  const { showToast } = useToast();
  const isAdmin = user.role === 'admin';
  const [reportType, setReportType] = useState<ReportCategoryType>('social');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [lastExportAt, setLastExportAt] = useState<string | null>(null);
  const [exportError, setExportError] = useState('');

  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  const dateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);

  function openDatePicker(ref: RefObject<HTMLInputElement | null>) {
    const input = ref.current;
    if (!input) return;
    input.focus();
    try {
      const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
      if (typeof pickerInput.showPicker === 'function') {
        pickerInput.showPicker();
      }
    } catch {
      // Fallback to native focus if browser blocks programmatic showPicker
    }
  }

  function applyQuickRange(days: number | 'today' | 'all') {
    setExportError('');
    if (days === 'all') {
      setStartDate('');
      setEndDate('');
      showToast({ variant: 'info', title: 'Rentang tanggal disetel ke Semua Waktu' });
      return;
    }
    const now = new Date();
    const endStr = toDateInputString(now);
    if (days === 'today') {
      setStartDate(endStr);
      setEndDate(endStr);
      showToast({ variant: 'info', title: 'Filter laporan: Hari Ini' });
      return;
    }
    const start = new Date(now.getTime() - days * 86400 * 1000);
    setStartDate(toDateInputString(start));
    setEndDate(endStr);
    showToast({ variant: 'info', title: `Filter laporan: ${days} Hari Terakhir` });
  }

  const filteredPhishing = useMemo(
    () =>
      dateRangeInvalid
        ? []
        : data.phishingAnalyses.filter((p) => inDateRange(p.createdAt, startDate, endDate)),
    [data.phishingAnalyses, startDate, endDate, dateRangeInvalid],
  );
  const filteredSocial = useMemo(
    () =>
      dateRangeInvalid
        ? []
        : data.socialAnalyses.filter((s) => inDateRange(s.createdAt, startDate, endDate)),
    [data.socialAnalyses, startDate, endDate, dateRangeInvalid],
  );
  const filteredLogs = useMemo(
    () =>
      dateRangeInvalid
        ? []
        : data.securityLogs.filter((l) => inDateRange(l.timestamp, startDate, endDate)),
    [data.securityLogs, startDate, endDate, dateRangeInvalid],
  );
  const filteredIncidents = useMemo(
    () =>
      dateRangeInvalid
        ? []
        : data.incidents.filter((i) => inDateRange(i.createdAt, startDate, endDate)),
    [data.incidents, startDate, endDate, dateRangeInvalid],
  );

  function handleExport() {
    setExportError('');
    if (dateRangeInvalid) {
      setExportError(
        'Rentang tanggal tidak valid: Tanggal Mulai tidak boleh lebih besar daripada Tanggal Akhir.',
      );
      return;
    }
    if (reportType === 'executive' && !isAdmin) {
      setExportError('Laporan Terpadu eksekutif hanya dapat diekspor oleh peran Admin.');
      return;
    }

    const result = exportReportPdf({
      reportType,
      startDate,
      endDate,
      user,
      mode: data.mode,
      phishingAnalyses: filteredPhishing,
      socialAnalyses: filteredSocial,
      securityLogs: filteredLogs,
      incidents: filteredIncidents,
    });

    if (!result.ok) {
      setExportError(result.error || 'Gagal mengekspor laporan PDF.');
      showToast({
        variant: 'error',
        title: 'Ekspor PDF gagal',
        description: result.error,
      });
      return;
    }
    setLastExportAt(new Date().toISOString());
    showToast({
      variant: 'success',
      title: 'Laporan PDF Siber Sosial Diunduh',
      description: `Kategori: ${REPORT_TABS.find((t) => t.id === reportType)?.label}`,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#1B2B48]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Pusat Laporan Siber Sosial & Ekspor PDF
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Susun laporan audit narasi publik, deteksi rekayasa sosial, dan investigasi kasus berdasarkan rentang tanggal.
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={handleExport}
          disabled={dateRangeInvalid}
          className="py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Ekspor Laporan PDF</span>
        </motion.button>
      </div>

      {/* Controls: Animated Report Tabs + Clickable Date Filter */}
      <div className="p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-4">
        <div className="flex flex-wrap gap-1.5 p-1 rounded-lg bg-[#060C1A] border border-[#1B2B48] w-fit relative">
          {REPORT_TABS.map((tab) => {
            const locked = Boolean(tab.adminOnly && !isAdmin);
            const active = reportType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                disabled={locked}
                title={locked ? 'Khusus akun Admin (Yahya)' : undefined}
                onClick={() => {
                  setReportType(tab.id);
                  setExportError('');
                }}
                className={`relative py-2 px-3.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 z-10 ${
                  locked
                    ? 'text-slate-600 cursor-not-allowed'
                    : active
                      ? 'text-white'
                      : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {active && !locked && (
                  <motion.span
                    layoutId="reportTabIndicator"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 bg-[#162544] rounded-md -z-10"
                  />
                )}
                {locked && <Lock className="w-3 h-3" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-2">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label
                  htmlFor="report-start-date"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Tanggal Mulai
                </label>
                <div
                  onClick={() => openDatePicker(startInputRef)}
                  className="relative cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-sky-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="report-start-date"
                    ref={startInputRef}
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setExportError('');
                    }}
                    className="pl-9 pr-3 py-2.5 rounded-lg bg-[#060C1A] border border-[#24375C] hover:border-sky-500/70 focus:border-red-500 focus:outline-none text-xs font-mono text-white cursor-pointer [color-scheme:dark] min-w-[165px]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="report-end-date"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Tanggal Akhir
                </label>
                <div
                  onClick={() => openDatePicker(endInputRef)}
                  className="relative cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-sky-400 pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="report-end-date"
                    ref={endInputRef}
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setExportError('');
                    }}
                    className="pl-9 pr-3 py-2.5 rounded-lg bg-[#060C1A] border border-[#24375C] hover:border-sky-500/70 focus:border-red-500 focus:outline-none text-xs font-mono text-white cursor-pointer [color-scheme:dark] min-w-[165px]"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                <button
                  type="button"
                  onClick={() => applyQuickRange('today')}
                  className="py-2 px-2.5 rounded-md bg-[#111E38] hover:bg-[#192B50] border border-[#24375C] text-xs text-slate-200 whitespace-nowrap transition-colors"
                >
                  Hari Ini
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange(7)}
                  className="py-2 px-2.5 rounded-md bg-[#111E38] hover:bg-[#192B50] border border-[#24375C] text-xs text-slate-200 whitespace-nowrap transition-colors"
                >
                  7 Hari
                </button>
                <button
                  type="button"
                  onClick={() => applyQuickRange(30)}
                  className="py-2 px-2.5 rounded-md bg-[#111E38] hover:bg-[#192B50] border border-[#24375C] text-xs text-slate-200 whitespace-nowrap transition-colors"
                >
                  30 Hari
                </button>
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => applyQuickRange('all')}
                    className="py-2 px-2.5 rounded-md bg-[#101C36] border border-[#24375C] text-xs text-slate-300 hover:text-white whitespace-nowrap transition-colors"
                  >
                    Semua Tanggal
                  </button>
                )}
              </div>
            </div>

            {dateRangeInvalid && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Tanggal Mulai tidak boleh lebih lambat daripada Tanggal Akhir. Sesuaikan rentang atau klik &ldquo;Semua Tanggal&rdquo;.
                </span>
              </div>
            )}

            {exportError && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-400 font-mono tabular-nums">
            <div>Waktu Pembuatan Laporan: {formatDateTime(new Date().toISOString())}</div>
            {lastExportAt && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-emerald-400 mt-1 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PDF berhasil diunduh: {formatDateTime(lastExportAt)}</span>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Container */}
      <motion.div
        key={`${reportType}-${startDate}-${endDate}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="p-6 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#1B2B48]">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-400" />
            <h2 className="text-base font-semibold text-white">
              Pratinjau Data: {REPORT_TABS.find((t) => t.id === reportType)?.label}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Penyusun: <strong className="text-slate-200">{user.name}</strong> ({user.role.toUpperCase()})
          </span>
        </div>

        {(reportType === 'social' || reportType === 'executive') && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tabular-nums">
              Laporan Intelijen Narasi Sosial ({filteredSocial.length})
            </h3>
            {filteredSocial.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                Tidak ada rekaman narasi sosial pada rentang tanggal ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1B2B48] text-slate-400">
                      <th className="py-2 pr-3">Waktu</th>
                      <th className="py-2 px-3">Platform</th>
                      <th className="py-2 px-3">Klasifikasi</th>
                      <th className="py-2 px-3">Sentimen</th>
                      <th className="py-2 px-3">Keyakinan</th>
                      <th className="py-2 pl-3 text-right">Label</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#15223C]">
                    {filteredSocial.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {formatDateTime(s.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{s.sourcePlatform}</td>
                        <td className="py-2.5 px-3 text-slate-200">{s.classification}</td>
                        <td className={`py-2.5 px-3 font-semibold ${getSentimentTextClass(s.sentiment)}`}>
                          {s.sentiment}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-sky-400">
                          {s.confidenceLevel}%
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono text-slate-400">
                          {s.isDemo ? 'DEMO' : 'LIVE'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(reportType === 'phishing' || reportType === 'executive') && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tabular-nums">
              Laporan Deteksi Rekayasa Sosial ({filteredPhishing.length})
            </h3>
            {filteredPhishing.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                Tidak ada rekaman deteksi rekayasa sosial pada rentang tanggal ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1B2B48] text-slate-400">
                      <th className="py-2 pr-3">Waktu</th>
                      <th className="py-2 px-3">Target / Tautan Sosial</th>
                      <th className="py-2 px-3">Skor</th>
                      <th className="py-2 px-3">Kategori</th>
                      <th className="py-2 pl-3 text-right">Label</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#15223C]">
                    {filteredPhishing.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {formatDateTime(p.createdAt)}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-200 max-w-sm truncate">
                          {p.urlInput || p.messageInput}
                        </td>
                        <td className="py-2.5 px-3 font-mono tabular-nums text-white">
                          {p.riskScore}/100
                        </td>
                        <td className={`py-2.5 px-3 font-semibold ${getRiskTextClass(p.riskCategory)}`}>
                          {p.riskCategory}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono text-slate-400">
                          {p.isDemo ? 'DEMO' : 'LIVE'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(reportType === 'monitoring' || reportType === 'executive') && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tabular-nums">
              Laporan Monitoring Siber Sosial ({filteredLogs.length})
            </h3>
            {filteredLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                Tidak ada log pemantauan pada rentang tanggal ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1B2B48] text-slate-400">
                      <th className="py-2 pr-3">Waktu</th>
                      <th className="py-2 px-3">Kategori</th>
                      <th className="py-2 px-3">Keparahan</th>
                      <th className="py-2 px-3">Peristiwa</th>
                      <th className="py-2 pl-3 text-right">Sumber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#15223C]">
                    {filteredLogs.slice(0, 20).map((l) => (
                      <tr key={l.id}>
                        <td className="py-2.5 pr-3 font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {formatDateTime(l.timestamp)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">
                          {l.category}
                        </td>
                        <td className={`py-2.5 px-3 font-semibold ${getRiskTextClass(l.severity)}`}>
                          {l.severity}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{l.event}</td>
                        <td className="py-2.5 pl-3 text-right font-mono text-slate-400">
                          {l.sourceType}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(reportType === 'incidents' || reportType === 'executive') && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-white tabular-nums">
              Laporan Investigasi Kasus Sosial ({filteredIncidents.length})
            </h3>
            {filteredIncidents.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                Tidak ada data kasus pada rentang tanggal ini.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#1B2B48] text-slate-400">
                      <th className="py-2 pr-3">Kode</th>
                      <th className="py-2 px-3">Judul Kasus</th>
                      <th className="py-2 px-3">Keparahan</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 pl-3 text-right">Artefak</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#15223C]">
                    {filteredIncidents.map((inc) => (
                      <tr key={inc.id}>
                        <td className="py-2.5 pr-3 font-mono text-slate-300 whitespace-nowrap">
                          {inc.code}
                        </td>
                        <td className="py-2.5 px-3 text-slate-200">{inc.title}</td>
                        <td className={`py-2.5 px-3 font-semibold ${getRiskTextClass(inc.severity)}`}>
                          {inc.severity}
                        </td>
                        <td
                          className={`py-2.5 px-3 font-semibold ${getIncidentStatusClass(
                            inc.status,
                          )}`}
                        >
                          {inc.status}
                        </td>
                        <td className="py-2.5 pl-3 text-right font-mono tabular-nums text-slate-400">
                          {inc.evidence.length} bukti · {inc.timeline.length} log
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

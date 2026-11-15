import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Eraser,
  ExternalLink,
  Info,
  Loader2,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react';
import { formatDateTime, getRiskBarClass, getRiskTextClass } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';
import { AnalysisResultSkeleton } from './Skeletons';
import { useToast } from './ToastProvider';
import type { AuthUser, PhishingAnalysis } from '../types/satria';

interface PhishingDetectionViewProps {
  user: AuthUser;
  analyses: PhishingAnalysis[];
  onAnalysisCreated: (analysis: PhishingAnalysis) => void;
}

const PRESET_SAMPLES = [
  {
    label: 'Umpan Beasiswa Telegram',
    url: 'https://bit.ly/beasiswa-komunitas-2026',
    message:
      'INFO RESMI CHANNEL: Kuota beasiswa mahasiswa semester aktif tersisa 18 orang. Kirim foto KTM, KTP, dan kode verifikasi WhatsApp ke admin channel Telegram sebelum jam 21.00 WIB.',
  },
  {
    label: 'Giveaway Palsu Instagram',
    url: 'http://klaim-giveaway-umkm.xyz/hadiah-viral',
    message:
      'Selamat! Akun Instagram UMKM Anda terpilih menerima dana pembinaan Rp10 juta dari program viral TikTok. Klik link di bio sekarang sebelum hangus!',
  },
  {
    label: 'Kanal Sosial Resmi',
    url: 'https://instagram.com/kemdikbud.ri',
    message:
      'Simak panduan literasi digital dan kewaspadaan ruang siber sosial melalui sorotan akun resmi terverifikasi kami.',
  },
];

export function PhishingDetectionView({
  user,
  analyses,
  onAnalysisCreated,
}: PhishingDetectionViewProps) {
  const { showToast } = useToast();
  const [urlInput, setUrlInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<PhishingAnalysis | null>(analyses[0] ?? null);
  const [fallbackNotice, setFallbackNotice] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFallbackNotice(false);

    if (!urlInput.trim() && !messageInput.trim()) {
      setError('Masukkan minimal satu tautan profil/bio atau teks pesan DM/komentar untuk dianalisis.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/analyze/phishing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urlInput: urlInput.trim(),
          messageInput: messageInput.trim(),
          analystName: user.name,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        analysis?: PhishingAnalysis;
        usedFallback?: boolean;
        error?: string;
      };
      if (!res.ok || !json.analysis) {
        setError(json.error || 'Gagal menjalankan deteksi rekayasa sosial.');
        showToast({
          variant: 'error',
          title: 'Deteksi gagal diproses',
          description: json.error || 'Silakan periksa kembali masukan Anda.',
        });
        return;
      }
      onAnalysisCreated(json.analysis);
      setSelected(json.analysis);
      setFallbackNotice(Boolean(json.usedFallback));
      showToast({
        variant: json.analysis.riskCategory === 'Tinggi' ? 'warning' : 'success',
        title: `Deteksi Rekayasa Sosial Selesai`,
        description: `Kategori ${json.analysis.riskCategory} · Skor ${json.analysis.riskScore}/100`,
      });
    } catch {
      setError('Gagal terhubung ke layanan analisis server.');
    } finally {
      setLoading(false);
    }
  }

  function applySample(sample: (typeof PRESET_SAMPLES)[number]) {
    setUrlInput(sample.url);
    setMessageInput(sample.message);
    setError('');
    showToast({ variant: 'info', title: `Sampel "${sample.label}" dimuat` });
  }

  function handleResetForm() {
    setUrlInput('');
    setMessageInput('');
    setError('');
    showToast({ variant: 'info', title: 'Formulir deteksi dibersihkan' });
  }

  async function handleCopyReport(item: PhishingAnalysis) {
    const summary = `Deteksi Rekayasa Sosial (${item.riskCategory} · ${item.riskScore}/100)\nSub-Domain: ${item.pillar}\nTarget: ${item.urlInput || '-'}\nPenjelasan: ${item.explanation}`;
    try {
      await navigator.clipboard.writeText(summary);
      setCopiedId(item.id);
      showToast({ variant: 'success', title: 'Hasil deteksi disalin ke clipboard' });
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedId((prev) => (prev === item.id ? null : prev));
      }, 1800);
    } catch {
      showToast({ variant: 'warning', title: 'Clipboard tidak tersedia di peramban ini' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-[#1B2B48]">
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Deteksi Rekayasa Sosial & Impersonasi Akun
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Evaluasi gabungan aturan heuristik Siber Sosial dan AI Gemini untuk mendeteksi penipuan DM, link di bio, giveaway palsu, dan penyamaran akun organisasi.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-5 space-y-5">
          <form
            onSubmit={handleAnalyze}
            className="p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-white">Masukan Pesan / Tautan Sosial</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tempelkan tautan bio profil, pesan DM WhatsApp/Telegram, atau komentar mencurigakan.
                </p>
              </div>
              {(urlInput || messageInput) && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleResetForm}
                  className="py-1.5 px-2.5 rounded-md bg-[#111E38] hover:bg-[#192B50] border border-[#24375C] text-[11px] text-slate-300 flex items-center gap-1 whitespace-nowrap transition-colors"
                >
                  <Eraser className="w-3 h-3" />
                  <span>Bersihkan</span>
                </motion.button>
              )}
            </div>

            <div>
              <span className="block text-xs text-slate-400 mb-2">Contoh Uji Rekayasa Sosial:</span>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_SAMPLES.map((s) => (
                  <motion.button
                    key={s.label}
                    type="button"
                    disabled={loading}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => applySample(s)}
                    className="py-1.5 px-2.5 rounded-md bg-[#111E38] hover:bg-[#192B50] disabled:opacity-50 border border-[#24375C] text-xs text-slate-200 transition-colors whitespace-nowrap"
                  >
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tautan Bio / Profil / URL (Opsional jika teks pesan diisi)
              </label>
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://bit.ly/... atau https://instagram.com/..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Teks DM / Komentar / Broadcast Grup
                </label>
                <span className="text-[11px] font-mono tabular-nums text-slate-500">
                  {messageInput.length} karakter
                </span>
              </div>
              <textarea
                rows={5}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder="Tempelkan isi DM, komentar giveaway, atau pesan grup yang meminta data pribadi/OTP..."
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 resize-y transition-colors"
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200"
              >
                {error}
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldAlert className="w-4 h-4" />
              )}
              <span>{loading ? 'Menganalisis Pola Sosial...' : 'Deteksi Rekayasa Sosial'}</span>
            </motion.button>
          </form>

          {/* Examination History */}
          <div className="p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Riwayat Pemeriksaan</h2>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {analyses.length} rekaman
              </span>
            </div>

            {analyses.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">Belum ada pemeriksaan yang tersimpan.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {analyses.map((item) => {
                  const isActive = selected?.id === item.id;
                  return (
                    <motion.button
                      key={item.id}
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setSelected(item)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        isActive
                          ? 'bg-[#132240] border-[#2E4878]'
                          : 'bg-[#081022] border-[#172540] hover:bg-[#0F1B35]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={`font-semibold ${getRiskTextClass(item.riskCategory)}`}>
                          {item.riskCategory} · Skor {item.riskScore}/100
                        </span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {item.isDemo ? 'DEMO · ' : ''}
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-200 truncate font-mono">
                        {item.urlInput || item.messageInput}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {loading ? (
              <AnalysisResultSkeleton key="skeleton" label="Memproses deteksi rekayasa sosial" />
            ) : !selected ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-10 rounded-xl bg-[#0B1428] border border-[#1B2B48] text-center"
              >
                <ShieldQuestion className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white">Belum Ada Hasil Dipilih</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Jalankan pemeriksaan baru di panel sebelah kiri atau pilih entri dari riwayat pemeriksaan.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="p-6 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-6"
              >
                {fallbackNotice && (
                  <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-800/70 text-xs text-amber-200 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Analisis dijalankan dengan mode aturan heuristik Siber Sosial cadangan karena kunci API Gemini server belum aktif.
                    </span>
                  </div>
                )}

                {/* Top Score Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#1B2B48]">
                  <div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                      <span>{selected.pillar}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {formatDateTime(selected.createdAt)}
                      </span>
                      {selected.isDemo && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-amber-400">DEMO</span>
                        </>
                      )}
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-white flex items-center gap-2">
                      <span>Risiko Rekayasa Sosial:</span>
                      <span className={getRiskTextClass(selected.riskCategory)}>
                        {selected.riskCategory}
                      </span>
                    </h2>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-400">Skor Risiko Gabungan</div>
                      <div
                        className={`text-3xl font-bold font-mono tabular-nums ${getRiskTextClass(
                          selected.riskCategory,
                        )}`}
                      >
                        <AnimatedNumber value={selected.riskScore} />
                        <span className="text-base text-slate-500">/100</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyReport(selected)}
                      className="py-1.5 px-2.5 rounded-md bg-[#111E38] hover:bg-[#192B50] border border-[#24375C] text-[11px] text-slate-200 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      {copiedId === selected.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin Hasil</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Risk Meter + Rule vs AI Breakdown */}
                <div className="space-y-3">
                  <div className="h-3 w-full rounded-full bg-[#060C1A] border border-[#1B2B48] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selected.riskScore}%` }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full ${getRiskBarClass(selected.riskCategory)}`}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono tabular-nums">
                    <span>Skor Aturan Heuristik: {selected.ruleScore}/100</span>
                    <span>Skor Konteks AI Gemini: {selected.aiScore}/100</span>
                  </div>
                </div>

                {/* Inspected Target */}
                {(selected.urlInput || selected.messageInput) && (
                  <div className="p-4 rounded-lg bg-[#081022] border border-[#172540] space-y-2">
                    {selected.urlInput && (
                      <div>
                        <div className="text-[11px] text-slate-400">Tautan Bio / Pesan</div>
                        <div className="mt-0.5 text-xs font-mono text-sky-300 break-all flex items-center gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>{selected.urlInput}</span>
                        </div>
                      </div>
                    )}
                    {selected.messageInput && (
                      <div>
                        <div className="text-[11px] text-slate-400">Kutipan Pesan Sosial</div>
                        <p className="mt-0.5 text-xs text-slate-200 leading-relaxed">
                          {selected.messageInput}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Mandatory Safety Caveat */}
                <div className="p-4 rounded-lg bg-[#0F1B35] border border-[#263C66] flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-amber-300">
                      Prinsip Verifikasi Siber Sosial
                    </div>
                    <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                      {selected.safetyCaveat}
                    </p>
                  </div>
                </div>

                {/* Indicators */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-3">
                    Indikator yang Ditemukan ({selected.indicators.length})
                  </h3>
                  <div className="space-y-2.5">
                    {selected.indicators.map((ind, idx) => (
                      <motion.div
                        key={`${ind.code}-${idx}`}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16, delay: idx * 0.04 }}
                        className="p-3.5 rounded-lg bg-[#081022] border border-[#172540]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-white">{ind.label}</span>
                          <span className="text-[11px] text-slate-400">
                            <span className={`font-semibold ${getRiskTextClass(ind.severity)}`}>
                              {ind.severity}
                            </span>{' '}
                            · {ind.source}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed">{ind.detail}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Explanation */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Penjelasan Hasil Analisis</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {selected.explanation}
                  </p>
                </div>

                {/* Step-by-step recommendations */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2.5">
                    Rekomendasi Mitigasi Siber Sosial
                  </h3>
                  <ol className="space-y-2">
                    {selected.recommendations.map((rec, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16, delay: index * 0.04 }}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>
                          <strong className="font-mono text-slate-400 mr-1.5">
                            0{index + 1}.
                          </strong>
                          {rec}
                        </span>
                      </motion.li>
                    ))}
                  </ol>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

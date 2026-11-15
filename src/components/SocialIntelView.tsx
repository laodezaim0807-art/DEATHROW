import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Eraser,
  Info,
  Link2,
  Loader2,
  MessageSquareWarning,
  SearchCheck,
} from 'lucide-react';
import { formatDateTime, getSentimentTextClass } from '../lib/format';
import { AnimatedNumber } from './AnimatedNumber';
import { AnalysisResultSkeleton } from './Skeletons';
import { useToast } from './ToastProvider';
import type { AuthUser, SocialIntelAnalysis } from '../types/satria';

interface SocialIntelViewProps {
  user: AuthUser;
  analyses: SocialIntelAnalysis[];
  onAnalysisCreated: (analysis: SocialIntelAnalysis) => void;
}

const SOCIAL_PLATFORMS = [
  'YouTube (Video / Komentar / Deskripsi)',
  'TikTok (Video / Caption / Komentar)',
  'Telegram (Channel / Grup)',
  'Facebook (Postingan / Grup / Komentar)',
  'Instagram (Reels / Feed / Story)',
  'X / Twitter',
  'WhatsApp (Grup / Pesan Berantai)',
  'Threads',
  'LinkedIn',
  'Portal Berita Online',
  'Forum Komunitas (Reddit / Kaskus)',
  'Lainnya (Tulis Manual)',
];

const SOCIAL_SAMPLES = [
  {
    label: 'TikTok Viral QRIS',
    platform: 'TikTok (Video / Caption / Komentar)',
    url: 'https://tiktok.com/@info_viral_umkm/video/739201',
    text: 'VIRAL HARI INI!! Katanya mulai besok semua pedagang kecil yang pakai QRIS bakal kena potongan otomatis 18% kalau tidak daftar ulang di link bio! Buruan share ke teman dagang sebelum terlambat!',
  },
  {
    label: 'Amplifikasi Bot X',
    platform: 'X / Twitter',
    url: 'https://x.com/pantau_publik/status/1902841',
    text: 'Muncul ratusan balasan seragam dalam 20 menit terakhir dari akun-akun baru tanpa foto profil yang mengarahkan opini boikot dengan tagar yang sama persis.',
  },
  {
    label: 'Telegram Beasiswa',
    platform: 'Telegram (Channel / Grup)',
    url: 'https://t.me/info_beasiswa_cepat',
    text: 'Slot bantuan dana pendidikan mahasiswa semester aktif tersisa 18 kuota. Tidak perlu seleksi berkas, cukup kirim foto KTM dan nomor WA aktif ke admin channel sekarang.',
  },
  {
    label: 'Literasi Kampus',
    platform: 'Facebook (Postingan / Grup / Komentar)',
    url: 'https://facebook.com/groups/komunitas-kampus',
    text: 'Unit Literasi Siber Sosial mengadakan pelatihan verifikasi fakta dan pengenalan teknik rekayasa sosial bagi 350 mahasiswa dan pelaku UMKM lokal.',
  },
];

export function SocialIntelView({
  user,
  analyses,
  onAnalysisCreated,
}: SocialIntelViewProps) {
  const { showToast } = useToast();
  const [sourcePlatform, setSourcePlatform] = useState(SOCIAL_PLATFORMS[0]);
  const [customPlatform, setCustomPlatform] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SocialIntelAnalysis | null>(analyses[0] ?? null);
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

  const isCustomPlatform = sourcePlatform === 'Lainnya (Tulis Manual)';
  const effectivePlatform = isCustomPlatform
    ? customPlatform.trim() || 'Platform Media Sosial Lainnya'
    : sourcePlatform;
  const trimmedLength = inputText.trim().length;
  const isTextReady = trimmedLength >= 10;

  async function handleAnalyze(e: FormEvent) {
    e.preventDefault();
    setError('');
    setFallbackNotice(false);

    if (!isTextReady) {
      setError('Masukkan teks berita, komentar, atau caption minimal 10 karakter.');
      return;
    }

    if (isCustomPlatform && customPlatform.trim().length < 2) {
      setError('Tuliskan nama platform sumber jika memilih opsi Lainnya.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/analyze/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputText: inputText.trim(),
          sourcePlatform: effectivePlatform,
          sourceUrl: sourceUrl.trim(),
          analystName: user.name,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        analysis?: SocialIntelAnalysis;
        usedFallback?: boolean;
        error?: string;
      };
      if (!res.ok || !json.analysis) {
        setError(json.error || 'Gagal menjalankan analisis Siber Sosial.');
        showToast({
          variant: 'error',
          title: 'Analisis gagal diproses',
          description: json.error || 'Silakan periksa kembali teks masukan.',
        });
        return;
      }
      onAnalysisCreated(json.analysis);
      setSelected(json.analysis);
      setFallbackNotice(Boolean(json.usedFallback));
      showToast({
        variant: 'success',
        title: 'Analisis Narasi Sosial Selesai',
        description: `Sentimen ${json.analysis.sentiment} · Keyakinan ${json.analysis.confidenceLevel}%`,
      });
    } catch {
      setError('Gagal terhubung ke layanan analisis server.');
    } finally {
      setLoading(false);
    }
  }

  function handleResetForm() {
    setInputText('');
    setSourceUrl('');
    setCustomPlatform('');
    setError('');
    showToast({ variant: 'info', title: 'Formulir analisis dibersihkan' });
  }

  async function handleCopySummary(item: SocialIntelAnalysis) {
    const text = `[${item.sourcePlatform}] ${item.classification}\nSentimen: ${item.sentiment} (Keyakinan ${item.confidenceLevel}%)\nAnalisis Narasi: ${item.narrativeAnalysis}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(item.id);
      showToast({ variant: 'success', title: 'Ringkasan analisis disalin ke clipboard' });
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
          Intelijen Narasi & Verifikasi Media Sosial
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Evaluasi sentimen, pembingkaian narasi, dan indikator verifikasi fakta dari YouTube, TikTok, Telegram, Facebook, Instagram, X, WhatsApp, hingga portal berita.
        </p>
      </div>

      {/* Epistemic Guardrail Notice */}
      <div className="p-4 rounded-xl bg-[#0B1428] border border-[#24375C] flex items-start gap-3">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300 leading-relaxed">
          <strong className="text-white">Prinsip Objektivitas Siber Sosial:</strong> Modul ini tidak pernah menyatakan sebuah berita atau unggahan pasti hoaks hanya berdasarkan satu teks masukan. Hasil disajikan berupa indikator yang perlu diverifikasi, tingkat keyakinan model, serta keterbatasan analisis.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input + History */}
        <div className="lg:col-span-5 space-y-5">
          <form
            onSubmit={handleAnalyze}
            className="p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Masukan Teks Berita / Media Sosial
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pilih platform asal konten lalu tempelkan teks atau transkripnya.
                </p>
              </div>
              {(inputText || sourceUrl) && (
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
              <span className="block text-xs text-slate-400 mb-2">Contoh Uji Lintas Platform:</span>
              <div className="flex flex-wrap gap-1.5">
                {SOCIAL_SAMPLES.map((s) => (
                  <motion.button
                    key={s.label}
                    type="button"
                    disabled={loading}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => {
                      setSourcePlatform(s.platform);
                      setSourceUrl(s.url);
                      setInputText(s.text);
                      setError('');
                      showToast({
                        variant: 'info',
                        title: `Sampel "${s.label}" dimuat`,
                      });
                    }}
                    className="py-1.5 px-2.5 rounded-md bg-[#111E38] hover:bg-[#192B50] disabled:opacity-50 border border-[#24375C] text-xs text-slate-200 transition-colors whitespace-nowrap"
                  >
                    {s.label}
                  </motion.button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Platform Media Sosial / Berita
              </label>
              <select
                value={sourcePlatform}
                onChange={(e) => setSourcePlatform(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
              >
                {SOCIAL_PLATFORMS.map((plat) => (
                  <option key={plat} value={plat}>
                    {plat}
                  </option>
                ))}
              </select>
            </div>

            {isCustomPlatform && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Nama Platform Kustom
                </label>
                <input
                  type="text"
                  value={customPlatform}
                  onChange={(e) => setCustomPlatform(e.target.value)}
                  placeholder="Contoh: SnackVideo, Line OpenChat, Blog Komunitas"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Tautan Postingan / Akun Sumber (Opsional)
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-slate-500 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://youtube.com/... atau @nama_akun"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Teks Berita, Caption, Komentar, atau Transkrip
                </label>
                <span
                  className={`text-[11px] font-mono tabular-nums transition-colors ${
                    trimmedLength === 0
                      ? 'text-slate-500'
                      : isTextReady
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                  }`}
                >
                  {trimmedLength} karakter {trimmedLength > 0 && !isTextReady ? '(min. 10)' : ''}
                </span>
              </div>
              <textarea
                rows={6}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Salin dan tempel teks berita, caption TikTok/Instagram, deskripsi/komentar YouTube, pesan Telegram/WhatsApp, atau postingan Facebook..."
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
                <MessageSquareWarning className="w-4 h-4" />
              )}
              <span>{loading ? 'Mengevaluasi Narasi AI...' : 'Analisis Narasi Siber Sosial'}</span>
            </motion.button>
          </form>

          {/* History */}
          <div className="p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48]">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-white">Riwayat Analisis Sosial</h2>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {analyses.length} rekaman
              </span>
            </div>
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
                      <span className={`font-semibold ${getSentimentTextClass(item.sentiment)}`}>
                        Sentimen {item.sentiment} · Keyakinan {item.confidenceLevel}%
                      </span>
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        {item.isDemo ? 'DEMO · ' : ''}
                        {formatDateTime(item.createdAt)}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-200 truncate">
                      {item.sourcePlatform} · {item.classification}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Analysis Result or Skeleton */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {loading ? (
              <AnalysisResultSkeleton key="skeleton" label="Memproses analisis Siber Sosial" />
            ) : !selected ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-10 rounded-xl bg-[#0B1428] border border-[#1B2B48] text-center"
              >
                <SearchCheck className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-white">Pilih atau Jalankan Analisis</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Hasil sentimen, narasi, tingkat keyakinan, dan keterbatasan analisis akan tampil di sini.
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
                  <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-800/70 text-xs text-amber-200">
                    Mode evaluasi teks lokal aktif karena kunci API Gemini server belum dikonfigurasi.
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#1B2B48]">
                  <div>
                    <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                      <span className="text-slate-200 font-medium">{selected.sourcePlatform}</span>
                      <span aria-hidden="true">·</span>
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
                    <h2 className="mt-1 text-xl font-bold text-white">{selected.classification}</h2>
                    {selected.sourceUrl && (
                      <div className="mt-1 text-xs font-mono text-sky-400 break-all">
                        Sumber: {selected.sourceUrl}
                      </div>
                    )}
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                    <div className="text-left sm:text-right">
                      <div className="text-xs text-slate-400">Tingkat Keyakinan Model</div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-sky-400">
                        <AnimatedNumber value={selected.confidenceLevel} suffix="%" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopySummary(selected)}
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
                          <span>Salin Ringkasan</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Sentiment Breakdown */}
                <div className="p-4 rounded-lg bg-[#081022] border border-[#172540] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300 font-medium">
                      Sentimen Dominan:{' '}
                      <strong className={getSentimentTextClass(selected.sentiment)}>
                        {selected.sentiment}
                      </strong>
                    </span>
                    <span className="font-mono tabular-nums text-slate-400">
                      Positif {selected.sentimentScores.positif}% · Negatif{' '}
                      {selected.sentimentScores.negatif}% · Netral {selected.sentimentScores.netral}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-[#060C1A]">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selected.sentimentScores.positif}%` }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-emerald-500 h-full"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selected.sentimentScores.negatif}%` }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-red-500 h-full"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${selected.sentimentScores.netral}%` }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="bg-slate-500 h-full"
                    />
                  </div>
                </div>

                {/* Input Quote */}
                <div className="p-4 rounded-lg bg-[#081022] border border-[#172540]">
                  <div className="text-[11px] text-slate-400 mb-1">Teks yang Dianalisis</div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    “{selected.inputText}”
                  </p>
                </div>

                {/* Narrative Analysis */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2">Analisis Narasi</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {selected.narrativeAnalysis}
                  </p>
                </div>

                {/* Verification Indicators */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2.5">
                    Indikator Informasi yang Perlu Diverifikasi
                  </h3>
                  <ul className="space-y-2">
                    {selected.verificationIndicators.map((ind, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16, delay: idx * 0.04 }}
                        className="p-3 rounded-lg bg-[#081022] border border-[#172540] flex items-start gap-2.5 text-xs sm:text-sm text-slate-200"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span>{ind}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Fact Check Recommendations */}
                <div>
                  <h3 className="text-sm font-semibold text-white mb-2.5">
                    Rekomendasi Pemeriksaan Fakta
                  </h3>
                  <ul className="space-y-2">
                    {selected.factCheckRecommendations.map((rec, idx) => (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.16, delay: idx * 0.04 }}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Mandatory Analysis Limitations */}
                <div className="p-4 rounded-lg bg-[#0F1B35] border border-[#263C66]">
                  <div className="text-xs font-semibold text-amber-300 mb-1">
                    Keterbatasan Analisis (Wajib Diperhatikan)
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selected.analysisLimitations}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

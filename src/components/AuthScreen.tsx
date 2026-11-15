import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  UserCheck,
  UserCog,
  UserPlus,
} from 'lucide-react';
import { getSupabaseClient, isFrontendSupabaseConfigured } from '../lib/supabase';
import type { AuthUser, UserRole } from '../types/satria';
import { SatriaLogo } from './SatriaLogo';
import { useToast } from './ToastProvider';

interface AuthScreenProps {
  onAuthenticated: (user: AuthUser) => void;
  serverMode: 'supabase' | 'demo';
}

const SOCIAL_CYBER_DOMAINS = [
  {
    index: '01.',
    title: 'Disinformasi & Hoaks',
    desc: 'Evaluasi klaim viral, deteksi pemicu kepanikan publik, dan indikator verifikasi fakta lintas media sosial.',
  },
  {
    index: '02.',
    title: 'Rekayasa Sosial & Impersonasi',
    desc: 'Identifikasi penipuan DM, akun tiruan organisasi, dan tautan bio manipulatif pada komunitas digital.',
  },
  {
    index: '03.',
    title: 'Analisis Narasi & Sentimen',
    desc: 'Pemetaan sentimen publik, pembingkaian narasi, serta pemantauan respons audiens secara objektif.',
  },
  {
    index: '04.',
    title: 'Operasi Kognitif & Bot',
    desc: 'Deteksi pola amplifikasi komentar terkoordinasi, lonjakan tagar buatan, dan investigasi kasus sosial.',
  },
];

export function AuthScreen({ onAuthenticated, serverMode }: AuthScreenProps) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('Unit Siber Sosial Kampus & UMKM');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('analyst');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoadingRole, setDemoLoadingRole] = useState<UserRole | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const supabaseEnabled = isFrontendSupabaseConfigured && serverMode === 'supabase';

  function validateForm(): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (tab === 'register' && name.trim().length < 2) {
      return 'Nama lengkap minimal 2 karakter.';
    }
    if (!emailRegex.test(email.trim())) {
      return 'Masukkan alamat email yang valid.';
    }
    if (password.length < 6) {
      return 'Kata sandi minimal 6 karakter.';
    }
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const supabase = supabaseEnabled ? getSupabaseClient() : null;

      if (supabase) {
        if (tab === 'login') {
          const { data, error: sbErr } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (sbErr || !data.user) {
            await fetch('/api/auth/log-external', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: email.trim(),
                status: 'Gagal',
                detail: `Login Supabase gagal: ${sbErr?.message || 'Kredensial tidak valid'}`,
              }),
            });
            setError(sbErr?.message || 'Login gagal.');
            return;
          }

          await fetch('/api/auth/log-external', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: data.user.email,
              status: 'Berhasil',
              detail: 'Login berhasil melalui Supabase Authentication',
            }),
          });

          const meta = (data.user.user_metadata || {}) as {
            name?: string;
            role?: UserRole;
            organization?: string;
          };
          const authUser: AuthUser = {
            id: data.user.id,
            name: meta.name || data.user.email?.split('@')[0] || 'Analis',
            email: data.user.email || email.trim(),
            role: meta.role === 'admin' ? 'admin' : 'analyst',
            organization: meta.organization || 'Organisasi Mitra',
            authMode: 'supabase',
          };
          showToast({
            variant: 'success',
            title: `Selamat datang, ${authUser.name}`,
            description: `Masuk sebagai ${authUser.role.toUpperCase()} di konsol Siber Sosial.`,
          });
          onAuthenticated(authUser);
          return;
        } else {
          const { data, error: sbErr } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                name: name.trim(),
                role,
                organization: organization.trim(),
              },
            },
          });
          if (sbErr) {
            setError(sbErr.message);
            return;
          }
          if (data.user && data.session) {
            const authUser: AuthUser = {
              id: data.user.id,
              name: name.trim(),
              email: email.trim(),
              role,
              organization: organization.trim(),
              authMode: 'supabase',
            };
            showToast({
              variant: 'success',
              title: 'Akun berhasil dibuat',
              description: `Selamat datang di konsol Siber Sosial, ${authUser.name}.`,
            });
            onAuthenticated(authUser);
            return;
          }
          setSuccessMsg(
            'Registrasi berhasil. Silakan periksa email Anda atau masuk dengan akun tersebut.',
          );
          setTab('login');
          return;
        }
      }

      const endpoint = tab === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        tab === 'login'
          ? { email: email.trim(), password }
          : {
              name: name.trim(),
              email: email.trim(),
              password,
              role,
              organization: organization.trim(),
            };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { user?: AuthUser; error?: string };
      if (!res.ok || !json.user) {
        setError(json.error || 'Terjadi kesalahan autentikasi.');
        return;
      }
      showToast({
        variant: 'success',
        title: `Selamat datang, ${json.user.name}`,
        description: `Sesi ${json.user.role === 'admin' ? 'Admin' : 'Analyst'} Siber Sosial aktif.`,
      });
      onAuthenticated(json.user);
    } catch {
      setError('Tidak dapat terhubung ke server autentikasi.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoQuickLogin(demoRole: UserRole) {
    setError('');
    setSuccessMsg('');
    setDemoLoadingRole(demoRole);
    try {
      const creds =
        demoRole === 'admin'
          ? { email: 'yahya@satria.demo', password: 'SatriaAdmin2026!' }
          : { email: 'zaim@satria.demo', password: 'SatriaAnalyst2026!' };

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const json = (await res.json().catch(() => ({}))) as { user?: AuthUser; error?: string };
      if (!res.ok || !json.user) {
        setError(json.error || 'Gagal masuk ke mode demo.');
        return;
      }
      showToast({
        variant: 'success',
        title: `Masuk sebagai ${json.user.name}`,
        description:
          json.user.role === 'admin'
            ? 'Mode Demo Admin aktif dengan kendali penuh konsol Siber Sosial.'
            : 'Mode Demo Analyst aktif untuk analisis narasi dan verifikasi sosial.',
      });
      onAuthenticated(json.user);
    } catch {
      setError('Koneksi ke server lokal gagal.');
    } finally {
      setDemoLoadingRole(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#060C1A] text-slate-100 flex flex-col lg:flex-row">
      {/* Left Narrative / Siber Sosial Context */}
      <motion.div
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="lg:w-[50%] bg-[#091226] border-b lg:border-b-0 lg:border-r border-[#1B2B48] p-8 sm:p-12 lg:p-14 flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center gap-3.5">
            <SatriaLogo size={40} />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">SATRIA SIBER SOSIAL</h1>
              <p className="text-xs text-slate-400">
                Sistem Analisis, Deteksi, dan Respons Terpadu Ancaman Siber Sosial
              </p>
            </div>
          </div>

          <div className="mt-10 max-w-xl">
            <p className="text-xs font-medium text-red-400 tracking-wide mb-3">
              Fokus Domain Tunggal · Ruang Siber Sosial & Kognitif
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight text-balance">
              Pusat Intelijen Narasi, Anti-Disinformasi, dan Respons Rekayasa Sosial
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed">
              Platform terpadu untuk menganalisis percakapan media sosial, memverifikasi klaim viral, mendeteksi akun tiruan, serta mengelola investigasi kasus siber sosial untuk kampus, UMKM, dan komunitas.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            {SOCIAL_CYBER_DOMAINS.map((domain, idx) => (
              <motion.div
                key={domain.index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.04 * idx, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -2 }}
                className="p-4 rounded-lg bg-[#0D1830] border border-[#1B2B48] hover:border-[#2A426E] transition-colors"
              >
                <div className="text-xs font-mono text-red-400 mb-1">{domain.index}</div>
                <h3 className="text-sm font-semibold text-white">{domain.title}</h3>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{domain.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#1B2B48] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <span>
            Mode Autentikasi:{' '}
            <strong className="text-slate-200">
              {supabaseEnabled ? 'Supabase Auth (Live)' : 'DEMO Lokal (Supabase belum dikonfigurasi)'}
            </strong>
          </span>
          <span>Demo Admin: Yahya · Demo Analyst: Zaim</span>
        </div>
      </motion.div>

      {/* Right Authentication & Demo Role Cards (Yahya & Zaim) */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="lg:w-[50%] flex items-center justify-center p-6 sm:p-10"
      >
        <div className="w-full max-w-lg space-y-5">
          <div className="bg-[#0B1428] border border-[#1B2B48] rounded-xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {tab === 'login' ? 'Masuk ke Konsol Siber Sosial' : 'Registrasi Analis Baru'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {supabaseEnabled
                    ? 'Autentikasi terhubung ke Supabase'
                    : 'Mode DEMO aktif · Data tersimpan di sesi lokal server'}
                </p>
              </div>
              <Shield className="w-5 h-5 text-red-500 shrink-0" />
            </div>

            {/* Animated Segmented Tab Switcher */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#060C1A] border border-[#1B2B48] rounded-lg mb-6 relative">
              {(['login', 'register'] as const).map((t) => {
                const active = tab === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTab(t);
                      setError('');
                      setSuccessMsg('');
                    }}
                    className={`relative py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap z-10 ${
                      active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="authTabPill"
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 bg-[#162544] rounded-md -z-10"
                      />
                    )}
                    {t === 'login' ? 'Masuk' : 'Daftar Baru'}
                  </button>
                );
              })}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                role="alert"
                className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200"
              >
                {error}
              </motion.div>
            )}

            {successMsg && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/70 text-xs text-emerald-200"
              >
                {successMsg}
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {tab === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Contoh: Yahya / Zaim"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Peran (Role)
                      </label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white focus:outline-none focus:border-red-500 transition-colors"
                      >
                        <option value="analyst">Analyst (Operasional)</option>
                        <option value="admin">Admin (Kendali Penuh)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Unit / Komunitas
                      </label>
                      <input
                        type="text"
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="Unit Siber Sosial"
                        className="w-full px-3 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Alamat Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yahya@satria.demo atau zaim@satria.demo"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Kata Sandi
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <motion.button
                type="submit"
                disabled={loading || demoLoadingRole !== null}
                whileTap={{ scale: 0.99 }}
                className="w-full py-2.5 px-4 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : tab === 'login' ? (
                  <UserCheck className="w-4 h-4" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                <span>
                  {loading
                    ? 'Memverifikasi Sesi...'
                    : tab === 'login'
                      ? 'Masuk ke Konsol Siber Sosial'
                      : 'Buat Akun & Masuk'}
                </span>
              </motion.button>
            </form>
          </div>

          {/* Distinct Demo Admin (Yahya) vs Demo Analyst (Zaim) Cards */}
          {!supabaseEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="p-4 rounded-xl bg-[#0B1428] border border-red-900/60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-red-400">DEMO ADMIN</span>
                    <UserCog className="w-4 h-4 text-red-400" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">Yahya</div>
                  <div className="text-[11px] font-mono text-slate-400">yahya@satria.demo</div>
                  <ul className="mt-3 space-y-1 text-[11px] text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>Kendali penuh & hapus kasus sosial</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>Simulasi lonjakan narasi & audit</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                      <span>Ekspor Laporan Terpadu PDF</span>
                    </li>
                  </ul>
                </div>
                <motion.button
                  type="button"
                  disabled={loading || demoLoadingRole !== null}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleDemoQuickLogin('admin')}
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 border border-red-700/70 text-xs font-semibold text-red-200 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  {demoLoadingRole === 'admin' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {demoLoadingRole === 'admin' ? 'Memuat Konsol...' : 'Masuk sebagai Yahya (Admin)'}
                  </span>
                </motion.button>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="p-4 rounded-xl bg-[#0B1428] border border-sky-900/60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-sky-400">DEMO ANALYST</span>
                    <ShieldCheck className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">Zaim</div>
                  <div className="text-[11px] font-mono text-slate-400">zaim@satria.demo</div>
                  <ul className="mt-3 space-y-1 text-[11px] text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>Analisis Narasi & Cek Fakta Sosial</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>Deteksi Rekayasa Sosial & Impersonasi</span>
                    </li>
                    <li className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                      <span>Kelola bukti sosial tanpa hapus tiket</span>
                    </li>
                  </ul>
                </div>
                <motion.button
                  type="button"
                  disabled={loading || demoLoadingRole !== null}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleDemoQuickLogin('analyst')}
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-sky-600/20 hover:bg-sky-600/30 border border-sky-700/70 text-xs font-semibold text-sky-200 transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                >
                  {demoLoadingRole === 'analyst' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {demoLoadingRole === 'analyst' ? 'Memuat Konsol...' : 'Masuk sebagai Zaim (Analyst)'}
                  </span>
                </motion.button>
              </motion.div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

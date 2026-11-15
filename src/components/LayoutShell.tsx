import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Bell,
  CheckCheck,
  FileSearch,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareWarning,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  X,
} from 'lucide-react';
import { formatDateTime, getRiskTextClass } from '../lib/format';
import type { AuthUser, SecurityNotification } from '../types/satria';
import { SatriaLogo } from './SatriaLogo';

export type NavPageId =
  | 'dashboard'
  | 'social'
  | 'phishing'
  | 'monitoring'
  | 'incidents'
  | 'reports';

interface LayoutShellProps {
  user: AuthUser;
  activePage: NavPageId;
  onNavigate: (page: NavPageId) => void;
  onLogout: () => void;
  mode: 'supabase' | 'demo';
  notifications: SecurityNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  children: ReactNode;
}

const NAV_ITEMS: Array<{
  id: NavPageId;
  label: string;
  subtitle: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard Siber Sosial',
    subtitle: 'Ringkasan ruang kognitif',
    icon: LayoutDashboard,
  },
  {
    id: 'social',
    label: 'Intelijen Narasi Sosial',
    subtitle: 'Sentimen & verifikasi fakta',
    icon: MessageSquareWarning,
  },
  {
    id: 'phishing',
    label: 'Deteksi Rekayasa Sosial',
    subtitle: 'Umpan DM & akun tiruan',
    icon: ShieldAlert,
  },
  {
    id: 'monitoring',
    label: 'Monitoring Siber Sosial',
    subtitle: 'Aktivitas tren & audit',
    icon: Activity,
  },
  {
    id: 'incidents',
    label: 'Investigasi Kasus Sosial',
    subtitle: 'Bukti, kronologi & AI',
    icon: FileSearch,
  },
  {
    id: 'reports',
    label: 'Pusat Laporan Sosial',
    subtitle: 'Arsip & ekspor PDF',
    icon: FileText,
  },
];

export function LayoutShell({
  user,
  activePage,
  onNavigate,
  onLogout,
  mode,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  children,
}: LayoutShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeItem = NAV_ITEMS.find((i) => i.id === activePage) || NAV_ITEMS[0];
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (!notifOpen && !mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [notifOpen, mobileMenuOpen]);

  function handleSelectNav(page: NavPageId) {
    onNavigate(page);
    setMobileMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-[#060C1A] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#091226] border-r border-[#1B2B48] z-30">
        <div className="h-16 px-5 flex items-center gap-3 border-b border-[#1B2B48]">
          <SatriaLogo size={30} />
          <div className="min-w-0">
            <div className="text-sm font-bold tracking-tight text-white truncate">
              SATRIA SIBER SOSIAL
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {mode === 'demo' ? 'Mode DEMO Lokal' : 'Terhubung Supabase'}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Navigasi utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.99 }}
                onClick={() => handleSelectNav(item.id)}
                className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-300 hover:bg-[#0E1A33] hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="sidebarActiveBg"
                    transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 bg-[#132240] border border-[#263C66] rounded-lg -z-10"
                  />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-red-400' : 'text-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{item.label}</div>
                  <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
                </div>
              </motion.button>
            );
          })}
        </nav>

        {/* Distinct Role Profile Footer */}
        <div className="p-4 border-t border-[#1B2B48] bg-[#081022]">
          <div className="flex items-center gap-2 mb-1.5">
            {isAdmin ? (
              <UserCog className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span
              className={`text-[11px] font-bold tracking-wide ${
                isAdmin ? 'text-red-400' : 'text-sky-400'
              }`}
            >
              {isAdmin ? 'ADMIN · KENDALI PENUH' : 'ANALYST · OPERASIONAL'}
            </span>
          </div>
          <div className="text-xs font-semibold text-white truncate">{user.name}</div>
          <div className="mt-0.5 text-[11px] text-slate-400 truncate">{user.organization}</div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={onLogout}
            className="mt-3 w-full py-2 px-3 rounded-lg bg-[#101C36] hover:bg-red-950/60 border border-[#223456] hover:border-red-800/70 text-xs font-medium text-slate-200 hover:text-red-200 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Ganti Akun / Keluar</span>
          </motion.button>
        </div>
      </aside>

      {/* Mobile / Tablet Drawer Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 bg-black/70"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-72 max-w-[85vw] bg-[#091226] border-r border-[#1B2B48] flex flex-col h-full z-10"
            >
              <div className="h-16 px-5 flex items-center justify-between border-b border-[#1B2B48]">
                <div className="flex items-center gap-2.5">
                  <SatriaLogo size={28} />
                  <span className="text-sm font-bold text-white">SATRIA SIBER SOSIAL</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Tutup menu"
                  className="p-2 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectNav(item.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-lg text-left transition-colors ${
                        isActive
                          ? 'bg-[#132240] text-white border border-[#263C66]'
                          : 'text-slate-300 hover:bg-[#0E1A33]'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-red-400' : 'text-slate-400'}`} />
                      <div>
                        <div className="text-sm font-medium">{item.label}</div>
                        <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                      </div>
                    </button>
                  );
                })}
              </nav>
              <div className="p-4 border-t border-[#1B2B48]">
                <div
                  className={`text-[11px] font-bold mb-1 ${
                    isAdmin ? 'text-red-400' : 'text-sky-400'
                  }`}
                >
                  {isAdmin ? 'ADMIN · KENDALI PENUH' : 'ANALYST · OPERASIONAL'}
                </div>
                <div className="text-xs font-semibold text-white">{user.name}</div>
                <div className="text-[11px] text-slate-400 mb-3">{user.organization}</div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full py-2 px-3 rounded-lg bg-[#101C36] border border-[#223456] text-xs font-medium text-slate-200 flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Ganti Akun / Keluar</span>
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 h-16 bg-[#081022]/95 backdrop-blur border-b border-[#1B2B48] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka navigasi"
              className="lg:hidden p-2 rounded-lg bg-[#0E1A33] border border-[#1E2F50] text-slate-200"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="hidden sm:inline whitespace-nowrap">SATRIA SIBER SOSIAL</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  /
                </span>
                <span className="text-sm font-semibold text-white truncate">
                  {activeItem.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-xs font-mono text-slate-400 whitespace-nowrap">
              {mode === 'demo' ? 'DEMO' : 'LIVE'} ·{' '}
              <span className={isAdmin ? 'text-red-400 font-semibold' : 'text-sky-400 font-semibold'}>
                {user.name} ({isAdmin ? 'ADMIN' : 'ANALYST'})
              </span>
            </span>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label="Buka panel notifikasi siber sosial"
              className="relative py-2 px-3 rounded-lg bg-[#0F1B35] hover:bg-[#152548] border border-[#223456] text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Bell className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Notifikasi</span>
              <motion.span
                key={unreadCount}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.16 }}
                className="font-mono tabular-nums text-xs text-red-400 font-semibold"
              >
                {unreadCount}
              </motion.span>
            </motion.button>
          </div>
        </header>

        {/* Main Viewport with Smooth Page Transition */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Notification Slide-over Panel */}
      <AnimatePresence>
        {notifOpen && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 bg-black/60"
              onClick={() => setNotifOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ x: 380 }}
              animate={{ x: 0 }}
              exit={{ x: 380 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-md bg-[#091226] border-l border-[#1B2B48] h-full flex flex-col z-10"
            >
              <div className="p-5 border-b border-[#1B2B48] flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white">Notifikasi Siber Sosial</h2>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    {unreadCount} belum dibaca dari {notifications.length} peringatan
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onMarkAllNotificationsRead}
                      className="py-1.5 px-2.5 rounded-md bg-[#111E38] hover:bg-[#192B50] border border-[#24375C] text-xs text-slate-200 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Tandai Semua</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setNotifOpen(false)}
                    aria-label="Tutup panel notifikasi"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-[#162440]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-400">
                    Belum ada notifikasi Siber Sosial.
                  </div>
                ) : (
                  notifications.map((notif, idx) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.16, delay: idx * 0.03 }}
                      className={`p-4 transition-colors ${
                        notif.read ? 'bg-[#091226] opacity-75' : 'bg-[#0E1A33]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs text-slate-400 flex items-center gap-2">
                          <span className={`font-semibold ${getRiskTextClass(notif.severity)}`}>
                            {notif.severity}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{notif.category}</span>
                          {notif.isDemo && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-amber-400">DEMO</span>
                            </>
                          )}
                        </div>
                        <span className="text-[11px] font-mono text-slate-500 tabular-nums whitespace-nowrap">
                          {formatDateTime(notif.createdAt)}
                        </span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-semibold text-white">{notif.title}</h3>
                      <p className="mt-1 text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                      {!notif.read && (
                        <button
                          type="button"
                          onClick={() => onMarkNotificationRead(notif.id)}
                          className="mt-2.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors"
                        >
                          Tandai sudah dibaca
                        </button>
                      )}
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

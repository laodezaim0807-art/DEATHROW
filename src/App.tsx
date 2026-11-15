import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { IncidentsView } from './components/IncidentsView';
import { LayoutShell, type NavPageId } from './components/LayoutShell';
import { MonitoringView } from './components/MonitoringView';
import { PhishingDetectionView } from './components/PhishingDetectionView';
import { ReportCenterView } from './components/ReportCenterView';
import { DashboardSkeleton } from './components/Skeletons';
import { SocialIntelView } from './components/SocialIntelView';
import { ToastProvider } from './components/ToastProvider';
import { getSupabaseClient } from './lib/supabase';
import type {
  AuthUser,
  IncidentRecord,
  PhishingAnalysis,
  SatriaDashboardData,
  SecurityLog,
  SocialIntelAnalysis,
} from './types/satria';

const SESSION_KEY = 'satria_auth_user';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? (JSON.parse(saved) as AuthUser) : null;
    } catch {
      return null;
    }
  });
  const [activePage, setActivePage] = useState<NavPageId>('dashboard');
  const [serverMode, setServerMode] = useState<'supabase' | 'demo'>('demo');
  const [data, setData] = useState<SatriaDashboardData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');
  const fetchSeqRef = useRef(0);
  const isAuthenticatedRef = useRef(Boolean(user));
  isAuthenticatedRef.current = Boolean(user);

  const loadDashboardData = useCallback(async (): Promise<boolean> => {
    const seq = ++fetchSeqRef.current;
    setLoadingData(true);
    setDataError('');
    try {
      const res = await fetch('/api/data');
      if (!res.ok) {
        if (seq === fetchSeqRef.current) {
          setDataError('Gagal memuat data konsol Siber Sosial dari server.');
        }
        return false;
      }
      const json = (await res.json()) as SatriaDashboardData;
      if (seq === fetchSeqRef.current && isAuthenticatedRef.current) {
        setData(json);
        setServerMode(json.mode);
      }
      return true;
    } catch {
      if (seq === fetchSeqRef.current) {
        setDataError('Tidak dapat terhubung ke server SATRIA SIBER SOSIAL.');
      }
      return false;
    } finally {
      if (seq === fetchSeqRef.current) {
        setLoadingData(false);
      }
    }
  }, []);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((json: { mode?: 'supabase' | 'demo' }) => {
        if (json.mode) setServerMode(json.mode);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      void loadDashboardData();
    }
  }, [user, loadDashboardData]);

  function handleAuthenticated(nextUser: AuthUser) {
    isAuthenticatedRef.current = true;
    setUser(nextUser);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextUser));
    } catch {
      // Ignore storage errors
    }
    setActivePage('dashboard');
  }

  async function handleLogout() {
    fetchSeqRef.current += 1;
    isAuthenticatedRef.current = false;
    if (user) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      }).catch(() => {});
    }
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore storage errors
    }
    setUser(null);
    setData(null);
    setDataError('');
  }

  async function handleMarkNotificationRead(id: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n,
            ),
          }
        : prev,
    );
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => {});
  }

  async function handleMarkAllNotificationsRead() {
    setData((prev) =>
      prev
        ? {
            ...prev,
            notifications: prev.notifications.map((n) => ({ ...n, read: true })),
          }
        : prev,
    );
    await fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
  }

  function handlePhishingCreated(analysis: PhishingAnalysis) {
    setData((prev) =>
      prev
        ? { ...prev, phishingAnalyses: [analysis, ...prev.phishingAnalyses] }
        : prev,
    );
    void loadDashboardData();
  }

  function handleSocialCreated(analysis: SocialIntelAnalysis) {
    setData((prev) =>
      prev ? { ...prev, socialAnalyses: [analysis, ...prev.socialAnalyses] } : prev,
    );
    void loadDashboardData();
  }

  function handleLogAdded(log: SecurityLog) {
    setData((prev) =>
      prev ? { ...prev, securityLogs: [log, ...prev.securityLogs] } : prev,
    );
    void loadDashboardData();
  }

  function handleIncidentCreated(incident: IncidentRecord) {
    setData((prev) =>
      prev ? { ...prev, incidents: [incident, ...prev.incidents] } : prev,
    );
    void loadDashboardData();
  }

  function handleIncidentUpdated(incident: IncidentRecord) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            incidents: prev.incidents.map((i) => (i.id === incident.id ? incident : i)),
          }
        : prev,
    );
    void loadDashboardData();
  }

  function handleIncidentDeleted(id: string) {
    setData((prev) =>
      prev
        ? { ...prev, incidents: prev.incidents.filter((i) => i.id !== id) }
        : prev,
    );
    void loadDashboardData();
  }

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        {!user ? (
          <AuthScreen onAuthenticated={handleAuthenticated} serverMode={serverMode} />
        ) : !data && dataError && !loadingData ? (
          <div className="min-h-screen bg-[#060C1A] text-slate-100 flex items-center justify-center p-6">
            <div className="max-w-md w-full p-6 rounded-xl bg-[#0B1428] border border-red-800/70 space-y-4 text-center">
              <h1 className="text-lg font-bold text-white">Gagal Memuat Data Konsol</h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{dataError}</p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => void loadDashboardData()}
                  className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors"
                >
                  Coba Lagi
                </button>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="py-2 px-4 rounded-lg bg-[#101C36] border border-[#223456] text-xs font-medium text-slate-200 hover:text-white transition-colors"
                >
                  Keluar
                </button>
              </div>
            </div>
          </div>
        ) : !data || (loadingData && !data) ? (
          <DashboardSkeleton />
        ) : (
          <LayoutShell
            user={user}
            activePage={activePage}
            onNavigate={setActivePage}
            onLogout={() => void handleLogout()}
            mode={data.mode}
            notifications={data.notifications}
            onMarkNotificationRead={(id) => void handleMarkNotificationRead(id)}
            onMarkAllNotificationsRead={() => void handleMarkAllNotificationsRead()}
          >
            {activePage === 'dashboard' && (
              <DashboardView
                user={user}
                data={data}
                onNavigate={setActivePage}
                onMarkNotificationRead={(id) => void handleMarkNotificationRead(id)}
                onRefreshData={loadDashboardData}
              />
            )}

            {activePage === 'social' && (
              <SocialIntelView
                user={user}
                analyses={data.socialAnalyses}
                onAnalysisCreated={handleSocialCreated}
              />
            )}

            {activePage === 'phishing' && (
              <PhishingDetectionView
                user={user}
                analyses={data.phishingAnalyses}
                onAnalysisCreated={handlePhishingCreated}
              />
            )}

            {activePage === 'monitoring' && (
              <MonitoringView user={user} logs={data.securityLogs} onLogAdded={handleLogAdded} />
            )}

            {activePage === 'incidents' && (
              <IncidentsView
                user={user}
                incidents={data.incidents}
                onIncidentCreated={handleIncidentCreated}
                onIncidentUpdated={handleIncidentUpdated}
                onIncidentDeleted={handleIncidentDeleted}
              />
            )}

            {activePage === 'reports' && <ReportCenterView user={user} data={data} />}
          </LayoutShell>
        )}
      </ToastProvider>
    </MotionConfig>
  );
}

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  analyzePhishingWithAI,
  analyzeSocialIntelWithAI,
  generateIncidentSummaryWithAI,
} from './server/ai.ts';
import {
  getDb,
  getPublicDashboardData,
  isSupabaseConfigured,
  saveDb,
  syncRecordToSupabase,
} from './server/store.ts';
import type {
  AuthUser,
  DigitalEvidence,
  IncidentRecord,
  IncidentStatus,
  LogCategory,
  PhishingAnalysis,
  SatriaPillar,
  SecurityLog,
  SecurityNotification,
  SeverityLevel,
  SocialIntelAnalysis,
  TimelineEntry,
  UserRole,
} from './src/types/satria.ts';

const PORT = 3000;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

function appendLogAndSave(log: SecurityLog): void {
  const db = getDb();
  db.securityLogs.unshift(log);
  if (db.securityLogs.length > 200) {
    db.securityLogs = db.securityLogs.slice(0, 200);
  }
  saveDb(db);
  void syncRecordToSupabase('security_logs', log as unknown as Record<string, unknown>);
}

function appendNotification(notif: SecurityNotification): void {
  const db = getDb();
  db.notifications.unshift(notif);
  if (db.notifications.length > 50) {
    db.notifications = db.notifications.slice(0, 50);
  }
  saveDb(db);
}

const VALID_PILLARS: SatriaPillar[] = [
  'Disinformasi & Hoaks',
  'Rekayasa Sosial & Impersonasi',
  'Analisis Narasi & Sentimen',
  'Operasi Kognitif & Bot',
];
const VALID_SEVERITIES: SeverityLevel[] = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];
const VALID_STATUSES: IncidentStatus[] = [
  'Terbuka',
  'Sedang Diinvestigasi',
  'Terkendali',
  'Selesai',
];
const VALID_LOG_CATEGORIES: LogCategory[] = [
  'Siber Sosial',
  'Rekayasa Sosial',
  'Disinformasi',
  'Investigasi Kasus',
  'Autentikasi',
  'Sistem',
];

function getNextIncidentCode(incidents: IncidentRecord[]): string {
  const year = new Date().getFullYear();
  let maxNum = 0;
  for (const inc of incidents) {
    const match = inc.code.match(/(\d+)$/);
    if (match) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isFinite(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  }
  return `SOC-${year}-${String(maxNum + 1).padStart(3, '0')}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ error: 'Format payload JSON tidak valid.' });
        return;
      }
      next(err);
    },
  );

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      mode: isSupabaseConfigured() ? 'supabase' : 'demo',
      geminiConfigured: Boolean(
        process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
      ),
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = (req.body || {}) as { email?: string; password?: string };
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = password || '';

    if (!cleanEmail || !cleanPassword) {
      res.status(400).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const db = getDb();
    const aliasEmail =
      cleanEmail === 'admin@satria.demo'
        ? 'yahya@satria.demo'
        : cleanEmail === 'analyst@satria.demo'
          ? 'zaim@satria.demo'
          : cleanEmail;

    const matched = db.users.find(
      (u) => u.email.toLowerCase() === aliasEmail && u.password === cleanPassword,
    );

    if (!matched) {
      const ip = getClientIp(req);
      appendLogAndSave({
        id: makeId('log'),
        timestamp: new Date().toISOString(),
        category: 'Autentikasi',
        severity: 'Sedang',
        actor: cleanEmail,
        ipAddress: ip,
        event: `Percobaan login gagal pada konsol Siber Sosial untuk ${cleanEmail}`,
        status: 'Gagal',
        pillar: 'Rekayasa Sosial & Impersonasi',
        sourceType: 'APP LOG',
      });

      const recentFailures = db.securityLogs.filter(
        (l) =>
          l.category === 'Autentikasi' &&
          l.status === 'Gagal' &&
          l.actor === cleanEmail &&
          Date.now() - new Date(l.timestamp).getTime() < 15 * 60 * 1000,
      ).length;

      if (recentFailures >= 3) {
        appendNotification({
          id: makeId('notif'),
          title: 'Aktivitas Login Gagal Berulang',
          message: `Terdeteksi ${recentFailures} kali kegagalan autentikasi untuk ${cleanEmail}.`,
          severity: 'Tinggi',
          category: 'Autentikasi',
          createdAt: new Date().toISOString(),
          read: false,
          isDemo: false,
        });
      }

      res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.' });
      return;
    }

    appendLogAndSave({
      id: makeId('log'),
      timestamp: new Date().toISOString(),
      category: 'Autentikasi',
      severity: 'Rendah',
      actor: matched.email,
      ipAddress: getClientIp(req),
      event: `Login berhasil sebagai ${matched.role.toUpperCase()} (${matched.name})`,
      status: 'Berhasil',
      pillar: 'Analisis Narasi & Sentimen',
      sourceType: 'APP LOG',
    });

    const user: AuthUser = {
      id: matched.id,
      name: matched.name,
      email: matched.email,
      role: matched.role,
      organization: matched.organization,
      authMode: 'demo',
    };
    res.json({ user });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role, organization } = (req.body || {}) as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      organization?: string;
    };

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = password || '';
    const cleanRole: UserRole = role === 'admin' ? 'admin' : 'analyst';
    const cleanOrg = (organization || 'Organisasi Mitra').trim();

    if (!cleanName || !cleanEmail || cleanPassword.length < 6) {
      res.status(400).json({
        error: 'Nama, email valid, dan kata sandi minimal 6 karakter wajib diisi.',
      });
      return;
    }

    const db = getDb();
    if (db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: 'Email sudah terdaftar pada sistem.' });
      return;
    }

    const newUser = {
      id: makeId('usr'),
      name: cleanName,
      email: cleanEmail,
      password: cleanPassword,
      role: cleanRole,
      organization: cleanOrg,
    };

    db.users.push(newUser);
    saveDb(db);

    appendLogAndSave({
      id: makeId('log'),
      timestamp: new Date().toISOString(),
      category: 'Autentikasi',
      severity: 'Rendah',
      actor: cleanEmail,
      ipAddress: getClientIp(req),
      event: `Registrasi pengguna baru dengan peran ${cleanRole.toUpperCase()} (${cleanOrg})`,
      status: 'Berhasil',
      pillar: 'Analisis Narasi & Sentimen',
      sourceType: 'APP LOG',
    });

    const user: AuthUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      organization: newUser.organization,
      authMode: 'demo',
    };
    res.status(201).json({ user });
  });

  app.post('/api/auth/logout', (req, res) => {
    const { email } = (req.body || {}) as { email?: string };
    if (email) {
      appendLogAndSave({
        id: makeId('log'),
        timestamp: new Date().toISOString(),
        category: 'Autentikasi',
        severity: 'Rendah',
        actor: email,
        ipAddress: getClientIp(req),
        event: `Pengguna ${email} keluar dari sesi konsol Siber Sosial`,
        status: 'Berhasil',
        pillar: 'Analisis Narasi & Sentimen',
        sourceType: 'APP LOG',
      });
    }
    res.json({ ok: true });
  });

  app.post('/api/auth/log-external', (req, res) => {
    const { email, status, detail } = (req.body || {}) as {
      email?: string;
      status?: 'Berhasil' | 'Gagal';
      detail?: string;
    };
    appendLogAndSave({
      id: makeId('log'),
      timestamp: new Date().toISOString(),
      category: 'Autentikasi',
      severity: status === 'Gagal' ? 'Sedang' : 'Rendah',
      actor: email || 'pengguna-supabase',
      ipAddress: getClientIp(req),
      event: detail || `Aktivitas autentikasi Supabase (${status || 'Berhasil'})`,
      status: status === 'Gagal' ? 'Gagal' : 'Berhasil',
      pillar: 'Analisis Narasi & Sentimen',
      sourceType: 'APP LOG',
    });
    res.json({ ok: true });
  });

  app.get('/api/data', (_req, res) => {
    res.json(getPublicDashboardData());
  });

  app.post('/api/analyze/phishing', async (req, res) => {
    try {
      const { urlInput, messageInput, analystName } = (req.body || {}) as {
        urlInput?: string;
        messageInput?: string;
        analystName?: string;
      };

      const cleanUrl = (urlInput || '').trim();
      const cleanMsg = (messageInput || '').trim();

      if (!cleanUrl && !cleanMsg) {
        res.status(400).json({ error: 'Masukkan tautan URL atau teks pesan untuk dianalisis.' });
        return;
      }

      const result = await analyzePhishingWithAI({
        urlInput: cleanUrl,
        messageInput: cleanMsg,
      });

      const inputType: PhishingAnalysis['inputType'] =
        cleanUrl && cleanMsg ? 'combined' : cleanUrl ? 'url' : 'message';

      const record: PhishingAnalysis = {
        id: makeId('ph'),
        createdAt: new Date().toISOString(),
        analystName: (analystName || '').trim() || 'Analis Keamanan',
        inputType,
        urlInput: cleanUrl,
        messageInput: cleanMsg,
        riskScore: result.riskScore,
        riskCategory: result.riskCategory,
        ruleScore: result.ruleScore,
        aiScore: result.aiScore,
        indicators: result.indicators,
        explanation: result.explanation,
        safetyCaveat: result.safetyCaveat,
        recommendations: result.recommendations,
        pillar: result.pillar,
        isDemo: false,
      };

      const db = getDb();
      db.phishingAnalyses.unshift(record);
      saveDb(db);
      void syncRecordToSupabase('phishing_analyses', record as unknown as Record<string, unknown>);

      appendLogAndSave({
        id: makeId('log'),
        timestamp: record.createdAt,
        category: 'Rekayasa Sosial',
        severity:
          record.riskCategory === 'Tinggi'
            ? 'Tinggi'
            : record.riskCategory === 'Sedang'
              ? 'Sedang'
              : 'Rendah',
        actor: record.analystName,
        ipAddress: getClientIp(req),
        event: `Deteksi rekayasa sosial selesai: skor ${record.riskScore}/100 (${record.riskCategory})`,
        status: record.riskCategory === 'Tinggi' ? 'Peringatan' : 'Berhasil',
        pillar: record.pillar,
        sourceType: 'APP LOG',
      });

      if (record.riskCategory === 'Tinggi') {
        appendNotification({
          id: makeId('notif'),
          title: `Indikasi Rekayasa Sosial Risiko Tinggi (${record.riskScore}/100)`,
          message: cleanUrl
            ? `Tautan sosial ${cleanUrl.slice(0, 60)} terindikasi umpan impersonasi/penipuan.`
            : 'Pesan sosial teranalisis menunjukkan pola manipulasi psikologis risiko tinggi.',
          severity: 'Tinggi',
          category: 'Rekayasa Sosial',
          createdAt: record.createdAt,
          read: false,
          isDemo: false,
        });
      }

      res.status(201).json({ analysis: record, usedFallback: result.usedFallback });
    } catch (error) {
      console.error('Error in /api/analyze/phishing:', error);
      res.status(500).json({ error: 'Terjadi kesalahan internal saat menganalisis rekayasa sosial.' });
    }
  });

  app.post('/api/analyze/social', async (req, res) => {
    try {
      const { inputText, sourcePlatform, sourceUrl, analystName } = (req.body || {}) as {
        inputText?: string;
        sourcePlatform?: string;
        sourceUrl?: string;
        analystName?: string;
      };

      const cleanText = (inputText || '').trim();
      if (cleanText.length < 10) {
        res.status(400).json({ error: 'Masukkan teks berita atau unggahan minimal 10 karakter.' });
        return;
      }

      const cleanPlatform = (sourcePlatform || 'Media Sosial').trim() || 'Media Sosial';
      const result = await analyzeSocialIntelWithAI({
        inputText: cleanText,
        sourcePlatform: cleanPlatform,
      });

      const record: SocialIntelAnalysis = {
        id: makeId('soc'),
        createdAt: new Date().toISOString(),
        analystName: (analystName || '').trim() || 'Analis Siber Sosial',
        sourcePlatform: cleanPlatform,
        sourceUrl: (sourceUrl || '').trim() || undefined,
        inputText: cleanText,
        sentiment: result.sentiment,
        sentimentScores: result.sentimentScores,
        classification: result.classification,
        verificationIndicators: result.verificationIndicators,
        narrativeAnalysis: result.narrativeAnalysis,
        factCheckRecommendations: result.factCheckRecommendations,
        confidenceLevel: result.confidenceLevel,
        analysisLimitations: result.analysisLimitations,
        pillar: result.pillar,
        isDemo: false,
      };

      const db = getDb();
      db.socialAnalyses.unshift(record);
      saveDb(db);
      void syncRecordToSupabase('social_analyses', record as unknown as Record<string, unknown>);

      appendLogAndSave({
        id: makeId('log'),
        timestamp: record.createdAt,
        category: 'Siber Sosial',
        severity: record.sentiment === 'Negatif' ? 'Sedang' : 'Rendah',
        actor: record.analystName,
        ipAddress: getClientIp(req),
        event: `Analisis Narasi Sosial (${record.sourcePlatform}): ${record.classification} — Sentimen ${record.sentiment}`,
        status: record.sentiment === 'Negatif' ? 'Peringatan' : 'Berhasil',
        pillar: result.pillar,
        sourceType: 'APP LOG',
      });

      res.status(201).json({ analysis: record, usedFallback: result.usedFallback });
    } catch (error) {
      console.error('Error in /api/analyze/social:', error);
      res.status(500).json({ error: 'Terjadi kesalahan internal saat menganalisis narasi sosial.' });
    }
  });

  app.post('/api/logs', (req, res) => {
    const { category, severity, actor, ipAddress, event, status, pillar, sourceType } =
      (req.body || {}) as {
        category?: LogCategory;
        severity?: SeverityLevel;
        actor?: string;
        ipAddress?: string;
        event?: string;
        status?: SecurityLog['status'];
        pillar?: SatriaPillar;
        sourceType?: 'DEMO' | 'APP LOG';
      };

    const cleanEvent = (event || '').trim();
    if (!cleanEvent) {
      res.status(400).json({ error: 'Deskripsi aktivitas wajib diisi.' });
      return;
    }

    const safeCategory: LogCategory =
      category && VALID_LOG_CATEGORIES.includes(category) ? category : 'Siber Sosial';
    const safeSeverity: SeverityLevel =
      severity && VALID_SEVERITIES.includes(severity) ? severity : 'Sedang';
    const safePillar: SatriaPillar =
      pillar && VALID_PILLARS.includes(pillar) ? pillar : 'Operasi Kognitif & Bot';
    const safeStatus: SecurityLog['status'] =
      status && ['Berhasil', 'Gagal', 'Diblokir', 'Peringatan'].includes(status)
        ? status
        : 'Peringatan';

    const log: SecurityLog = {
      id: makeId('log'),
      timestamp: new Date().toISOString(),
      category: safeCategory,
      severity: safeSeverity,
      actor: (actor || '').trim() || 'Simulasi Operator',
      ipAddress: (ipAddress || '').trim() || getClientIp(req),
      event: cleanEvent,
      status: safeStatus,
      pillar: safePillar,
      sourceType: sourceType === 'APP LOG' ? 'APP LOG' : 'DEMO',
    };

    appendLogAndSave(log);

    if (log.severity === 'Tinggi' || log.severity === 'Kritis') {
      appendNotification({
        id: makeId('notif'),
        title: `Peringatan Siber Sosial (${log.severity})`,
        message: log.event,
        severity: log.severity,
        category: log.category,
        createdAt: log.timestamp,
        read: false,
        isDemo: log.sourceType === 'DEMO',
      });
    }

    res.status(201).json({ log });
  });

  app.post('/api/notifications/:id/read', (req, res) => {
    const db = getDb();
    const target = db.notifications.find((n) => n.id === req.params.id);
    if (target) {
      target.read = true;
      saveDb(db);
    }
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', (_req, res) => {
    const db = getDb();
    db.notifications = db.notifications.map((n) => ({ ...n, read: true }));
    saveDb(db);
    res.json({ ok: true });
  });

  app.post('/api/incidents', (req, res) => {
    const { title, description, pillar, severity, status, affectedAsset, reporter, assignedTo } =
      (req.body || {}) as {
        title?: string;
        description?: string;
        pillar?: SatriaPillar;
        severity?: SeverityLevel;
        status?: IncidentStatus;
        affectedAsset?: string;
        reporter?: string;
        assignedTo?: string;
      };

    const cleanTitle = (title || '').trim();
    const cleanDesc = (description || '').trim();
    if (!cleanTitle || !cleanDesc) {
      res.status(400).json({ error: 'Judul dan deskripsi insiden wajib diisi.' });
      return;
    }

    const db = getDb();
    const now = new Date().toISOString();
    const cleanReporter = (reporter || '').trim() || 'Analis Siber Sosial';

    const incident: IncidentRecord = {
      id: makeId('inc'),
      code: getNextIncidentCode(db.incidents),
      title: cleanTitle,
      description: cleanDesc,
      pillar: pillar && VALID_PILLARS.includes(pillar) ? pillar : 'Disinformasi & Hoaks',
      severity: severity && VALID_SEVERITIES.includes(severity) ? severity : 'Sedang',
      status: status && VALID_STATUSES.includes(status) ? status : 'Terbuka',
      affectedAsset: (affectedAsset || '').trim() || 'Komunitas & Kanal Media Sosial',
      reporter: cleanReporter,
      assignedTo: (assignedTo || '').trim() || cleanReporter || 'Tim Siber Sosial',
      createdAt: now,
      updatedAt: now,
      evidence: [],
      timeline: [
        {
          id: makeId('tl'),
          timestamp: now,
          actor: cleanReporter,
          action: 'Kasus Siber Sosial Dibuat',
          notes: 'Tiket investigasi awal didaftarkan ke konsol SATRIA SIBER SOSIAL.',
        },
      ],
      aiSummary: '',
      isDemo: false,
    };

    db.incidents.unshift(incident);
    saveDb(db);
    void syncRecordToSupabase('incidents', incident as unknown as Record<string, unknown>);

    appendLogAndSave({
      id: makeId('log'),
      timestamp: now,
      category: 'Investigasi Kasus',
      severity: incident.severity,
      actor: incident.reporter,
      ipAddress: getClientIp(req),
      event: `Membuat tiket kasus ${incident.code}: ${incident.title}`,
      status: 'Berhasil',
      pillar: incident.pillar,
      sourceType: 'APP LOG',
    });

    if (incident.severity === 'Tinggi' || incident.severity === 'Kritis') {
      appendNotification({
        id: makeId('notif'),
        title: `Kasus Siber Sosial Baru ${incident.code} (${incident.severity})`,
        message: incident.title,
        severity: incident.severity,
        category: 'Investigasi Kasus',
        createdAt: now,
        read: false,
        isDemo: false,
      });
    }

    res.status(201).json({ incident });
  });

  app.put('/api/incidents/:id', (req, res) => {
    const db = getDb();
    const idx = db.incidents.findIndex((i) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Kasus tidak ditemukan.' });
      return;
    }

    const existing = db.incidents[idx];
    const updates = (req.body || {}) as Partial<IncidentRecord> & { actorName?: string };

    if (updates.title !== undefined && !updates.title.trim()) {
      res.status(400).json({ error: 'Judul kasus tidak boleh kosong.' });
      return;
    }
    if (updates.description !== undefined && !updates.description.trim()) {
      res.status(400).json({ error: 'Deskripsi kasus tidak boleh kosong.' });
      return;
    }

    const updated: IncidentRecord = {
      ...existing,
      title: updates.title !== undefined ? updates.title.trim() : existing.title,
      description:
        updates.description !== undefined ? updates.description.trim() : existing.description,
      pillar:
        updates.pillar && VALID_PILLARS.includes(updates.pillar)
          ? updates.pillar
          : existing.pillar,
      severity:
        updates.severity && VALID_SEVERITIES.includes(updates.severity)
          ? updates.severity
          : existing.severity,
      status:
        updates.status && VALID_STATUSES.includes(updates.status)
          ? updates.status
          : existing.status,
      affectedAsset:
        updates.affectedAsset !== undefined
          ? updates.affectedAsset.trim() || existing.affectedAsset
          : existing.affectedAsset,
      assignedTo:
        updates.assignedTo !== undefined
          ? updates.assignedTo.trim() || existing.assignedTo
          : existing.assignedTo,
      aiSummary: updates.aiSummary !== undefined ? updates.aiSummary : existing.aiSummary,
      updatedAt: new Date().toISOString(),
    };

    db.incidents[idx] = updated;
    saveDb(db);
    void syncRecordToSupabase('incidents', updated as unknown as Record<string, unknown>);

    appendLogAndSave({
      id: makeId('log'),
      timestamp: updated.updatedAt,
      category: 'Investigasi Kasus',
      severity: 'Rendah',
      actor: (updates.actorName || '').trim() || updated.assignedTo,
      ipAddress: getClientIp(req),
      event: `Memperbarui kasus ${updated.code} (Status: ${updated.status})`,
      status: 'Berhasil',
      pillar: updated.pillar,
      sourceType: 'APP LOG',
    });

    res.json({ incident: updated });
  });

  app.delete('/api/incidents/:id', (req, res) => {
    const body = (req.body || {}) as { actorName?: string; actorRole?: UserRole };
    if (body.actorRole !== 'admin') {
      res.status(403).json({
        error: 'Akses ditolak: Hanya peran Admin yang berwenang menghapus tiket kasus.',
      });
      return;
    }

    const db = getDb();
    const idx = db.incidents.findIndex((i) => i.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Kasus tidak ditemukan.' });
      return;
    }

    const [removed] = db.incidents.splice(idx, 1);
    saveDb(db);

    const actorName = (body.actorName || '').trim() || 'Admin Siber Sosial';
    appendLogAndSave({
      id: makeId('log'),
      timestamp: new Date().toISOString(),
      category: 'Investigasi Kasus',
      severity: 'Sedang',
      actor: actorName,
      ipAddress: getClientIp(req),
      event: `Menghapus kasus ${removed.code}: ${removed.title}`,
      status: 'Berhasil',
      pillar: removed.pillar,
      sourceType: 'APP LOG',
    });

    res.json({ ok: true });
  });

  app.post('/api/incidents/:id/evidence', (req, res) => {
    const db = getDb();
    const incident = db.incidents.find((i) => i.id === req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Kasus tidak ditemukan.' });
      return;
    }

    const { label, evidenceType, value, collectedBy } = (req.body || {}) as Partial<DigitalEvidence>;
    const cleanLabel = (label || '').trim();
    const cleanValue = (value || '').trim();
    if (!cleanLabel || !cleanValue) {
      res.status(400).json({ error: 'Label dan nilai bukti digital wajib diisi.' });
      return;
    }

    const evidence: DigitalEvidence = {
      id: makeId('ev'),
      label: cleanLabel,
      evidenceType: evidenceType || 'Tautan / Akun Sosial',
      value: cleanValue,
      collectedBy: (collectedBy || '').trim() || 'Analis Siber Sosial',
      collectedAt: new Date().toISOString(),
    };

    incident.evidence.push(evidence);
    incident.updatedAt = evidence.collectedAt;
    saveDb(db);
    void syncRecordToSupabase('incidents', incident as unknown as Record<string, unknown>);

    appendLogAndSave({
      id: makeId('log'),
      timestamp: evidence.collectedAt,
      category: 'Investigasi Kasus',
      severity: 'Rendah',
      actor: evidence.collectedBy,
      ipAddress: getClientIp(req),
      event: `Menambahkan bukti sosial "${evidence.label}" pada ${incident.code}`,
      status: 'Berhasil',
      pillar: incident.pillar,
      sourceType: 'APP LOG',
    });

    res.status(201).json({ incident, evidence });
  });

  app.post('/api/incidents/:id/timeline', (req, res) => {
    const db = getDb();
    const incident = db.incidents.find((i) => i.id === req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Insiden tidak ditemukan.' });
      return;
    }

    const { action, notes, actor, timestamp } = (req.body || {}) as Partial<TimelineEntry>;
    const cleanAction = (action || '').trim();
    const cleanNotes = (notes || '').trim();
    if (!cleanAction || !cleanNotes) {
      res.status(400).json({ error: 'Aksi dan catatan kronologi wajib diisi.' });
      return;
    }

    const entry: TimelineEntry = {
      id: makeId('tl'),
      timestamp: timestamp || new Date().toISOString(),
      actor: (actor || '').trim() || 'Analis SOC',
      action: cleanAction,
      notes: cleanNotes,
    };

    incident.timeline.push(entry);
    incident.updatedAt = new Date().toISOString();
    saveDb(db);
    void syncRecordToSupabase('incidents', incident as unknown as Record<string, unknown>);

    res.status(201).json({ incident, entry });
  });

  app.post('/api/incidents/:id/summary', async (req, res) => {
    try {
      const db = getDb();
      const incident = db.incidents.find((i) => i.id === req.params.id);
      if (!incident) {
        res.status(404).json({ error: 'Insiden tidak ditemukan.' });
        return;
      }

      const { summary, usedFallback } = await generateIncidentSummaryWithAI(incident);
      incident.aiSummary = summary;
      incident.aiSummaryGeneratedAt = new Date().toISOString();
      incident.updatedAt = incident.aiSummaryGeneratedAt;
      saveDb(db);
      void syncRecordToSupabase('incidents', incident as unknown as Record<string, unknown>);

      const actorName =
        ((req.body || {}) as { actorName?: string }).actorName?.trim() || 'Analis Siber Sosial';
      appendLogAndSave({
        id: makeId('log'),
        timestamp: incident.updatedAt,
        category: 'Investigasi Kasus',
        severity: 'Rendah',
        actor: actorName,
        ipAddress: getClientIp(req),
        event: `Menyusun ringkasan investigasi AI untuk kasus ${incident.code}`,
        status: 'Berhasil',
        pillar: incident.pillar,
        sourceType: 'APP LOG',
      });

      res.json({ incident, usedFallback });
    } catch (error) {
      console.error('Error in /api/incidents/:id/summary:', error);
      res.status(500).json({ error: 'Gagal menyusun ringkasan investigasi AI.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SATRIA CYBER AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

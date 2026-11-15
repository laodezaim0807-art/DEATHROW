export type UserRole = 'admin' | 'analyst';

export type SatriaPillar =
  | 'Disinformasi & Hoaks'
  | 'Rekayasa Sosial & Impersonasi'
  | 'Analisis Narasi & Sentimen'
  | 'Operasi Kognitif & Bot';

export type RiskCategory = 'Rendah' | 'Sedang' | 'Tinggi';

export type SeverityLevel = 'Rendah' | 'Sedang' | 'Tinggi' | 'Kritis';

export type SentimentLabel = 'Positif' | 'Negatif' | 'Netral';

export type IncidentStatus =
  | 'Terbuka'
  | 'Sedang Diinvestigasi'
  | 'Terkendali'
  | 'Selesai';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organization: string;
  authMode: 'supabase' | 'demo';
}

export interface PhishingIndicator {
  code: string;
  label: string;
  severity: RiskCategory;
  source: 'Aturan Heuristik' | 'Analisis AI Gemini';
  detail: string;
}

export interface PhishingAnalysis {
  id: string;
  createdAt: string;
  analystName: string;
  inputType: 'url' | 'message' | 'combined';
  urlInput: string;
  messageInput: string;
  riskScore: number;
  riskCategory: RiskCategory;
  ruleScore: number;
  aiScore: number;
  indicators: PhishingIndicator[];
  explanation: string;
  safetyCaveat: string;
  recommendations: string[];
  pillar: SatriaPillar;
  isDemo: boolean;
}

export interface SocialIntelAnalysis {
  id: string;
  createdAt: string;
  analystName: string;
  sourcePlatform: string;
  sourceUrl?: string;
  inputText: string;
  sentiment: SentimentLabel;
  sentimentScores: {
    positif: number;
    negatif: number;
    netral: number;
  };
  classification: string;
  verificationIndicators: string[];
  narrativeAnalysis: string;
  factCheckRecommendations: string[];
  confidenceLevel: number;
  analysisLimitations: string;
  pillar: SatriaPillar;
  isDemo: boolean;
}

export type LogCategory =
  | 'Siber Sosial'
  | 'Rekayasa Sosial'
  | 'Disinformasi'
  | 'Investigasi Kasus'
  | 'Autentikasi'
  | 'Sistem';

export interface SecurityLog {
  id: string;
  timestamp: string;
  category: LogCategory;
  severity: SeverityLevel;
  actor: string;
  ipAddress: string;
  event: string;
  status: 'Berhasil' | 'Gagal' | 'Diblokir' | 'Peringatan';
  pillar: SatriaPillar;
  sourceType: 'DEMO' | 'APP LOG';
}

export interface DigitalEvidence {
  id: string;
  label: string;
  evidenceType:
    | 'Tangkapan Unggahan'
    | 'Tautan / Akun Sosial'
    | 'Rekaman Pesan / DM'
    | 'Log Aktivitas Sosial'
    | 'Arsip Media / Metadata';
  value: string;
  collectedBy: string;
  collectedAt: string;
}

export interface TimelineEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  notes: string;
}

export interface IncidentRecord {
  id: string;
  code: string;
  title: string;
  description: string;
  pillar: SatriaPillar;
  severity: SeverityLevel;
  status: IncidentStatus;
  affectedAsset: string;
  reporter: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  evidence: DigitalEvidence[];
  timeline: TimelineEntry[];
  aiSummary: string;
  aiSummaryGeneratedAt?: string;
  isDemo: boolean;
}

export interface SecurityNotification {
  id: string;
  title: string;
  message: string;
  severity: SeverityLevel;
  category: LogCategory;
  createdAt: string;
  read: boolean;
  isDemo: boolean;
}

export interface SatriaDashboardData {
  mode: 'supabase' | 'demo';
  geminiConfigured: boolean;
  phishingAnalyses: PhishingAnalysis[];
  socialAnalyses: SocialIntelAnalysis[];
  securityLogs: SecurityLog[];
  incidents: IncidentRecord[];
  notifications: SecurityNotification[];
}

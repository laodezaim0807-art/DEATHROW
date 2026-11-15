import { GoogleGenAI, Type } from '@google/genai';
import type {
  IncidentRecord,
  PhishingIndicator,
  RiskCategory,
  SatriaPillar,
  SentimentLabel,
} from '../src/types/satria.ts';

const MODEL_NAME = 'gemini-4-hydrogen';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyRisk(score: number): RiskCategory {
  if (score >= 70) return 'Tinggi';
  if (score >= 35) return 'Sedang';
  return 'Rendah';
}

function parseJsonResponse<T>(rawText: string | undefined): T {
  const trimmed = (rawText ?? '{}').trim();
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned || '{}') as T;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function evaluatePhishingRules(urlInput: string, messageInput: string): {
  ruleScore: number;
  indicators: PhishingIndicator[];
} {
  const indicators: PhishingIndicator[] = [];
  let score = 0;

  const trimmedUrl = urlInput.trim();
  const combinedText = `${trimmedUrl} ${messageInput}`.toLowerCase();

  if (trimmedUrl) {
    if (trimmedUrl.toLowerCase().startsWith('http://')) {
      score += 20;
      indicators.push({
        code: 'HTTP_NO_TLS',
        label: 'Tautan media sosial mengarah ke HTTP tanpa TLS',
        severity: 'Tinggi',
        source: 'Aturan Heuristik',
        detail: 'Tautan dari bio/pesan menggunakan http:// tanpa enkripsi yang tidak lazim untuk kanal resmi.',
      });
    }

    if (/https?:\/\/\d{1,3}(\.\d{1,3}){3}/i.test(trimmedUrl)) {
      score += 35;
      indicators.push({
        code: 'IP_LITERAL_HOST',
        label: 'Alamat IP langsung pada tautan pesan sosial',
        severity: 'Tinggi',
        source: 'Aturan Heuristik',
        detail: 'Akun resmi media sosial organisasi tidak mengarahkan pengikut ke alamat IP mentah.',
      });
    }

    if (/\.(xyz|top|click|tk|ml|gq|cfd|icu|vip|buzz|work)(\/|$|\?)/i.test(trimmedUrl)) {
      score += 26;
      indicators.push({
        code: 'HIGH_RISK_TLD',
        label: 'Ekstensi domain (TLD) rawan penipuan sosial',
        severity: 'Tinggi',
        source: 'Aturan Heuristik',
        detail: 'TLD seperti .xyz, .top, .click, atau .icu kerap dipakai akun tiruan di TikTok, Telegram, dan WhatsApp.',
      });
    }

    if (/(bit\.ly|tinyurl\.com|s\.id|cutt\.ly|rb\.gy|shorturl\.at|linktr\.ee)/i.test(trimmedUrl)) {
      score += 18;
      indicators.push({
        code: 'URL_SHORTENER',
        label: 'Pemendek tautan / tautan perantara di bio atau pesan',
        severity: 'Sedang',
        source: 'Aturan Heuristik',
        detail: 'Tautan perantara menyamarkan tujuan akhir sehingga perlu verifikasi domain sebelum diklik.',
      });
    }

    if (trimmedUrl.includes('@') || /xn--/i.test(trimmedUrl)) {
      score += 30;
      indicators.push({
        code: 'OBFUSCATED_URI',
        label: 'Pola penyamaran nama akun/domain (@ atau Punycode)',
        severity: 'Tinggi',
        source: 'Aturan Heuristik',
        detail: 'Karakter @ atau xn-- sering dipakai untuk meniru nama akun lembaga resmi.',
      });
    }
  }

  const urgencyKeywords = [
    'segera',
    'dalam 2 jam',
    'dalam 24 jam',
    'batas waktu',
    'tengah malam',
    'hangus',
    'dibekukan',
    'diblokir',
    'sebarkan',
    'viral',
    'slot terbatas',
    'kuota terakhir',
    'urgent',
  ];
  const matchedUrgency = urgencyKeywords.filter((kw) => combinedText.includes(kw));
  if (matchedUrgency.length > 0) {
    score += Math.min(28, matchedUrgency.length * 10);
    indicators.push({
      code: 'SOCIAL_URGENCY_TRIGGER',
      label: 'Tekanan psikologis & pemicu kepanikan sosial',
      severity: matchedUrgency.length >= 2 ? 'Tinggi' : 'Sedang',
      source: 'Aturan Heuristik',
      detail: `Terdeteksi pola desakan emosional/urgensi: ${matchedUrgency.slice(0, 4).join(', ')}.`,
    });
  }

  const socialLureKeywords = [
    'otp',
    'pin',
    'kata sandi',
    'password',
    'dm admin',
    'link di bio',
    'giveaway',
    'hadiah',
    'dana kaget',
    'beasiswa',
    'qris',
    'ktm',
    'ktp',
    'verifikasi centang',
    '.apk',
    'grup telegram',
  ];
  const wordBoundaryKeywords = new Set(['otp', 'pin', 'ktp', 'ktm', 'qris']);
  const matchedLure = socialLureKeywords.filter((kw) => {
    if (wordBoundaryKeywords.has(kw)) {
      return new RegExp(`\\b${kw}\\b`, 'i').test(combinedText);
    }
    return combinedText.includes(kw);
  });
  if (matchedLure.length > 0) {
    score += Math.min(32, matchedLure.length * 10);
    indicators.push({
      code: 'SOCIAL_IMPERSONATION_LURE',
      label: 'Umpan rekayasa sosial, impersonasi, atau pencurian data identitas',
      severity: matchedLure.some((k) => ['otp', 'pin', '.apk', 'ktp', 'kata sandi'].includes(k))
        ? 'Tinggi'
        : 'Sedang',
      source: 'Aturan Heuristik',
      detail: `Ditemukan pola umpan media sosial: ${matchedLure.slice(0, 4).join(', ')}.`,
    });
  }

  const boundedScore = Math.min(100, score);
  return { ruleScore: boundedScore, indicators };
}

export async function analyzePhishingWithAI(params: {
  urlInput: string;
  messageInput: string;
}): Promise<{
  riskScore: number;
  riskCategory: RiskCategory;
  ruleScore: number;
  aiScore: number;
  indicators: PhishingIndicator[];
  explanation: string;
  safetyCaveat: string;
  recommendations: string[];
  pillar: SatriaPillar;
  usedFallback: boolean;
}> {
  const { urlInput, messageInput } = params;
  const { ruleScore, indicators: ruleIndicators } = evaluatePhishingRules(urlInput, messageInput);

  const mandatorySafetyCaveat =
    'Catatan Verifikasi Siber Sosial: Ketiadaan indikator mencurigakan pada satu pesan atau tautan profil tidak menjamin keaslian akun. Selalu verifikasi lencana/kanal resmi organisasi sebelum berinteraksi atau membagikan data.';

  const ai = createGeminiClient();
  if (!ai) {
    const fallbackRiskScore = ruleIndicators.length > 0 ? Math.max(ruleScore, 20) : 15;
    return {
      riskScore: fallbackRiskScore,
      riskCategory: classifyRisk(fallbackRiskScore),
      ruleScore,
      aiScore: fallbackRiskScore,
      indicators:
        ruleIndicators.length > 0
          ? ruleIndicators
          : [
              {
                code: 'HEURISTIC_NO_MATCH',
                label: 'Tidak ada pola rekayasa sosial eksplisit yang terpicu',
                severity: 'Rendah',
                source: 'Aturan Heuristik',
                detail:
                  'Pemeriksaan aturan dasar tidak mendeteksi pola penipuan media sosial umum, namun verifikasi keaslian akun tetap diperlukan.',
              },
            ],
      explanation:
        ruleIndicators.length > 0
          ? 'Penilaian dilakukan menggunakan mesin aturan Siber Sosial karena kunci API Gemini server belum aktif. Ditemukan pola desakan psikologis atau umpan identitas khas rekayasa sosial.'
          : 'Mesin aturan lokal tidak menemukan pola rekayasa sosial eksplisit pada masukan. Tetap periksa riwayat akun pengirim dan kanal resmi organisasi.',
      safetyCaveat: mandatorySafetyCaveat,
      recommendations: [
        'Pastikan nama pengguna (handle) dan tautan bio cocok dengan kanal media sosial resmi institusi.',
        'Jangan pernah mengirimkan foto identitas (KTP/KTM), kode OTP, atau mengunduh berkas dari DM/komentar mencurigakan.',
        'Laporkan akun tiruan ke fitur pelaporan platform (Report Impersonation) dan tim Siber Sosial.',
      ],
      pillar: 'Rekayasa Sosial & Impersonasi',
      usedFallback: true,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analisis potensi rekayasa sosial, impersonasi akun, atau penipuan berbasis media sosial pada masukan berikut.
Tautan Bio / Profil / Pesan (URL): ${urlInput || '(tidak disertakan)'}
Teks DM / Komentar / Broadcast Sosial: ${messageInput || '(tidak disertakan)'}
Skor aturan heuristik awal: ${ruleScore}/100.
Indikator aturan awal: ${JSON.stringify(ruleIndicators)}`,
      config: {
        systemInstruction: `Anda adalah Analis Siber Sosial senior pada platform SATRIA SIBER SOSIAL.
Tugas Anda adalah menganalisis teks pesan langsung (DM), komentar publik, unggahan grup, dan tautan bio media sosial untuk mendeteksi rekayasa sosial (social engineering), impersonasi akun tokoh/kampus/UMKM, penipuan giveaway/beasiswa palsu, dan manipulasi psikologis audiens.
ATURAN WAJIB:
1. Jangan pernah menyatakan sebuah akun, pesan, atau tautan "pasti aman" atau "dijamin asli" hanya karena tidak ditemukan indikator mencurigakan.
2. Gunakan Bahasa Indonesia yang formal, objektif, dan berfokus pada domain Siber Sosial.
3. Berikan rekomendasi mitigasi langkah demi langkah bagi komunitas kampus, pelaku UMKM, maupun pengelola akun resmi.
4. Pilih satu sub-domain Siber Sosial paling relevan: "Disinformasi & Hoaks", "Rekayasa Sosial & Impersonasi", "Analisis Narasi & Sentimen", atau "Operasi Kognitif & Bot".`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiScore: {
              type: Type.INTEGER,
              description: 'Skor risiko rekayasa sosial berbasis analisis bahasa dan konteks AI dari 0 sampai 100.',
            },
            aiIndicators: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  code: { type: Type.STRING },
                  label: { type: Type.STRING },
                  severity: { type: Type.STRING, description: 'Rendah, Sedang, atau Tinggi' },
                  detail: { type: Type.STRING },
                },
                required: ['code', 'label', 'severity', 'detail'],
              },
            },
            explanation: {
              type: Type.STRING,
              description: 'Penjelasan komprehensif pola rekayasa sosial, teknik persuasi, dan potensi risiko terhadap komunitas.',
            },
            safetyCaveat: {
              type: Type.STRING,
              description: 'Peringatan bahwa ketiadaan indikator mencurigakan tidak menjamin keaslian akun/tautan.',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Daftar langkah mitigasi Siber Sosial berurutan.',
            },
            pillar: {
              type: Type.STRING,
              description: 'Salah satu dari 4 sub-domain Siber Sosial.',
            },
          },
          required: [
            'aiScore',
            'aiIndicators',
            'explanation',
            'safetyCaveat',
            'recommendations',
            'pillar',
          ],
        },
      },
    });

    const parsed = parseJsonResponse<{
      aiScore?: number;
      aiIndicators?: Array<{
        code: string;
        label: string;
        severity: string;
        detail: string;
      }>;
      explanation?: string;
      safetyCaveat?: string;
      recommendations?: string[];
      pillar?: string;
    }>(response.text);

    const aiScore = clampInt(parsed.aiScore, 0, 100, ruleScore);
    let combinedScore = Math.round(ruleScore * 0.45 + aiScore * 0.55);
    if (ruleScore >= 70 && combinedScore < 68) {
      combinedScore = Math.round((ruleScore + aiScore) / 2);
    }
    combinedScore = Math.max(0, Math.min(100, combinedScore));

    const aiFormattedIndicators: PhishingIndicator[] = (parsed.aiIndicators ?? []).map((item) => ({
      code: item.code || 'AI_SOCIAL_SIGNAL',
      label: item.label || 'Indikator Konteks Siber Sosial',
      severity:
        item.severity === 'Tinggi' || item.severity === 'Sedang' || item.severity === 'Rendah'
          ? item.severity
          : classifyRisk(aiScore),
      source: 'Analisis AI Gemini',
      detail: item.detail || '',
    }));

    const validPillars: SatriaPillar[] = [
      'Disinformasi & Hoaks',
      'Rekayasa Sosial & Impersonasi',
      'Analisis Narasi & Sentimen',
      'Operasi Kognitif & Bot',
    ];
    const pillar = validPillars.includes(parsed.pillar as SatriaPillar)
      ? (parsed.pillar as SatriaPillar)
      : 'Rekayasa Sosial & Impersonasi';

    return {
      riskScore: combinedScore,
      riskCategory: classifyRisk(combinedScore),
      ruleScore,
      aiScore,
      indicators: [...ruleIndicators, ...aiFormattedIndicators],
      explanation:
        parsed.explanation ||
        'Analisis gabungan heuristik dan AI selesai dilakukan terhadap pesan dan tautan media sosial yang diberikan.',
      safetyCaveat: parsed.safetyCaveat
        ? `${parsed.safetyCaveat} (${mandatorySafetyCaveat})`
        : mandatorySafetyCaveat,
      recommendations:
        parsed.recommendations && parsed.recommendations.length > 0
          ? parsed.recommendations
          : [
              'Verifikasi akun pengirim melalui direktori kanal media sosial resmi organisasi.',
              'Aktifkan verifikasi dua langkah pada seluruh akun media sosial resmi pengelola.',
            ],
      pillar,
      usedFallback: false,
    };
  } catch (error) {
    console.error('Gemini social engineering analysis error:', error);
    const fallbackScore = ruleScore > 0 ? ruleScore : 20;
    return {
      riskScore: fallbackScore,
      riskCategory: classifyRisk(fallbackScore),
      ruleScore,
      aiScore: fallbackScore,
      indicators: ruleIndicators,
      explanation:
        'Analisis AI mengalami gangguan sementara sehingga hasil mengandalkan penilaian aturan heuristik Siber Sosial lokal.',
      safetyCaveat: mandatorySafetyCaveat,
      recommendations: [
        'Verifikasi keaslian akun dan domain melalui kanal resmi organisasi sebelum berinteraksi.',
        'Coba ulangi analisis AI beberapa saat lagi untuk evaluasi konteks narasi mendalam.',
      ],
      pillar: 'Rekayasa Sosial & Impersonasi',
      usedFallback: true,
    };
  }
}

export async function analyzeSocialIntelWithAI(params: {
  inputText: string;
  sourcePlatform: string;
}): Promise<{
  sentiment: SentimentLabel;
  sentimentScores: { positif: number; negatif: number; netral: number };
  classification: string;
  verificationIndicators: string[];
  narrativeAnalysis: string;
  factCheckRecommendations: string[];
  confidenceLevel: number;
  analysisLimitations: string;
  pillar: SatriaPillar;
  usedFallback: boolean;
}> {
  const { inputText, sourcePlatform } = params;
  const mandatoryLimitation =
    'Keterbatasan Analisis: Evaluasi ini hanya menganalisis satu teks masukan tanpa memverifikasi basis data eksternal secara real-time. Sistem tidak menyatakan berita pasti hoaks atau pasti benar hanya berdasarkan satu teks.';

  const ai = createGeminiClient();
  if (!ai) {
    const lower = inputText.toLowerCase();
    const hasPanic = /sebarkan|dibekukan|darurat|viral|waspada!!|sebelum tengah malam|boikot|potongan otomatis/.test(
      lower,
    );
    const hasBotPattern = /akun buzzer|spam|kopas|serentak|tagar/.test(lower);
    const sentiment: SentimentLabel = hasPanic ? 'Negatif' : 'Netral';
    const pillar: SatriaPillar = hasBotPattern
      ? 'Operasi Kognitif & Bot'
      : hasPanic
        ? 'Disinformasi & Hoaks'
        : 'Analisis Narasi & Sentimen';

    return {
      sentiment,
      sentimentScores: hasPanic
        ? { positif: 5, negatif: 75, netral: 20 }
        : { positif: 25, negatif: 15, netral: 60 },
      classification: hasPanic
        ? 'Klaim Sensasional / Perlu Verifikasi Fakta'
        : 'Opini Publik / Perlu Konteks Tambahan',
      verificationIndicators: [
        'Perlu konfirmasi sumber primer atau siaran pers lembaga resmi terkait.',
        'Periksa tanggal terbit, identitas pengunggah asli, dan konteks visual/tautan pendukung.',
      ],
      narrativeAnalysis:
        'Analisis lokal mendeteksi struktur pembingkaian kalimat dan nada emosional pesan. Kunci API Gemini belum tersedia di lingkungan server untuk pemrosesan semantik lanjutan.',
      factCheckRecommendations: [
        'Bandingkan isi klaim dengan kanal resmi instansi, kampus, atau media arus utama terverifikasi.',
        'Gunakan basis data pemeriksa fakta (seperti CekFakta / TurnBackHoax) untuk memeriksa riwayat klaim serupa.',
      ],
      confidenceLevel: 54,
      analysisLimitations: mandatoryLimitation,
      pillar,
      usedFallback: true,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analisis teks berita atau unggahan media sosial berikut untuk modul Intelijen Siber Sosial SATRIA.
Platform / Sumber: ${sourcePlatform || 'Tidak disebutkan'}
Teks Masukan:
"""
${inputText}
"""`,
      config: {
        systemInstruction: `Anda adalah Analis Siber Sosial (Cognitive Domain & Disinformation Analyst) pada platform SATRIA SIBER SOSIAL.
ATURAN WAJIB:
1. JANGAN PERNAH menyatakan suatu berita/teks "pasti hoaks" atau "100% palsu/benar" hanya berdasarkan satu teks. Selalu gunakan bahasa probabilistik dan berfokus pada indikator yang perlu diverifikasi.
2. Tampilkan analisis sentimen (Positif, Negatif, atau Netral) beserta estimasi persentase (positif + negatif + netral = 100).
3. Berikan klasifikasi narasi yang objektif, indikator informasi yang perlu diverifikasi, analisis pembingkaian/dampak kognitif, rekomendasi pemeriksaan fakta, tingkat keyakinan (0-100), keterbatasan analisis yang eksplisit, dan pilih satu sub-domain Siber Sosial ("Disinformasi & Hoaks", "Rekayasa Sosial & Impersonasi", "Analisis Narasi & Sentimen", atau "Operasi Kognitif & Bot").
4. Gunakan Bahasa Indonesia yang objektif, netral, dan analitis.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sentiment: { type: Type.STRING, description: 'Positif, Negatif, atau Netral' },
            sentimentScores: {
              type: Type.OBJECT,
              properties: {
                positif: { type: Type.INTEGER },
                negatif: { type: Type.INTEGER },
                netral: { type: Type.INTEGER },
              },
              required: ['positif', 'negatif', 'netral'],
            },
            classification: { type: Type.STRING },
            verificationIndicators: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            narrativeAnalysis: { type: Type.STRING },
            factCheckRecommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            confidenceLevel: {
              type: Type.INTEGER,
              description: 'Tingkat keyakinan analisis 0-100.',
            },
            analysisLimitations: {
              type: Type.STRING,
              description: 'Penjelasan keterbatasan analisis teks tunggal.',
            },
            pillar: {
              type: Type.STRING,
              description: 'Salah satu dari 4 sub-domain Siber Sosial.',
            },
          },
          required: [
            'sentiment',
            'sentimentScores',
            'classification',
            'verificationIndicators',
            'narrativeAnalysis',
            'factCheckRecommendations',
            'confidenceLevel',
            'analysisLimitations',
            'pillar',
          ],
        },
      },
    });

    const parsed = parseJsonResponse<{
      sentiment?: string;
      sentimentScores?: { positif: number; negatif: number; netral: number };
      classification?: string;
      verificationIndicators?: string[];
      narrativeAnalysis?: string;
      factCheckRecommendations?: string[];
      confidenceLevel?: number;
      analysisLimitations?: string;
      pillar?: string;
    }>(response.text);

    const sentiment: SentimentLabel =
      parsed.sentiment === 'Positif' || parsed.sentiment === 'Negatif' || parsed.sentiment === 'Netral'
        ? parsed.sentiment
        : 'Netral';

    const rawPos = Math.max(0, Number(parsed.sentimentScores?.positif) || 0);
    const rawNeg = Math.max(0, Number(parsed.sentimentScores?.negatif) || 0);
    const rawNet = Math.max(0, Number(parsed.sentimentScores?.netral) || 0);
    const sumRaw = rawPos + rawNeg + rawNet;
    const positif = sumRaw > 0 ? Math.min(100, Math.round((rawPos / sumRaw) * 100)) : 20;
    const negatif = sumRaw > 0 ? Math.min(100 - positif, Math.round((rawNeg / sumRaw) * 100)) : 30;
    const netral = Math.max(0, 100 - positif - negatif);

    const validPillars: SatriaPillar[] = [
      'Disinformasi & Hoaks',
      'Rekayasa Sosial & Impersonasi',
      'Analisis Narasi & Sentimen',
      'Operasi Kognitif & Bot',
    ];
    const pillar = validPillars.includes(parsed.pillar as SatriaPillar)
      ? (parsed.pillar as SatriaPillar)
      : 'Analisis Narasi & Sentimen';

    return {
      sentiment,
      sentimentScores: { positif, negatif, netral },
      classification: parsed.classification || 'Konten Informasi / Opini Publik',
      verificationIndicators:
        parsed.verificationIndicators && parsed.verificationIndicators.length > 0
          ? parsed.verificationIndicators
          : ['Sumber primer dan bukti pendukung eksternal perlu dikonfirmasi lebih lanjut.'],
      narrativeAnalysis:
        parsed.narrativeAnalysis ||
        'Narasi dianalisis berdasarkan pembingkaian bahasa dan potensi dampak kognitif terhadap audiens.',
      factCheckRecommendations:
        parsed.factCheckRecommendations && parsed.factCheckRecommendations.length > 0
          ? parsed.factCheckRecommendations
          : ['Verifikasi klaim melalui kanal resmi otoritas terkait dan pemeriksa fakta independen.'],
      confidenceLevel: clampInt(parsed.confidenceLevel, 10, 95, 75),
      analysisLimitations: parsed.analysisLimitations
        ? `${parsed.analysisLimitations} ${mandatoryLimitation}`
        : mandatoryLimitation,
      pillar,
      usedFallback: false,
    };
  } catch (error) {
    console.error('Gemini social analysis error:', error);
    return {
      sentiment: 'Netral',
      sentimentScores: { positif: 20, negatif: 30, netral: 50 },
      classification: 'Memerlukan Peninjauan Manual',
      verificationIndicators: [
        'Gagal terhubung ke layanan Gemini AI; lakukan verifikasi manual terhadap klaim dan sumber.',
      ],
      narrativeAnalysis: 'Analisis AI mengalami gangguan sementara.',
      factCheckRecommendations: [
        'Konfirmasi informasi melalui sumber primer resmi sebelum menarik kesimpulan.',
      ],
      confidenceLevel: 40,
      analysisLimitations: mandatoryLimitation,
      pillar: 'Analisis Narasi & Sentimen',
      usedFallback: true,
    };
  }
}

export async function generateIncidentSummaryWithAI(incident: IncidentRecord): Promise<{
  summary: string;
  usedFallback: boolean;
}> {
  const ai = createGeminiClient();
  if (!ai) {
    return {
      summary: `Ringkasan Kasus Siber Sosial ${incident.code} (${incident.title}):
Status penanganan: ${incident.status} dengan tingkat dampak ${incident.severity} pada kanal/komunitas "${incident.affectedAsset}".
Tercatat ${incident.evidence.length} artefak bukti sosial dan ${incident.timeline.length} entri kronologi eskalasi.
Langkah lanjutan yang disarankan: Lanjutkan klarifikasi resmi pada kanal publik, laporkan akun/konten pelanggar ke platform terkait, dan dokumentasikan penutupan kasus setelah narasi terkendali.`,
      usedFallback: true,
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Buat ringkasan investigasi kasus Siber Sosial yang ringkas, terstruktur, dan siap disertakan dalam laporan manajemen/komunikasi publik berdasarkan data berikut:
Kode Kasus: ${incident.code}
Judul: ${incident.title}
Sub-Domain Siber Sosial: ${incident.pillar}
Keparahan: ${incident.severity}
Status: ${incident.status}
Kanal / Komunitas Terdampak: ${incident.affectedAsset}
Deskripsi: ${incident.description}
Bukti Digital Sosial (${incident.evidence.length}): ${JSON.stringify(incident.evidence)}
Kronologi Kejadian (${incident.timeline.length}): ${JSON.stringify(incident.timeline)}`,
      config: {
        systemInstruction:
          'Anda adalah Kepala Unit Analisis Siber Sosial pada platform SATRIA SIBER SOSIAL. Susun ringkasan investigasi dalam Bahasa Indonesia yang faktual, tidak mengada-ada di luar data kasus yang diberikan, dan terbagi jelas menjadi: (1) Ringkasan Eksekutif, (2) Temuan Narasi & Bukti Sosial Kunci, dan (3) Rekomendasi Komunikasi & Mitigasi.',
      },
    });

    return {
      summary:
        response.text?.trim() ||
        `Ringkasan untuk kasus ${incident.code} berhasil dibuat, namun keluaran teks kosong.`,
      usedFallback: false,
    };
  } catch (error) {
    console.error('Gemini incident summary error:', error);
    return {
      summary: `Ringkasan sementara ${incident.code}: ${incident.title}. Status ${incident.status} (${incident.severity}). Tercatat ${incident.evidence.length} bukti sosial dan ${incident.timeline.length} entri kronologi. Layanan Gemini AI sedang tidak dapat dijangkau untuk penyusunan narasi otomatis.`,
      usedFallback: true,
    };
  }
}

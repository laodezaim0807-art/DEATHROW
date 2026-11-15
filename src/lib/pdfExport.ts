import { jsPDF } from 'jspdf';
import type {
  AuthUser,
  IncidentRecord,
  PhishingAnalysis,
  SecurityLog,
  SocialIntelAnalysis,
} from '../types/satria';
import { formatDateTime } from './format';

export type ReportCategoryType =
  | 'phishing'
  | 'social'
  | 'monitoring'
  | 'incidents'
  | 'executive';

function safeText(input: unknown, fallback = '-'): string {
  if (input === null || input === undefined) return fallback;
  const raw = String(input)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[—–]/g, '-')
    .replace(/[•·]/g, '-')
    .replace(/…/g, '...')
    .replace(/[→➜➔]/g, '->')
    .replace(/[^\u0020-\u00FF\n\r\t]/g, '')
    .replace(/ +/g, ' ')
    .trim();
  return raw.length > 0 ? raw : fallback;
}

function addHeader(doc: jsPDF, title: string, subtitle: string, analyst: string): number {
  doc.setFillColor(10, 18, 36);
  doc.rect(0, 0, 210, 34, 'F');

  doc.setFillColor(220, 38, 38);
  doc.rect(0, 34, 210, 1.5, 'F');

  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SATRIA SIBER SOSIAL', 14, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Pusat Intelijen, Analisis Narasi, dan Respons Ancaman Siber Sosial Berbasis AI',
    14,
    19,
  );

  doc.setTextColor(248, 250, 252);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(safeText(title), 14, 28);

  const generatedAt = formatDateTime(new Date().toISOString());
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Waktu Pembuatan: ${safeText(generatedAt)}`, 196, 13, { align: 'right' });
  doc.text(`Penyusun: ${safeText(analyst)}`, 196, 19, { align: 'right' });
  doc.text(safeText(subtitle), 196, 28, { align: 'right' });

  doc.setTextColor(15, 23, 42);
  return 44;
}

function ensureSpace(doc: jsPDF, y: number, needed = 24): number {
  if (y + needed > 280) {
    doc.addPage();
    return 18;
  }
  return y;
}

function writeWrapped(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 5,
): number {
  const cleaned = safeText(text, '');
  if (!cleaned) return y;
  const lines = doc.splitTextToSize(cleaned, maxWidth) as string[];
  for (const line of lines) {
    y = ensureSpace(doc, y, lineHeight + 4);
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

export function exportIncidentPdf(
  incident: IncidentRecord,
  user: AuthUser,
): { ok: boolean; error?: string } {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const modeLabel = incident.isDemo ? 'DATA DEMO' : 'DATA OPERASIONAL';
    let y = addHeader(
      doc,
      `Laporan Kasus Siber Sosial: ${safeText(incident.code)}`,
      modeLabel,
      `${safeText(user.name)} (${user.role.toUpperCase()})`,
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    y = writeWrapped(doc, incident.title, 14, y, 182, 6);
    y += 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const metaRows = [
      `Sub-Domain Siber Sosial: ${safeText(incident.pillar)}`,
      `Keparahan: ${safeText(incident.severity)}  |  Status: ${safeText(incident.status)}`,
      `Kanal / Komunitas Terdampak: ${safeText(incident.affectedAsset)}`,
      `Pelapor: ${safeText(incident.reporter)}  |  Penanggung Jawab: ${safeText(incident.assignedTo)}`,
      `Dibuat: ${formatDateTime(incident.createdAt)}  |  Diperbarui: ${formatDateTime(incident.updatedAt)}`,
    ];
    for (const row of metaRows) {
      y = writeWrapped(doc, row, 14, y, 182, 5);
    }

    y += 4;
    y = ensureSpace(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('1. Deskripsi Kasus Siber Sosial', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    y = writeWrapped(doc, incident.description, 14, y, 182, 5);

    y += 4;
    y = ensureSpace(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`2. Bukti Digital Sosial (${incident.evidence.length} Artefak)`, 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (incident.evidence.length === 0) {
      y = writeWrapped(doc, 'Belum ada bukti digital sosial yang dilampirkan.', 14, y, 182, 5);
    } else {
      for (const ev of incident.evidence) {
        y = ensureSpace(doc, y, 16);
        y = writeWrapped(
          doc,
          `- [${safeText(ev.evidenceType)}] ${safeText(ev.label)} - ${safeText(ev.value)} (Oleh ${safeText(ev.collectedBy)}, ${formatDateTime(ev.collectedAt)})`,
          14,
          y,
          182,
          4.8,
        );
        y += 1.5;
      }
    }

    y += 4;
    y = ensureSpace(doc, y, 20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text(`3. Kronologi Kejadian (${incident.timeline.length} Entri)`, 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    if (incident.timeline.length === 0) {
      y = writeWrapped(doc, 'Belum ada entri kronologi.', 14, y, 182, 5);
    } else {
      for (const tl of incident.timeline) {
        y = ensureSpace(doc, y, 16);
        y = writeWrapped(
          doc,
          `- ${formatDateTime(tl.timestamp)} | ${safeText(tl.action)} (${safeText(tl.actor)}): ${safeText(tl.notes)}`,
          14,
          y,
          182,
          4.8,
        );
        y += 1.5;
      }
    }

    y += 4;
    y = ensureSpace(doc, y, 24);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('4. Ringkasan Investigasi AI', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    y = writeWrapped(
      doc,
      incident.aiSummary || 'Ringkasan AI belum dibuat untuk kasus ini.',
      14,
      y,
      182,
      5,
    );

    const safeCode = safeText(incident.code, 'KASUS').replace(/[^a-zA-Z0-9_-]/g, '-');
    doc.save(`SATRIA-SiberSosial-${safeCode}.pdf`);
    return { ok: true };
  } catch (err) {
    console.error('Export incident PDF failed:', err);
    return {
      ok: false,
      error: 'Gagal menyusun dokumen PDF kasus. Periksa kembali isi teks artefak.',
    };
  }
}

export function exportReportPdf(params: {
  reportType: ReportCategoryType;
  startDate: string;
  endDate: string;
  user: AuthUser;
  mode: 'supabase' | 'demo';
  phishingAnalyses: PhishingAnalysis[];
  socialAnalyses: SocialIntelAnalysis[];
  securityLogs: SecurityLog[];
  incidents: IncidentRecord[];
}): { ok: boolean; error?: string } {
  try {
    const {
      reportType,
      startDate,
      endDate,
      user,
      mode,
      phishingAnalyses,
      socialAnalyses,
      securityLogs,
      incidents,
    } = params;

    const titles: Record<ReportCategoryType, string> = {
      social: 'Laporan Intelijen Narasi & Verifikasi Media Sosial',
      phishing: 'Laporan Deteksi Rekayasa Sosial & Impersonasi',
      monitoring: 'Laporan Pemantauan Aktivitas Siber Sosial',
      incidents: 'Laporan Investigasi Kasus Siber Sosial',
      executive: 'Laporan Eksekutif Terpadu SATRIA SIBER SOSIAL',
    };

    const rangeText = `${startDate || 'Awal'} s/d ${endDate || 'Sekarang'} (${mode.toUpperCase()})`;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let y = addHeader(
      doc,
      titles[reportType],
      rangeText,
      `${safeText(user.name)} (${user.role.toUpperCase()})`,
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    y = writeWrapped(
      doc,
      `Organisasi: ${safeText(user.organization)} | Mode Penyimpanan: ${
        mode === 'demo' ? 'DEMO (Data Simulasi & Log Lokal)' : 'SUPABASE POSTGRESQL'
      }`,
      14,
      y,
      182,
      5,
    );
    y += 4;

    if (reportType === 'social' || reportType === 'executive') {
      y = ensureSpace(doc, y, 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Intelijen Narasi & Media Sosial (${socialAnalyses.length} Rekaman)`, 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      if (socialAnalyses.length === 0) {
        y = writeWrapped(doc, 'Tidak ada data analisis narasi sosial pada rentang tanggal terpilih.', 14, y, 182);
      } else {
        for (const item of socialAnalyses) {
          y = ensureSpace(doc, y, 24);
          doc.setFont('helvetica', 'bold');
          y = writeWrapped(
            doc,
            `[${safeText(item.sentiment)} - Keyakinan ${item.confidenceLevel}%] ${safeText(item.sourcePlatform)} - ${safeText(item.classification)} (${formatDateTime(item.createdAt)})${item.isDemo ? ' [DEMO]' : ''}`,
            14,
            y,
            182,
            4.8,
          );
          doc.setFont('helvetica', 'normal');
          if (item.sourceUrl) {
            y = writeWrapped(doc, `Tautan/Akun: ${safeText(item.sourceUrl)}`, 16, y, 180, 4.5);
          }
          y = writeWrapped(doc, `Analisis Narasi: ${safeText(item.narrativeAnalysis)}`, 16, y, 180, 4.5);
          y = writeWrapped(doc, `Keterbatasan: ${safeText(item.analysisLimitations)}`, 16, y, 180, 4.5);
          y += 2;
        }
      }
      y += 4;
    }

    if (reportType === 'phishing' || reportType === 'executive') {
      y = ensureSpace(doc, y, 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Deteksi Rekayasa Sosial & Impersonasi (${phishingAnalyses.length} Rekaman)`, 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      if (phishingAnalyses.length === 0) {
        y = writeWrapped(doc, 'Tidak ada data deteksi rekayasa sosial pada rentang tanggal terpilih.', 14, y, 182);
      } else {
        for (const item of phishingAnalyses) {
          y = ensureSpace(doc, y, 24);
          doc.setFont('helvetica', 'bold');
          y = writeWrapped(
            doc,
            `[${safeText(item.riskCategory).toUpperCase()} - Skor ${item.riskScore}/100] ${safeText(item.urlInput || 'Pesan Sosial')} (${formatDateTime(item.createdAt)})${item.isDemo ? ' [DEMO]' : ''}`,
            14,
            y,
            182,
            4.8,
          );
          doc.setFont('helvetica', 'normal');
          y = writeWrapped(doc, `Ringkasan: ${safeText(item.explanation)}`, 16, y, 180, 4.5);
          y = writeWrapped(doc, `Catatan: ${safeText(item.safetyCaveat)}`, 16, y, 180, 4.5);
          y += 2;
        }
      }
      y += 4;
    }

    if (reportType === 'monitoring' || reportType === 'executive') {
      y = ensureSpace(doc, y, 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Log Aktivitas Siber Sosial (${securityLogs.length} Entri)`, 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);

      if (securityLogs.length === 0) {
        y = writeWrapped(doc, 'Tidak ada log pemantauan pada rentang tanggal terpilih.', 14, y, 182);
      } else {
        for (const log of securityLogs.slice(0, 40)) {
          y = ensureSpace(doc, y, 12);
          y = writeWrapped(
            doc,
            `[${safeText(log.sourceType)}] ${formatDateTime(log.timestamp)} | ${safeText(log.category)} | ${safeText(log.severity)} | ${safeText(log.status)} | ${safeText(log.actor)} (${safeText(log.ipAddress)}) - ${safeText(log.event)}`,
            14,
            y,
            182,
            4.4,
          );
          y += 1;
        }
      }
      y += 4;
    }

    if (reportType === 'incidents' || reportType === 'executive') {
      y = ensureSpace(doc, y, 22);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Investigasi Kasus Siber Sosial (${incidents.length} Tiket)`, 14, y);
      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      if (incidents.length === 0) {
        y = writeWrapped(doc, 'Tidak ada kasus pada rentang tanggal terpilih.', 14, y, 182);
      } else {
        for (const inc of incidents) {
          y = ensureSpace(doc, y, 26);
          doc.setFont('helvetica', 'bold');
          y = writeWrapped(
            doc,
            `${safeText(inc.code)}: ${safeText(inc.title)} [${safeText(inc.severity)} - ${safeText(inc.status)}]${inc.isDemo ? ' [DEMO]' : ''}`,
            14,
            y,
            182,
            4.8,
          );
          doc.setFont('helvetica', 'normal');
          y = writeWrapped(
            doc,
            `Kanal Terdampak: ${safeText(inc.affectedAsset)} | Bukti Sosial: ${inc.evidence.length} | Kronologi: ${inc.timeline.length}`,
            16,
            y,
            180,
            4.5,
          );
          if (inc.aiSummary) {
            y = writeWrapped(doc, `Ringkasan: ${safeText(inc.aiSummary)}`, 16, y, 180, 4.5);
          }
          y += 2;
        }
      }
    }

    doc.save(`SATRIA-SiberSosial-${reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
    return { ok: true };
  } catch (err) {
    console.error('Export report PDF failed:', err);
    return {
      ok: false,
      error: 'Terjadi kendala saat membuat berkas PDF. Silakan coba rentang tanggal lain.',
    };
  }
}

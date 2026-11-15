import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Clock,
  Copy,
  Download,
  Edit3,
  FilePlus2,
  FolderSearch,
  HardDrive,
  Loader2,
  Lock,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { formatDateTime, getIncidentStatusClass, getRiskTextClass } from '../lib/format';
import { exportIncidentPdf } from '../lib/pdfExport';
import { SummarySkeleton } from './Skeletons';
import { useToast } from './ToastProvider';
import type {
  AuthUser,
  DigitalEvidence,
  IncidentRecord,
  IncidentStatus,
  SatriaPillar,
  SeverityLevel,
} from '../types/satria';

interface IncidentsViewProps {
  user: AuthUser;
  incidents: IncidentRecord[];
  onIncidentCreated: (incident: IncidentRecord) => void;
  onIncidentUpdated: (incident: IncidentRecord) => void;
  onIncidentDeleted: (id: string) => void;
}

const PILLARS: SatriaPillar[] = [
  'Disinformasi & Hoaks',
  'Rekayasa Sosial & Impersonasi',
  'Analisis Narasi & Sentimen',
  'Operasi Kognitif & Bot',
];

const SEVERITIES: SeverityLevel[] = ['Rendah', 'Sedang', 'Tinggi', 'Kritis'];
const STATUSES: IncidentStatus[] = [
  'Terbuka',
  'Sedang Diinvestigasi',
  'Terkendali',
  'Selesai',
];

export function IncidentsView({
  user,
  incidents,
  onIncidentCreated,
  onIncidentUpdated,
  onIncidentDeleted,
}: IncidentsViewProps) {
  const { showToast } = useToast();
  const isAdmin = user.role === 'admin';
  const [selectedId, setSelectedId] = useState<string>(incidents[0]?.id ?? '');
  const [detailTab, setDetailTab] = useState<'evidence' | 'timeline' | 'summary'>('evidence');

  // Create / Edit modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<IncidentRecord | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pillar, setPillar] = useState<SatriaPillar>('Disinformasi & Hoaks');
  const [severity, setSeverity] = useState<SeverityLevel>('Sedang');
  const [status, setStatus] = useState<IncidentStatus>('Terbuka');
  const [affectedAsset, setAffectedAsset] = useState('');
  const [assignedTo, setAssignedTo] = useState(user.name);
  const [savingForm, setSavingForm] = useState(false);

  // Delete confirmation modal
  const [deleteTarget, setDeleteTarget] = useState<IncidentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Evidence form
  const [evLabel, setEvLabel] = useState('');
  const [evType, setEvType] = useState<DigitalEvidence['evidenceType']>('Tautan / Akun Sosial');
  const [evValue, setEvValue] = useState('');
  const [addingEv, setAddingEv] = useState(false);

  // Timeline form
  const [tlAction, setTlAction] = useState('');
  const [tlNotes, setTlNotes] = useState('');
  const [addingTl, setAddingTl] = useState(false);

  // AI Summary & feedback
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState(incidents[0]?.aiSummary ?? '');
  const [savingSummary, setSavingSummary] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [copiedEvId, setCopiedEvId] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  const selected = incidents.find((i) => i.id === selectedId) || incidents[0] || null;
  const activeSelectedId = selected?.id ?? '';

  useEffect(() => {
    setSummaryDraft(selected?.aiSummary ?? '');
    setFeedbackMsg('');
  }, [activeSelectedId]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  function openCreateModal() {
    setEditingIncident(null);
    setTitle('');
    setDescription('');
    setPillar('Disinformasi & Hoaks');
    setSeverity('Sedang');
    setStatus('Terbuka');
    setAffectedAsset('');
    setAssignedTo(user.name);
    setFormError('');
    setFormModalOpen(true);
  }

  function openEditModal(inc: IncidentRecord) {
    setEditingIncident(inc);
    setTitle(inc.title);
    setDescription(inc.description);
    setPillar(inc.pillar);
    setSeverity(inc.severity);
    setStatus(inc.status);
    setAffectedAsset(inc.affectedAsset);
    setAssignedTo(inc.assignedTo);
    setFormError('');
    setFormModalOpen(true);
  }

  async function handleSaveIncidentForm(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setFormError('Judul kasus dan deskripsi narasi wajib diisi.');
      return;
    }
    setSavingForm(true);
    setFormError('');
    setErrorMsg('');
    try {
      if (editingIncident) {
        const res = await fetch(`/api/incidents/${editingIncident.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            pillar,
            severity,
            status,
            affectedAsset: affectedAsset.trim(),
            assignedTo: assignedTo.trim(),
            actorName: user.name,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          incident?: IncidentRecord;
          error?: string;
        };
        if (res.ok && json.incident) {
          onIncidentUpdated(json.incident);
          setSelectedId(json.incident.id);
          setFormModalOpen(false);
          showToast({
            variant: 'success',
            title: `Kasus ${json.incident.code} diperbarui`,
          });
        } else {
          setFormError(json.error || 'Gagal menyimpan perubahan kasus.');
        }
      } else {
        const res = await fetch('/api/incidents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            pillar,
            severity,
            status,
            affectedAsset: affectedAsset.trim(),
            reporter: user.name,
            assignedTo: assignedTo.trim(),
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          incident?: IncidentRecord;
          error?: string;
        };
        if (res.ok && json.incident) {
          onIncidentCreated(json.incident);
          setSelectedId(json.incident.id);
          setFormModalOpen(false);
          showToast({
            variant: 'success',
            title: `Tiket kasus ${json.incident.code} dibuat`,
            description: json.incident.title,
          });
        } else {
          setFormError(json.error || 'Gagal membuat tiket kasus.');
        }
      }
    } catch {
      setFormError('Gagal terhubung ke server saat menyimpan kasus.');
    } finally {
      setSavingForm(false);
    }
  }

  async function handleQuickStatusChange(nextStatus: IncidentStatus) {
    if (!selected) return;
    setErrorMsg('');
    try {
      const res = await fetch(`/api/incidents/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, actorName: user.name }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        incident?: IncidentRecord;
        error?: string;
      };
      if (res.ok && json.incident) {
        onIncidentUpdated(json.incident);
        showToast({
          variant: 'info',
          title: `Status ${json.incident.code} diubah ke "${nextStatus}"`,
        });
      } else {
        showToast({
          variant: 'error',
          title: 'Gagal mengubah status',
          description: json.error || 'Terjadi kendala saat memperbarui status.',
        });
      }
    } catch {
      showToast({
        variant: 'error',
        title: 'Koneksi ke server gagal',
        description: 'Status kasus tidak dapat diperbarui.',
      });
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/incidents/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName: user.name, actorRole: user.role }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok) {
        const deletedCode = deleteTarget.code;
        onIncidentDeleted(deleteTarget.id);
        if (selectedId === deleteTarget.id) {
          setSelectedId('');
        }
        setDeleteTarget(null);
        showToast({
          variant: 'success',
          title: `Kasus ${deletedCode} berhasil dihapus`,
        });
      } else {
        setErrorMsg(json.error || 'Gagal menghapus kasus.');
        setDeleteTarget(null);
      }
    } catch {
      setErrorMsg('Gagal terhubung ke server saat menghapus kasus.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddEvidence(e: FormEvent) {
    e.preventDefault();
    if (!selected || !evLabel.trim() || !evValue.trim()) return;
    setAddingEv(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/incidents/${selected.id}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: evLabel.trim(),
          evidenceType: evType,
          value: evValue.trim(),
          collectedBy: user.name,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        incident?: IncidentRecord;
        error?: string;
      };
      if (res.ok && json.incident) {
        onIncidentUpdated(json.incident);
        setEvLabel('');
        setEvValue('');
        showToast({ variant: 'success', title: 'Bukti digital sosial ditambahkan' });
      } else {
        showToast({
          variant: 'error',
          title: 'Gagal menambah bukti',
          description: json.error || 'Periksa kembali input bukti sosial.',
        });
      }
    } catch {
      showToast({ variant: 'error', title: 'Gagal terhubung ke server' });
    } finally {
      setAddingEv(false);
    }
  }

  async function handleAddTimeline(e: FormEvent) {
    e.preventDefault();
    if (!selected || !tlAction.trim() || !tlNotes.trim()) return;
    setAddingTl(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/incidents/${selected.id}/timeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: tlAction.trim(),
          notes: tlNotes.trim(),
          actor: user.name,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        incident?: IncidentRecord;
        error?: string;
      };
      if (res.ok && json.incident) {
        onIncidentUpdated(json.incident);
        setTlAction('');
        setTlNotes('');
        showToast({ variant: 'success', title: 'Entri kronologi ditambahkan' });
      } else {
        showToast({
          variant: 'error',
          title: 'Gagal menambah kronologi',
          description: json.error || 'Periksa kembali catatan kronologi.',
        });
      }
    } catch {
      showToast({ variant: 'error', title: 'Gagal terhubung ke server' });
    } finally {
      setAddingTl(false);
    }
  }

  async function handleGenerateAiSummary() {
    if (!selected) return;
    setGeneratingSummary(true);
    setFeedbackMsg('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/incidents/${selected.id}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorName: user.name }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        incident?: IncidentRecord;
        usedFallback?: boolean;
        error?: string;
      };
      if (res.ok && json.incident) {
        onIncidentUpdated(json.incident);
        setSummaryDraft(json.incident.aiSummary);
        setFeedbackMsg(
          json.usedFallback
            ? 'Ringkasan dibuat dengan templat lokal (kunci Gemini server belum aktif).'
            : 'Ringkasan investigasi Siber Sosial AI Gemini berhasil dibuat dan disimpan.',
        );
        showToast({
          variant: 'success',
          title: 'Ringkasan Investigasi AI Selesai',
          description: `Kasus ${json.incident.code} telah disintesis.`,
        });
      } else {
        showToast({
          variant: 'error',
          title: 'Gagal membuat ringkasan AI',
          description: json.error || 'Layanan ringkasan gagal memproses kasus.',
        });
      }
    } catch {
      showToast({ variant: 'error', title: 'Gagal terhubung ke layanan AI server' });
    } finally {
      setGeneratingSummary(false);
    }
  }

  async function handleSaveEditedSummary() {
    if (!selected) return;
    setSavingSummary(true);
    setFeedbackMsg('');
    setErrorMsg('');
    try {
      const res = await fetch(`/api/incidents/${selected.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiSummary: summaryDraft,
          actorName: user.name,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        incident?: IncidentRecord;
        error?: string;
      };
      if (res.ok && json.incident) {
        onIncidentUpdated(json.incident);
        setFeedbackMsg('Hasil investigasi berhasil diperbarui.');
        showToast({ variant: 'success', title: 'Ringkasan investigasi disimpan' });
      } else {
        showToast({
          variant: 'error',
          title: 'Gagal menyimpan ringkasan',
          description: json.error || 'Silakan coba lagi.',
        });
      }
    } catch {
      showToast({ variant: 'error', title: 'Gagal terhubung ke server' });
    } finally {
      setSavingSummary(false);
    }
  }

  function handleDownloadIncidentPdf(inc: IncidentRecord) {
    setErrorMsg('');
    const result = exportIncidentPdf(inc, user);
    if (!result.ok) {
      setErrorMsg(result.error || 'Gagal mengunduh laporan PDF.');
      return;
    }
    showToast({
      variant: 'success',
      title: `PDF Kasus ${inc.code} Diunduh`,
    });
  }

  async function handleCopyEvidence(ev: DigitalEvidence) {
    try {
      await navigator.clipboard.writeText(ev.value);
      setCopiedEvId(ev.id);
      showToast({ variant: 'success', title: 'Artefak bukti disalin' });
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedEvId((prev) => (prev === ev.id ? null : prev));
      }, 1500);
    } catch {
      showToast({ variant: 'warning', title: 'Clipboard tidak tersedia' });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#1B2B48]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Investigasi Kasus Siber Sosial
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Kelola tiket disinformasi, impersonasi akun, dan operasi kognitif lengkap dengan bukti sosial, kronologi, ringkasan Gemini AI, serta ekspor PDF.
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={openCreateModal}
          className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Kasus Sosial Baru</span>
        </motion.button>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Incident List */}
        <div className="lg:col-span-4 space-y-3">
          {incidents.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#0B1428] border border-[#1B2B48] text-center">
              <FolderSearch className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-white">Belum Ada Kasus Siber Sosial</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">
                Buat tiket investigasi pertama untuk mendokumentasikan bukti sosial.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="py-2 px-4 rounded-lg bg-red-600 text-xs font-semibold text-white"
              >
                Buat Kasus Pertama
              </button>
            </div>
          ) : (
            incidents.map((inc) => {
              const active = selected?.id === inc.id;
              return (
                <motion.button
                  key={inc.id}
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    setSelectedId(inc.id);
                    setSummaryDraft(inc.aiSummary);
                    setFeedbackMsg('');
                    setErrorMsg('');
                  }}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    active
                      ? 'bg-[#12203E] border-[#2D4775]'
                      : 'bg-[#0B1428] border-[#1B2B48] hover:bg-[#0F1B35]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-300">
                      {inc.code}
                      {inc.isDemo ? ' · DEMO' : ''}
                    </span>
                    <span className={`font-semibold ${getRiskTextClass(inc.severity)}`}>
                      {inc.severity}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-sm font-semibold text-white line-clamp-2">
                    {inc.title}
                  </h2>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                    <span className={getIncidentStatusClass(inc.status)}>{inc.status}</span>
                    <span className="font-mono tabular-nums">
                      {inc.evidence.length} bukti · {inc.timeline.length} log
                    </span>
                  </div>
                </motion.button>
              );
            })
          )}
        </div>

        {/* Right: Incident Detail Workspace */}
        <div className="lg:col-span-8">
          {!selected ? (
            <div className="p-10 rounded-xl bg-[#0B1428] border border-[#1B2B48] text-center text-sm text-slate-400">
              Pilih kasus dari daftar untuk melihat detail investigasi Siber Sosial.
            </div>
          ) : (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="p-6 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-6"
            >
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#1B2B48]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-slate-200">{selected.code}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-semibold ${getRiskTextClass(selected.severity)}`}>
                      Keparahan {selected.severity}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={`font-semibold ${getIncidentStatusClass(selected.status)}`}>
                      {selected.status}
                    </span>
                    {selected.isDemo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-amber-400">DEMO</span>
                      </>
                    )}
                  </div>
                  <h2 className="mt-1.5 text-xl font-bold text-white">{selected.title}</h2>
                  <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {selected.description}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <select
                    aria-label="Ubah status cepat"
                    value={selected.status}
                    onChange={(e) => void handleQuickStatusChange(e.target.value as IncidentStatus)}
                    className="py-2 px-2.5 rounded-lg bg-[#060C1A] border border-[#24375C] text-xs text-slate-100"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        Status: {st}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openEditModal(selected)}
                    className="py-2 px-3 rounded-lg bg-[#101C36] hover:bg-[#17284B] border border-[#24375C] text-xs font-medium text-slate-200 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadIncidentPdf(selected)}
                    className="py-2 px-3 rounded-lg bg-[#101C36] hover:bg-[#17284B] border border-[#24375C] text-xs font-medium text-sky-300 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh PDF</span>
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selected)}
                      className="py-2 px-3 rounded-lg bg-red-950/50 hover:bg-red-900/60 border border-red-800/70 text-xs font-medium text-red-300 flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  ) : (
                    <span
                      title="Penghapusan tiket kasus hanya tersedia untuk peran Admin (Yahya)"
                      className="py-2 px-3 rounded-lg bg-[#081022] border border-[#1B2B48] text-xs text-slate-500 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Hapus (Admin)</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-lg bg-[#081022] border border-[#172540]">
                  <div className="text-slate-400">Kanal / Komunitas Terdampak</div>
                  <div className="mt-1 font-medium text-white">{selected.affectedAsset}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#081022] border border-[#172540]">
                  <div className="text-slate-400">Sub-Domain Siber Sosial</div>
                  <div className="mt-1 font-medium text-white">{selected.pillar}</div>
                </div>
                <div className="p-3 rounded-lg bg-[#081022] border border-[#172540]">
                  <div className="text-slate-400">Penanggung Jawab</div>
                  <div className="mt-1 font-medium text-white">{selected.assignedTo}</div>
                </div>
              </div>

              {/* Animated Workspace Sub-tabs */}
              <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-[#060C1A] border border-[#1B2B48] w-fit relative">
                {(
                  [
                    {
                      id: 'evidence',
                      label: `Bukti Sosial (${selected.evidence.length})`,
                      icon: HardDrive,
                    },
                    {
                      id: 'timeline',
                      label: `Kronologi (${selected.timeline.length})`,
                      icon: Clock,
                    },
                    {
                      id: 'summary',
                      label: 'Ringkasan AI',
                      icon: Sparkles,
                    },
                  ] as const
                ).map((t) => {
                  const Icon = t.icon;
                  const active = detailTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDetailTab(t.id)}
                      className={`relative py-2 px-3.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors z-10 ${
                        active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="incidentDetailTab"
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className="absolute inset-0 bg-[#162544] rounded-md -z-10"
                        />
                      )}
                      <Icon className="w-3.5 h-3.5" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Evidence */}
              {detailTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    {selected.evidence.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3">
                        Belum ada bukti digital sosial yang disimpan pada kasus ini.
                      </p>
                    ) : (
                      selected.evidence.map((ev, idx) => (
                        <motion.div
                          key={ev.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.16, delay: idx * 0.03 }}
                          className="p-3.5 rounded-lg bg-[#081022] border border-[#172540]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-white">
                              {ev.label} ·{' '}
                              <span className="text-sky-400 font-normal">{ev.evidenceType}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                                {ev.collectedBy} · {formatDateTime(ev.collectedAt)}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleCopyEvidence(ev)}
                                aria-label="Salin nilai bukti"
                                className="p-1 rounded bg-[#101C36] hover:bg-[#192B50] text-slate-300 transition-colors"
                              >
                                {copiedEvId === ev.id ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                          <div className="mt-1.5 text-xs font-mono text-slate-300 break-all">
                            {ev.value}
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={handleAddEvidence}
                    className="p-4 rounded-lg bg-[#081022] border border-[#1E2E4E] space-y-3"
                  >
                    <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <FilePlus2 className="w-4 h-4 text-sky-400" />
                      <span>Tambah Bukti Digital Sosial Baru</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={evLabel}
                        onChange={(e) => setEvLabel(e.target.value)}
                        placeholder="Label bukti (mis. Tautan Video TikTok / Handle)"
                        className="px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white placeholder-slate-500"
                        required
                      />
                      <select
                        value={evType}
                        onChange={(e) =>
                          setEvType(e.target.value as DigitalEvidence['evidenceType'])
                        }
                        className="px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white"
                      >
                        <option value="Tautan / Akun Sosial">Tautan / Akun Sosial</option>
                        <option value="Tangkapan Unggahan">Tangkapan Unggahan</option>
                        <option value="Rekaman Pesan / DM">Rekaman Pesan / DM</option>
                        <option value="Log Aktivitas Sosial">Log Aktivitas Sosial</option>
                        <option value="Arsip Media / Metadata">Arsip Media / Metadata</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={evValue}
                      onChange={(e) => setEvValue(e.target.value)}
                      placeholder="Nilai artefak (URL postingan, @username akun tiruan, atau kutipan pesan)"
                      className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs font-mono text-white placeholder-slate-500"
                      required
                    />
                    <motion.button
                      type="submit"
                      disabled={addingEv}
                      whileTap={{ scale: 0.98 }}
                      className="py-2 px-4 rounded-lg bg-[#142548] hover:bg-[#1B315E] border border-[#2A4478] text-xs font-semibold text-white transition-colors"
                    >
                      {addingEv ? 'Menyimpan...' : 'Simpan Bukti Sosial'}
                    </motion.button>
                  </form>
                </div>
              )}

              {/* Tab 2: Timeline */}
              {detailTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="space-y-2.5">
                    {selected.timeline.length === 0 ? (
                      <p className="text-xs text-slate-400 py-3">Belum ada kronologi kejadian.</p>
                    ) : (
                      selected.timeline.map((tl, idx) => (
                        <motion.div
                          key={tl.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.16, delay: idx * 0.03 }}
                          className="p-3.5 rounded-lg bg-[#081022] border border-[#172540]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-white">{tl.action}</span>
                            <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                              {tl.actor} · {formatDateTime(tl.timestamp)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-300 leading-relaxed">{tl.notes}</p>
                        </motion.div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={handleAddTimeline}
                    className="p-4 rounded-lg bg-[#081022] border border-[#1E2E4E] space-y-3"
                  >
                    <h3 className="text-xs font-semibold text-white">Tambah Entri Kronologi</h3>
                    <input
                      type="text"
                      value={tlAction}
                      onChange={(e) => setTlAction(e.target.value)}
                      placeholder="Judul tahapan (mis. Klarifikasi Resmi / Pelaporan Akun)"
                      className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white placeholder-slate-500"
                      required
                    />
                    <textarea
                      rows={2}
                      value={tlNotes}
                      onChange={(e) => setTlNotes(e.target.value)}
                      placeholder="Catatan detail perkembangan narasi dan tindakan yang diambil..."
                      className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white placeholder-slate-500"
                      required
                    />
                    <motion.button
                      type="submit"
                      disabled={addingTl}
                      whileTap={{ scale: 0.98 }}
                      className="py-2 px-4 rounded-lg bg-[#142548] hover:bg-[#1B315E] border border-[#2A4478] text-xs font-semibold text-white transition-colors"
                    >
                      {addingTl ? 'Menambahkan...' : 'Tambahkan ke Kronologi'}
                    </motion.button>
                  </form>
                </div>
              )}

              {/* Tab 3: AI Summary with SummarySkeleton */}
              {detailTab === 'summary' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        Ringkasan Investigasi Siber Sosial (Gemini AI)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Menyusun sintesis dari deskripsi kasus, bukti sosial, dan kronologi klarifikasi.
                      </p>
                    </div>
                    <motion.button
                      type="button"
                      disabled={generatingSummary}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => void handleGenerateAiSummary()}
                      className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-60 text-xs font-semibold text-white flex items-center gap-2 whitespace-nowrap transition-colors"
                    >
                      {generatingSummary ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {generatingSummary ? 'Menyusun Ringkasan...' : 'Buat Ringkasan AI Gemini'}
                      </span>
                    </motion.button>
                  </div>

                  {feedbackMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/70 text-xs text-emerald-200"
                    >
                      {feedbackMsg}
                    </motion.div>
                  )}

                  {generatingSummary ? (
                    <SummarySkeleton />
                  ) : (
                    <textarea
                      rows={8}
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      placeholder="Klik 'Buat Ringkasan AI Gemini' atau tulis hasil akhir investigasi Siber Sosial di sini..."
                      className="w-full p-4 rounded-lg bg-[#060C1A] border border-[#223456] text-xs sm:text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-red-500 transition-colors"
                    />
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] font-mono text-slate-400">
                      {selected.aiSummaryGeneratedAt
                        ? `Terakhir diperbarui: ${formatDateTime(selected.aiSummaryGeneratedAt)}`
                        : 'Belum ada ringkasan tersimpan'}
                    </span>
                    <motion.button
                      type="button"
                      disabled={savingSummary || generatingSummary}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => void handleSaveEditedSummary()}
                      className="py-2 px-4 rounded-lg bg-[#142548] hover:bg-[#1B315E] border border-[#2A4478] text-xs font-semibold text-white flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingSummary ? 'Menyimpan...' : 'Simpan Hasil Investigasi'}</span>
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* Create / Edit Incident Modal */}
      <AnimatePresence>
        {formModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-lg rounded-xl bg-[#0B1428] border border-[#24375C] p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">
                  {editingIncident
                    ? `Edit Kasus ${editingIncident.code}`
                    : 'Buat Tiket Kasus Siber Sosial'}
                </h2>
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveIncidentForm} className="space-y-3.5">
                {formError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-950/60 border border-red-800/70 text-xs text-red-200"
                  >
                    {formError}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Judul Kasus
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Kampanye Hoaks & Akun Tiruan di TikTok"
                    className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Sub-Domain Siber Sosial
                    </label>
                    <select
                      value={pillar}
                      onChange={(e) => setPillar(e.target.value as SatriaPillar)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white"
                    >
                      {PILLARS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Tingkat Dampak
                    </label>
                    <select
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white"
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Status Penanganan
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as IncidentStatus)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white"
                    >
                      {STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Penanggung Jawab
                    </label>
                    <input
                      type="text"
                      value={assignedTo}
                      onChange={(e) => setAssignedTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Kanal / Komunitas Terdampak
                  </label>
                  <input
                    type="text"
                    value={affectedAsset}
                    onChange={(e) => setAffectedAsset(e.target.value)}
                    placeholder="Contoh: Grup WhatsApp UMKM / Akun Instagram Resmi"
                    className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Deskripsi Narasi & Kronologi Awal
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan klaim yang beredar, platform penyebaran, dan dampaknya terhadap komunitas..."
                    className="w-full px-3 py-2 rounded-lg bg-[#060C1A] border border-[#223456] text-sm text-white"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setFormModalOpen(false)}
                    className="py-2 px-4 rounded-lg bg-[#101C36] border border-[#223456] text-xs font-medium text-slate-300"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={savingForm}
                    className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
                  >
                    {savingForm
                      ? 'Menyimpan...'
                      : editingIncident
                        ? 'Simpan Perubahan'
                        : 'Buat Tiket'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md rounded-xl bg-[#0B1428] border border-red-800/70 p-6 space-y-4"
            >
              <h2 className="text-lg font-bold text-white">Konfirmasi Penghapusan Kasus</h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Apakah Anda yakin ingin menghapus kasus{' '}
                <strong className="text-white font-mono">{deleteTarget.code}</strong> (
                {deleteTarget.title})? Tindakan ini akan menghapus bukti sosial dan kronologi terkait secara permanen.
              </p>
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="py-2 px-4 rounded-lg bg-[#101C36] border border-[#223456] text-xs font-medium text-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleConfirmDelete()}
                  className="py-2 px-4 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white"
                >
                  {deleting ? 'Menghapus...' : 'Ya, Hapus Kasus'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

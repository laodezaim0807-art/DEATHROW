import type {
  IncidentStatus,
  RiskCategory,
  SentimentLabel,
  SeverityLevel,
} from '../types/satria';

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateShort(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getRiskTextClass(category: RiskCategory | SeverityLevel): string {
  switch (category) {
    case 'Kritis':
    case 'Tinggi':
      return 'text-red-400';
    case 'Sedang':
      return 'text-amber-400';
    case 'Rendah':
      return 'text-emerald-400';
  }
}

export function getRiskBarClass(category: RiskCategory | SeverityLevel): string {
  switch (category) {
    case 'Kritis':
    case 'Tinggi':
      return 'bg-red-500';
    case 'Sedang':
      return 'bg-amber-500';
    case 'Rendah':
      return 'bg-emerald-500';
  }
}

export function getSentimentTextClass(sentiment: SentimentLabel): string {
  switch (sentiment) {
    case 'Positif':
      return 'text-emerald-400';
    case 'Negatif':
      return 'text-red-400';
    case 'Netral':
      return 'text-slate-300';
  }
}

export function getIncidentStatusClass(status: IncidentStatus): string {
  switch (status) {
    case 'Terbuka':
      return 'text-red-400';
    case 'Sedang Diinvestigasi':
      return 'text-amber-400';
    case 'Terkendali':
      return 'text-sky-400';
    case 'Selesai':
      return 'text-emerald-400';
  }
}

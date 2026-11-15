import { motion } from 'motion/react';

function Bone({ className = '' }: { className?: string }) {
  return <div className={`rounded-md skeleton-shimmer ${className}`} aria-hidden="true" />;
}

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-[#060C1A] text-slate-100 flex" aria-busy="true" aria-label="Memuat konsol Siber Sosial">
      {/* Sidebar Skeleton */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 bg-[#091226] border-r border-[#1B2B48] p-4 space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-[#1B2B48]">
          <Bone className="w-8 h-8 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Bone className="h-3.5 w-32" />
            <Bone className="h-2.5 w-24" />
          </div>
        </div>
        <div className="space-y-2.5 flex-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-2.5 rounded-lg bg-[#0B1428] border border-[#172540] flex items-center gap-3">
              <Bone className="w-4 h-4 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Bone className="h-3 w-28" />
                <Bone className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 rounded-lg bg-[#081022] border border-[#1B2B48] space-y-2">
          <Bone className="h-3 w-24" />
          <Bone className="h-3.5 w-20" />
          <Bone className="h-8 w-full rounded-lg mt-2" />
        </div>
      </aside>

      {/* Main Content Skeleton */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="h-16 bg-[#081022] border-b border-[#1B2B48] px-6 lg:px-8 flex items-center justify-between">
          <Bone className="h-4 w-52" />
          <div className="flex items-center gap-3">
            <Bone className="h-4 w-24 hidden md:block" />
            <Bone className="h-9 w-28 rounded-lg" />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[#1B2B48]">
            <div className="space-y-2">
              <Bone className="h-3 w-56" />
              <Bone className="h-7 w-72" />
              <Bone className="h-4 w-96 max-w-full" />
            </div>
            <div className="flex gap-2.5">
              <Bone className="h-9 w-36 rounded-lg" />
              <Bone className="h-9 w-40 rounded-lg" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-3">
                <div className="flex justify-between">
                  <Bone className="h-3.5 w-32" />
                  <Bone className="h-4 w-4" />
                </div>
                <Bone className="h-8 w-16" />
                <Bone className="h-3 w-full" />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-4">
              <Bone className="h-4 w-64" />
              <Bone className="h-3 w-48" />
              <Bone className="h-60 w-full rounded-lg" />
            </div>
            <div className="lg:col-span-5 p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-4">
              <Bone className="h-4 w-56" />
              <Bone className="h-3 w-44" />
              <Bone className="h-60 w-full rounded-lg" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function DashboardPanelSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
      aria-busy="true"
      aria-label="Menyegarkan data Siber Sosial"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-3">
            <div className="flex justify-between">
              <Bone className="h-3.5 w-32" />
              <Bone className="h-4 w-4" />
            </div>
            <Bone className="h-8 w-16" />
            <Bone className="h-3 w-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-4">
          <Bone className="h-4 w-64" />
          <Bone className="h-60 w-full rounded-lg" />
        </div>
        <div className="lg:col-span-5 p-5 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-4">
          <Bone className="h-4 w-56" />
          <Bone className="h-60 w-full rounded-lg" />
        </div>
      </div>
    </motion.div>
  );
}

export function AnalysisResultSkeleton({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="p-6 rounded-xl bg-[#0B1428] border border-[#1B2B48] space-y-6"
      aria-busy="true"
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#1B2B48]">
        <div className="space-y-2 flex-1">
          <Bone className="h-3 w-48" />
          <Bone className="h-6 w-72 max-w-full" />
          <Bone className="h-3 w-64 max-w-full" />
        </div>
        <div className="space-y-1.5 w-24">
          <Bone className="h-3 w-24" />
          <Bone className="h-8 w-16 ml-auto" />
        </div>
      </div>

      <div className="p-4 rounded-lg bg-[#081022] border border-[#172540] space-y-3">
        <div className="flex justify-between">
          <Bone className="h-3 w-36" />
          <Bone className="h-3 w-48" />
        </div>
        <Bone className="h-3 w-full rounded-full" />
      </div>

      <div className="p-4 rounded-lg bg-[#081022] border border-[#172540] space-y-2">
        <Bone className="h-3 w-28" />
        <Bone className="h-3.5 w-full" />
        <Bone className="h-3.5 w-5/6" />
      </div>

      <div className="space-y-2.5">
        <Bone className="h-4 w-44" />
        <Bone className="h-14 w-full rounded-lg" />
        <Bone className="h-14 w-full rounded-lg" />
      </div>

      <div className="space-y-2">
        <Bone className="h-4 w-52" />
        <Bone className="h-3.5 w-full" />
        <Bone className="h-3.5 w-4/5" />
      </div>
    </motion.div>
  );
}

export function SummarySkeleton() {
  return (
    <div
      className="p-4 rounded-lg bg-[#060C1A] border border-[#223456] space-y-2.5"
      aria-busy="true"
      aria-label="Menyusun ringkasan investigasi AI"
    >
      <Bone className="h-3.5 w-48" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-11/12" />
      <Bone className="h-3 w-4/5" />
      <Bone className="h-3.5 w-40 mt-3" />
      <Bone className="h-3 w-full" />
      <Bone className="h-3 w-3/4" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3" aria-busy="true" aria-label="Memuat baris log">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 gap-3 items-center py-2 border-b border-[#15223C]">
          <Bone className="col-span-2 h-3.5" />
          <Bone className="col-span-2 h-3.5" />
          <Bone className="col-span-1 h-3.5" />
          <Bone className="col-span-2 h-3.5" />
          <Bone className="col-span-4 h-3.5" />
          <Bone className="col-span-1 h-3.5" />
        </div>
      ))}
    </div>
  );
}

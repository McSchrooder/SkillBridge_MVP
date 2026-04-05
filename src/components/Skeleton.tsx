"use client";

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 animate-pulse ${className}`}>
      <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
      <div className="space-y-3">
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-5/6" />
        <div className="h-3 bg-slate-100 rounded w-4/6" />
      </div>
    </div>
  );
}

export function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
          <div className="h-7 bg-slate-200 rounded w-16 mb-2" />
          <div className="h-3 bg-slate-100 rounded w-24" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-6 animate-pulse ${className}`}>
      <div className="h-5 bg-slate-200 rounded w-1/3 mb-4" />
      <div className="h-48 bg-slate-50 rounded-lg flex items-end justify-around px-8 pb-4 gap-4">
        {[40, 65, 85, 55].map((h, i) => (
          <div key={i} className="bg-slate-200 rounded-t w-12" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export function ResultsPageSkeleton() {
  return (
    <div className="p-6 sm:p-8 space-y-8">
      <div className="animate-pulse">
        <div className="h-7 bg-slate-200 rounded w-72 mb-2" />
        <div className="h-4 bg-slate-100 rounded w-48" />
      </div>
      <SkeletonStatCards />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <SkeletonCard />
        <SkeletonChart />
      </div>
      <SkeletonChart />
      <SkeletonCard />
    </div>
  );
}

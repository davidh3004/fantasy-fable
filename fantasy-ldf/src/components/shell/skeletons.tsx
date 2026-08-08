import { Skeleton } from "@/components/ui/skeleton";

/** Header + stacked list rows — generic page placeholder. */
export function ListPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-2 h-4 w-24" />
      <div className="mt-6 flex flex-col gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </main>
  );
}

/** Stats tiles + hero card + rows — home dashboard placeholder. */
export function DashboardSkeleton() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8">
      {/* Hero */}
      <Skeleton className="h-44 w-full rounded-2xl sm:h-36" />
      {/* Status chips */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
      {/* Performance / matches / league */}
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    </main>
  );
}

/** Pitch + bench — team and transfers placeholder. */
export function PitchPageSkeleton() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-end justify-between gap-2">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-24" />
        </div>
        <Skeleton className="h-7 w-44 rounded-lg" />
      </div>
      <Skeleton className="mx-auto mt-5 aspect-[3/4] max-h-[min(62vh,34rem)] min-h-[24rem] w-full max-w-md rounded-xl" />
      <Skeleton className="mt-4 h-24 w-full rounded-xl" />
    </main>
  );
}

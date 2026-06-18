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
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-2 h-9 w-56" />
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-32 w-full rounded-xl" />
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Skeleton className="h-12 rounded-lg" />
        <Skeleton className="h-12 rounded-lg" />
      </div>
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
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

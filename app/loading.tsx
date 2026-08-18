import { Skeleton } from "@/components/ui/skeleton";
import { StockGridSkeleton } from "@/components/dashboard/stock-grid";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 pt-14 pb-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-3 w-64" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      <div className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="glass space-y-6 p-5">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
            <div className="space-y-2.5">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>

      <div className="glass mt-3 h-64 p-6">
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="mt-16">
        <StockGridSkeleton />
      </div>
    </main>
  );
}

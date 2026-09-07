export default function AppLoading() {
  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-4 py-5 sm:p-8 min-w-0 space-y-4 animate-pulse">
        <div className="h-7 w-40 rounded-md bg-surface-raised" />
        <div className="h-4 w-64 rounded-md bg-surface-raised" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-lg border border-border bg-surface"
            />
          ))}
        </div>
        <div className="h-40 rounded-lg border border-border bg-surface" />
      </div>
    </div>
  );
}

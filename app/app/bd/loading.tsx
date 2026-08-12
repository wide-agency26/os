export default function BdLoading() {
  return (
    <div className="p-6 space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded-md bg-gray-100" />
      <div className="h-4 w-72 rounded bg-gray-50" />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50/80 h-64" />
        ))}
      </div>
    </div>
  );
}

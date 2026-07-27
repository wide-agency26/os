import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-[13px]">
      <div className="max-w-md w-full p-8 bg-white rounded-lg border border-gray-200 shadow-sm text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Page Not Found</h2>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link 
          href="/app/home" 
          className="inline-flex items-center justify-center px-4 py-2 bg-black text-white rounded font-medium hover:bg-gray-800 transition-colors shadow-sm"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}

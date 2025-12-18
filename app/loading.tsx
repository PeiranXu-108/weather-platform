export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-2 border-sky-400"></div>
        <p className="mt-4 text-xl text-sky-700">正在加载天气数据...</p>
      </div>
    </div>
  );
}


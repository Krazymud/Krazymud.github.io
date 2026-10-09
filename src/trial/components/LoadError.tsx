export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-10 text-center">
      <p className="text-sm">词库加载失败</p>
      <button type="button" onClick={onRetry} className="mt-4 border border-accent-hi px-6 py-2 text-sm">
        重试
      </button>
    </div>
  )
}

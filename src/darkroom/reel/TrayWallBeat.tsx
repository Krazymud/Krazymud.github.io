import { useReel } from './ReelStage'

export function TrayWallBeat() {
  const { next } = useReel()

  return (
    <section
      data-testid="tray-wall-beat"
      className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-fg"
      aria-label="照片墙"
    >
      <p className="font-display text-lg tracking-widest">照片墙</p>
      <p className="text-xs text-muted">从显影盘中挑选，订上钉子。（占位 · 后续接显影流程）</p>
      <button
        type="button"
        className="border border-accent-hi px-6 py-2 text-sm"
        onClick={() => next()}
      >
        继续
      </button>
    </section>
  )
}

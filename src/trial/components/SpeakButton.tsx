export function SpeakButton({ text }: { text: string }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null

  function speak() {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  return (
    <button type="button" onClick={speak} aria-label={`朗读 ${text}`} className="text-muted hover:text-accent-hi">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 9v6h4l5 4V5L8 9H4z" />
        <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" />
      </svg>
    </button>
  )
}

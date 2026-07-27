import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

// Asosiy ovozli kiritish widget'i: katta mikrofon tugmasi + matn bilan
// kiritish zaxira varianti (brauzer ovoz tanishni qo'llab-quvvatlamasa
// yoki shovqinli joyda ishlash qiyin bo'lsa ham ishlatish mumkin bo'lishi
// uchun).
export default function VoiceRecorder({ onTranscript, lang = 'uz-UZ' }) {
  const { t } = useTranslation()
  const [listening, setListening] = useState(false)
  const [manualText, setManualText] = useState('')
  const recognitionRef = useRef(null)

  function start() {
    if (!SpeechRecognitionImpl) return
    const recognition = new SpeechRecognitionImpl()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onTranscript(transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  function stop() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  function submitManual(e) {
    e.preventDefault()
    if (!manualText.trim()) return
    onTranscript(manualText.trim())
    setManualText('')
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {SpeechRecognitionImpl && (
        <button
          type="button"
          onClick={listening ? stop : start}
          className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl text-white transition
            ${listening ? 'bg-bad animate-pulse' : 'bg-gradient-to-br from-orange to-brown shadow-[var(--shadow-card-lg)]'}`}
        >
          🎤
        </button>
      )}
      <p className="text-sm text-ink-muted font-semibold text-center">
        {listening ? t('voice.listening') : t('voice.tapToSpeak')}
      </p>

      <form onSubmit={submitManual} className="flex gap-2 w-full max-w-md">
        <input
          className="input flex-1"
          placeholder={t('voice.manualPlaceholder')}
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
        />
        <button type="submit" className="btn-secondary px-4">
          {t('voice.analyze')}
        </button>
      </form>
    </div>
  )
}

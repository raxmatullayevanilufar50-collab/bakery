import { useRef, useState } from 'react'

const SpeechRecognitionImpl =
  typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

// Ovozli kiritish (7-bo'lim): ishchi/haydovchi qo'li band bo'lganda
// mahsulot nomi yoki miqdorni ovoz orqali kiritishi uchun.
export default function VoiceButton({ onResult, lang = 'uz-UZ' }) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognitionRef = useRef(null)

  if (!SpeechRecognitionImpl) {
    return null
  }

  function start() {
    setError('')
    const recognition = new SpeechRecognitionImpl()
    recognition.lang = lang
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      onResult(transcript)
    }
    recognition.onerror = () => {
      setError("Ovozni tanib bo'lmadi, qaytadan urinib ko'ring")
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }

  function stop() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={listening ? stop : start}
        className={`w-11 h-11 rounded-full flex items-center justify-center transition
          ${listening ? 'bg-bad text-white animate-pulse' : 'bg-orange-pale text-brown'}`}
        aria-label="Ovoz orqali kiritish"
      >
        🎤
      </button>
      {error && <span className="text-xs text-bad font-semibold">{error}</span>}
    </div>
  )
}

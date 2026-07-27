const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']

export default function Numpad({ value, onChange, maxLength = 6 }) {
  function press(key) {
    if (key === '') return
    if (key === 'del') {
      onChange(value.slice(0, -1))
      return
    }
    if (value.length < maxLength) {
      onChange(value + key)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {KEYS.map((key, i) => (
        <button
          key={i}
          type="button"
          disabled={key === ''}
          onClick={() => press(key)}
          className={`h-16 rounded-2xl text-2xl font-bold select-none active:scale-95 transition
            ${key === '' ? 'invisible' : 'bg-cream text-brown-dark hover:bg-orange-pale border border-brown/10'}`}
        >
          {key === 'del' ? '⌫' : key}
        </button>
      ))}
    </div>
  )
}

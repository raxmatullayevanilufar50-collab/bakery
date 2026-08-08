import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const show = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((items) => [...items, { id, message, type }])
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 3000)
  }, [])
  const value = useMemo(() => ({ show, success: (m) => show(m, 'success'), error: (m) => show(m, 'error'), info: (m) => show(m, 'info') }), [show])
  return <ToastContext.Provider value={value}>{children}<div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 w-[min( calc(100vw-2rem),360px)]">{toasts.map((toast) => <div key={toast.id} className={`rounded-xl px-4 py-3 text-sm font-bold text-white shadow-lg ${toast.type === 'success' ? 'bg-good' : toast.type === 'error' ? 'bg-bad' : 'bg-orange'}`}>{toast.message}</div>)}</div></ToastContext.Provider>
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}

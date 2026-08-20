import { useSyncExternalStore } from 'react'

// Demo rejimidagi "soft-write" holati.
//
// Nega umumiy do'kon kerak: ishlab chiqarish qaydi bitta ekranda
// kiritiladi, lekin natijasi BOSHQA ekranlarda ko'rinishi kerak —
// xomashyo Omborda kamayadi, tayyor mahsulot Kassada ko'payadi.
// Har bir bo'lim faqat o'z komponent state'ini yangilasa, mehmon
// bo'lim almashtirishi bilan o'zgarish yo'qolardi va zanjir
// ko'rinmasdi.
//
// Bu — faqat brauzer xotirasi. Sahifa yangilanganda modul qayta
// yuklanadi va hamma narsa asl holatiga qaytadi, ya'ni "demo
// ma'lumoti boshlang'ich holatga qaytadi" qoidasi saqlanadi.

const EMPTY = {
  // inventory_items.id -> qo'shiladigan miqdor (manfiy = sarflandi)
  inventoryDelta: {},
  // products.id -> vitrinaga qo'shiladigan miqdor
  displayDelta: {},
  // Ekranga qo'shiladigan soxta qatorlar
  productionLogs: [],
  sales: [],
}

let state = EMPTY
const listeners = new Set()

function emit(next) {
  state = next
  for (const fn of listeners) fn()
}

function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function getSnapshot() {
  return state
}

// Komponentlar shu hook orqali obuna bo'ladi. useSyncExternalStore
// React'ning tashqi do'konlar uchun rasmiy yo'li — qayta chizish
// kafolatlanadi.
export function useDemoStore() {
  return useSyncExternalStore(subscribe, getSnapshot)
}

export function getDemoStore() {
  return state
}

function mergeDelta(base, patch) {
  const out = { ...base }
  for (const [key, value] of Object.entries(patch)) {
    out[key] = (out[key] || 0) + value
  }
  return out
}

// Nonvoy "N dona pishirdim" dedi: retsept bo'yicha xomashyo kamayadi,
// vitrinaga tayyor mahsulot qo'shiladi — serverdagi trigger nima
// qilsa, aynan o'shani takrorlaymiz.
export function applyDemoProduction({ logs = [], inventoryDelta = {}, displayDelta = {} }) {
  emit({
    inventoryDelta: mergeDelta(state.inventoryDelta, inventoryDelta),
    displayDelta: mergeDelta(state.displayDelta, displayDelta),
    productionLogs: [...logs, ...state.productionLogs],
    sales: state.sales,
  })
}

// Kassir sotdi: vitrina kamayadi.
export function applyDemoSale({ sales = [], displayDelta = {} }) {
  emit({
    inventoryDelta: state.inventoryDelta,
    displayDelta: mergeDelta(state.displayDelta, displayDelta),
    productionLogs: state.productionLogs,
    sales: [...sales, ...state.sales],
  })
}

export function resetDemoStore() {
  emit(EMPTY)
}

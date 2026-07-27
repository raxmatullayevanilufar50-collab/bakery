// Ovozli kiritishni (savdo va ishlab chiqarish qaydi) tahlil qilish uchun
// yordamchi funksiyalar. Bu — eng yaxshi urinish (best-effort) tahlilchi:
// tanish ovoz matni har doim aniq bo'lavermaydi, shuning uchun natija
// tasdiqlash/tahrirlash ekranida foydalanuvchiga ko'rsatiladi — bu yerdagi
// xatolar UI darajasida tuzatiladi, ma'lumotlar bazasiga to'g'ridan-to'g'ri
// yozilmaydi.

const ONES = {
  nol: 0,
  bir: 1,
  bitta: 1,
  ikki: 2,
  uch: 3,
  tort: 4,
  "to'rt": 4,
  besh: 5,
  olti: 6,
  yetti: 7,
  sakkiz: 8,
  toqqiz: 9,
  "to'qqiz": 9,
}

const TENS = {
  on: 10,
  "o'n": 10,
  yigirma: 20,
  ottiz: 30,
  "o'ttiz": 30,
  qirq: 40,
  ellik: 50,
  oltmish: 60,
  yetmish: 70,
  sakson: 80,
  toqson: 90,
  "to'qson": 90,
}

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[ʻʼ'`’‘]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripApostrophe(word) {
  return word.replace(/[ʻʼ'`’‘]/g, '')
}

// Normallashtirilgan (apostrofsiz) lug'atlar — "o'n" -> "on" ko'rinishida
// ham topilishi uchun.
const ONES_NORM = Object.fromEntries(Object.entries(ONES).map(([k, v]) => [stripApostrophe(k), v]))
const TENS_NORM = Object.fromEntries(Object.entries(TENS).map(([k, v]) => [stripApostrophe(k), v]))

// Sanoq son + "-ta" qo'shimchasi ("ikkita", "beshta", "o'nta"...) og'zaki
// nutqda "ikki dona", "besh dona"dan ko'ra ko'proq ishlatiladi.
// "bitta" (1) alohida qo'shildi — "bir" + "ta" emas.
function wordToNumber(word) {
  if (word in ONES_NORM) return ONES_NORM[word]
  if (word in TENS_NORM) return TENS_NORM[word]
  if (word.length > 2 && word.endsWith('ta')) {
    const stem = word.slice(0, -2)
    if (stem in ONES_NORM) return ONES_NORM[stem]
    if (stem in TENS_NORM) return TENS_NORM[stem]
  }
  return null
}

// So'z bilan aytilgan sonlarni (masalan "o'n besh ming") raqamlarga
// aylantiradi: "o'n besh ming" -> "15000". Boshqa so'zlarga tegmaydi.
export function numeralize(normalizedText) {
  const words = normalizedText.split(' ')
  const out = []
  let current = 0
  let hasCurrent = false

  function flush() {
    if (hasCurrent) {
      out.push(String(current))
      current = 0
      hasCurrent = false
    }
  }

  for (const word of words) {
    const value = wordToNumber(word)
    if (value !== null) {
      current += value
      hasCurrent = true
    } else if (word === 'yuz') {
      current = (hasCurrent ? current : 1) * 100
      hasCurrent = true
    } else if (word === 'ming') {
      out.push(String((hasCurrent ? current : 1) * 1000))
      current = 0
      hasCurrent = false
    } else {
      flush()
      out.push(word)
    }
  }
  flush()
  return out.join(' ')
}

function findNumberNear(numeralized, keywords) {
  const words = numeralized.split(' ')
  for (const kw of keywords) {
    const idx = words.findIndex((w) => w.startsWith(kw))
    if (idx > 0 && /^\d+$/.test(words[idx - 1])) {
      return Number(words[idx - 1])
    }
    if (idx >= 0 && idx + 1 < words.length && /^\d+$/.test(words[idx + 1])) {
      return Number(words[idx + 1])
    }
  }
  return null
}

function findFirstNumber(numeralized) {
  const match = numeralized.match(/\d+/)
  return match ? Number(match[0]) : null
}

function matchProduct(normalizedText, products) {
  let best = null
  for (const p of products) {
    const name = normalize(p.name)
    if (!name) continue
    if (normalizedText.includes(name) && (!best || name.length > normalize(best.name).length)) {
      best = p
    }
  }
  return best
}

const CUSTOMER_STOPWORDS = new Set([
  'dona',
  'kg',
  'som',
  'sum',
  'sotdi',
  'sotdim',
  'sotildi',
  'pishirdim',
  'pishirildi',
  'uchun',
  'ming',
  'yuz',
])

// "Aziz'ga" / "Azizga" kabi jo'nalish kelishigi qo'shimchasi bilan
// aytilgan mijoz ismini eng yaxshi urinish asosida topadi.
function extractCustomerName(normalizedText, productName) {
  const words = normalizedText.split(' ')
  for (const word of words) {
    if (word.length < 4) continue
    if (CUSTOMER_STOPWORDS.has(word)) continue
    if (productName && normalize(productName).includes(word)) continue
    if (/^\d+$/.test(word)) continue
    const suffixMatch = word.match(/^([a-z]{3,})(ga|qa|ka|ha)$/)
    if (suffixMatch) {
      const stem = suffixMatch[1]
      if (CUSTOMER_STOPWORDS.has(stem) || wordToNumber(stem) !== null) continue
      return stem.charAt(0).toUpperCase() + stem.slice(1)
    }
  }
  return ''
}

// "besh dona buxanka sotdi azizga 15000 so'mga" -> {quantity, product, total, customerName}
export function parseSaleUtterance(transcript, products) {
  const normalized = normalize(transcript)
  const numeralized = numeralize(normalized)

  const product = matchProduct(normalized, products)
  const quantity = findNumberNear(numeralized, ['dona', product ? normalize(product.unit) : '']) ?? findFirstNumber(numeralized)
  const total = findNumberNear(numeralized, ['som', 'sum'])
  const customerName = extractCustomerName(normalized, product?.name)

  return {
    quantity: quantity || '',
    productId: product?.id || '',
    total: total || '',
    customerName,
  }
}

// "yigirma dona buxanka pishirdim" -> {quantity, product}
export function parseProductionUtterance(transcript, products) {
  const normalized = normalize(transcript)
  const numeralized = numeralize(normalized)

  const product = matchProduct(normalized, products)
  const quantity = findNumberNear(numeralized, ['dona', product ? normalize(product.unit) : '']) ?? findFirstNumber(numeralized)

  return {
    quantity: quantity || '',
    productId: product?.id || '',
  }
}

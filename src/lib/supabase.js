import { createClient } from '@supabase/supabase-js'
import { isDemoActive, demoBlockedError, DEMO_ALLOWED_RPCS } from './demoMode'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase sozlamalari topilmadi. .env faylida VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY ni to\'ldiring (.env.example ga qarang).'
  )
}

const client = createClient(supabaseUrl, supabaseAnonKey)

// ── Demo rejimi qo'riqchisi ──────────────────────────────────────────────
// Ilovada 27 ta yozish nuqtasi bor (13 faylda). Har birini alohida
// tekshirish o'rniga klientning o'zi o'raladi — yangi yozish kodi
// qo'shilganda ham u avtomatik qamrab olinadi, dasturchi eslab
// qolishi shart emas.
//
// Bu — qulaylik qatlami, xavfsizlik chegarasi EMAS. Haqiqiy chegara
// bazada: trg_block_demo_writes triggeri demo kompaniyaga tegishli
// har qanday yozishni rad etadi. Ya'ni bu qo'riqchini chetlab o'tgan
// odam ham hech narsa o'zgartira olmaydi — shunchaki xunukroq xato
// ko'radi.

const WRITE_METHODS = new Set(['insert', 'update', 'upsert', 'delete'])

// await qilinadigan VA zanjirlanadigan ({...}.select().eq()) soxta natija.
function demoStub() {
  const stub = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'symbol') return undefined
        if (prop === 'then') {
          return (onFulfilled, onRejected) =>
            Promise.resolve(demoBlockedError()).then(onFulfilled, onRejected)
        }
        if (prop === 'catch') return (fn) => Promise.resolve(demoBlockedError()).catch(fn)
        if (prop === 'finally') return (fn) => Promise.resolve(demoBlockedError()).finally(fn)
        // .select(), .eq(), .single() va h.k. — zanjir uzilmasin
        return () => stub
      },
    }
  )
  return stub
}

function guardQueryBuilder(builder) {
  return new Proxy(builder, {
    get(target, prop) {
      if (typeof prop !== 'symbol' && WRITE_METHODS.has(prop)) {
        return () => demoStub()
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function guardStorage(storage) {
  return new Proxy(storage, {
    get(target, prop) {
      if (prop === 'from') {
        return (bucket) => {
          const bucketApi = target.from(bucket)
          return new Proxy(bucketApi, {
            get(bTarget, bProp) {
              // Fayl yuklash/o'chirish — tashqi ta'sir, demo'da yopiq
              if (bProp === 'upload' || bProp === 'remove' || bProp === 'move') {
                return () => Promise.resolve(demoBlockedError())
              }
              const v = Reflect.get(bTarget, bProp, bTarget)
              return typeof v === 'function' ? v.bind(bTarget) : v
            },
          })
        }
      }
      const value = Reflect.get(target, prop, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export const supabase = new Proxy(client, {
  get(target, prop) {
    if (!isDemoActive() || typeof prop === 'symbol') {
      const passthrough = Reflect.get(target, prop, target)
      return typeof passthrough === 'function' ? passthrough.bind(target) : passthrough
    }

    if (prop === 'from') {
      return (table) => guardQueryBuilder(target.from(table))
    }

    if (prop === 'rpc') {
      return (fn, args, options) =>
        DEMO_ALLOWED_RPCS.has(fn) ? target.rpc(fn, args, options) : demoStub()
    }

    // Edge Functions — AI chaqiruvlari pul turadi va tashqi ta'sir
    // qoldiradi, demo'da butunlay yopiq.
    if (prop === 'functions') {
      return { invoke: () => Promise.resolve(demoBlockedError()) }
    }

    if (prop === 'storage') {
      return guardStorage(target.storage)
    }

    const value = Reflect.get(target, prop, target)
    return typeof value === 'function' ? value.bind(target) : value
  },
})

export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseAnonKey

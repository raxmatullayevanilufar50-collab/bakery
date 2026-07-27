import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase sozlamalari topilmadi. .env faylida VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY ni to\'ldiring (.env.example ga qarang).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const SUPABASE_URL = supabaseUrl
export const SUPABASE_ANON_KEY = supabaseAnonKey

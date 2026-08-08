import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Sidebar'dagi "Narx tavsiyalari" bandiga jonli kutilayotgan tavsiyalar
// sonini ko'rsatish uchun — RLS allaqachon faqat Owner'ga ruxsat beradi,
// boshqa rollarda bu hook doim 0 qaytaradi.
export function usePendingPriceRecommendationsCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      const { data } = await supabase.from('price_recommendations').select('id').eq('status', 'kutilmoqda')
      if (!active) return
      setCount((data || []).length)
    }
    load()

    const channel = supabase
      .channel('pricing-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'price_recommendations' }, load)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  return count
}

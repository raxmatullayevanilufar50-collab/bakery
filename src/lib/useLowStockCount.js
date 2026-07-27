import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Sidebar'dagi "Ombor" bandiga jonli (realtime) kam qolgan xom-ashyo
// sonini ko'rsatish uchun — RLS allaqachon company_id bo'yicha cheklaydi.
export function useLowStockCount() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true

    async function load() {
      const { data } = await supabase.from('inventory_items').select('quantity, low_stock_threshold')
      if (!active) return
      const low = (data || []).filter((item) => Number(item.quantity) <= Number(item.low_stock_threshold)).length
      setCount(low)
    }
    load()

    const channel = supabase
      .channel('low-stock-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, load)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [])

  return count
}

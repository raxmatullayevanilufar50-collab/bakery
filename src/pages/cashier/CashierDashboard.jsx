import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardShell from '../../components/DashboardShell'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { localeTag } from '../../lib/i18n'
import { translateError } from '../../lib/errors'
import POSGrid from '../../components/cashier/POSGrid'
import Receipt from '../../components/cashier/Receipt'
import PreOrderForm from '../../components/orders/PreOrderForm'
import ZReport from '../../components/reports/ZReport'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../components/ui/Toast'
import { todayInTashkent } from '../../lib/businessDay'
import { applyDemoSale, useDemoStore } from '../../lib/demoStore'

function startOfDay() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function CashierDashboard() {
  const { t, i18n } = useTranslation()
  const { profile, company, isDemo } = useAuth()
  const demo = useDemoStore()
  const toast = useToast()
  const [products, setProducts] = useState([])
  const [baseSales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [baseInventory, setInventory] = useState({})
  const [cart, setCart] = useState([])
  const [receipt, setReceipt] = useState(null)
  const [preOrderOpen, setPreOrderOpen] = useState(false)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [zReport, setZReport] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: productRows }, { data: saleRows }, { data: inventoryRows }] = await Promise.all([
      supabase.from('products').select('id, name, unit, price, image_url, category, sell_by_weight, is_available').order('name'),
      supabase
        .from('sales')
        .select('id, quantity, unit_price, total, created_at, receipt_id, products(name, unit)')
        .eq('cashier_id', profile.id)
        .gte('created_at', startOfDay().toISOString())
        .order('created_at', { ascending: false }),
      supabase.from('display_inventory').select('product_id, quantity_available'),
    ])
    setProducts(productRows || [])
    setSales(saleRows || [])
    setInventory(Object.fromEntries((inventoryRows || []).map((row) => [row.product_id, Number(row.quantity_available)])))
    setLoading(false)
  }, [profile.id])

  useEffect(() => {
    load()
  }, [load])

  // Demo rejimidagi o'zgarishlar bazadan kelgan ma'lumot ustiga
  // qo'shiladi. Nonvoy panelida pishirilgan mahsulot shu yerda
  // vitrinada ko'payib turadi — zanjir ekranlar orasida uzilmaydi.
  const inventory = useMemo(() => {
    if (!isDemo) return baseInventory
    const merged = { ...baseInventory }
    for (const [productId, delta] of Object.entries(demo.displayDelta)) {
      merged[productId] = (merged[productId] || 0) + delta
    }
    return merged
  }, [isDemo, baseInventory, demo.displayDelta])

  const sales = useMemo(
    () => (isDemo ? [...demo.sales, ...baseSales] : baseSales),
    [isDemo, demo.sales, baseSales]
  )

  useEffect(() => {
    const channel = supabase.channel('cashier-display-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'display_inventory', filter: `company_id=eq.${profile.company_id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load, profile.company_id])

  function addToCart(product, quantity) {
    setCart((items) => {
      const existing = items.find((item) => item.product.id === product.id)
      if (existing) return items.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item)
      return [...items, { product, quantity }]
    })
  }
  function changeQuantity(productId, delta) {
    setCart((items) => items.map((item) => item.product.id === productId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter((item) => item.quantity > 0))
  }
  async function recordSale() {
    setError('')
    if (!cart.length) {
      setError(t('cashier.missingFields'))
      return
    }
    setSaving(true)
    // Savatdagi har bir mahsulot alohida `sales` qatori bo'ladi, lekin
    // hammasi bitta chek. Umumiy receipt_id chek raqami bo'lib xizmat
    // qiladi va kunlik hisobotda tranzaksiyalarni to'g'ri sanashga imkon
    // beradi (20260808110000 migratsiyasi).
    const receiptId = crypto.randomUUID()
    const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)

    // Demo rejimi: savdo bazaga yozilmaydi, lekin ekranda to'liq
    // ishlagandek ko'rinadi — chek chiqadi, vitrina kamayadi, kunlik
    // ro'yxatga tushadi. Sahifa yangilanganda hammasi boshlang'ich
    // holatiga qaytadi.
    if (isDemo) {
      applyDemoSale({
        displayDelta: Object.fromEntries(cart.map((item) => [item.product.id, -item.quantity])),
        sales: cart.map((item) => ({
          id: `demo-${receiptId}-${item.product.id}`,
          quantity: item.quantity,
          unit_price: item.product.price,
          total: item.product.price * item.quantity,
          created_at: new Date().toISOString(),
          receipt_id: receiptId,
          products: { name: item.product.name, unit: item.product.unit },
        })),
      })
      setReceipt({
        items: cart,
        total: cartTotal,
        number: receiptId,
        createdAt: new Date().toISOString(),
        cashierName: profile.full_name,
        companyName: company?.name,
        companyAddress: company?.address,
      })
      setCart([])
      toast.success(t('pos.saleSuccess'))
      setSaving(false)
      return
    }

    const rows = cart.map((item) => ({ company_id: profile.company_id, cashier_id: profile.id, product_id: item.product.id, quantity: item.quantity, unit_price: item.product.price, total: item.product.price * item.quantity, receipt_id: receiptId }))
    const { error: insertError } = await supabase.from('sales').insert(rows)
    if (insertError) setError(translateError(t, insertError))
    else {
      // Vitrina hisobini serverdagi trigger kamaytiradi
      // (trg_sale_display_inventory_impact, 20260809091000) — bu yerda
      // qo'lda kamaytirilsa, ikki marta ayirilardi. Trigger atomik
      // ishlaydi, shuning uchun ikkita kassir bir vaqtda sotsa ham
      // hisob adashmaydi.
      setReceipt({
        items: cart,
        total: cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
        number: receiptId,
        createdAt: new Date().toISOString(),
        cashierName: profile.full_name,
        companyName: company?.name,
        companyAddress: company?.address,
      })
      setCart([])
      toast.success(t('pos.saleSuccess'))
    }
    setSaving(false)
    load()
  }

  // Smena oxirida kunni yopish. Hisobot butun kompaniya bo'yicha (boshqa
  // kassir savdosi ham kiradi) — serverdagi close_day() RPC hisoblaydi.
  async function closeDay() {
    setCloseConfirmOpen(false)
    setError('')
    setClosing(true)

    // Demo rejimi: hisobot ekrandagi bugungi savdolardan hisoblanadi.
    if (isDemo) {
      const byProduct = new Map()
      for (const s of sales) {
        const nom = s.products?.name || '—'
        const oldRow = byProduct.get(nom) || { product_name: nom, unit: s.products?.unit, quantity: 0, total: 0 }
        oldRow.quantity += Number(s.quantity)
        oldRow.total += Number(s.total)
        byProduct.set(nom, oldRow)
      }
      setClosing(false)
      setZReport({
        report_date: todayInTashkent(),
        total_sales: sales.reduce((sum, s) => sum + Number(s.total), 0),
        transaction_count: new Set(sales.map((s) => s.receipt_id || s.id)).size,
        item_count: sales.reduce((sum, s) => sum + Number(s.quantity), 0),
        product_breakdown: [...byProduct.values()].sort((a, b) => b.total - a.total),
        closed_at: new Date().toISOString(),
      })
      toast.success(t('dailyClose.closed'))
      return
    }

    const { data, error: rpcError } = await supabase.rpc('close_day', { p_date: todayInTashkent() })
    setClosing(false)
    if (rpcError) {
      setError(translateError(t, rpcError))
      return
    }
    setZReport(data)
    toast.success(t('dailyClose.closed'))
  }

  const todayTotal = sales.reduce((sum, s) => sum + Number(s.total), 0)

  return (
    <DashboardShell
      navGroups={[{ title: t('navGroups.main'), items: [{ key: 'kassa', label: t('nav.kassa'), icon: 'cash' }] }]}
      active="kassa"
      onNavigate={() => {}}
      title={t('cashier.title')}
    >
      <div className="flex flex-col gap-6">
        {preOrderOpen ? <PreOrderForm products={products} onSaved={() => { setPreOrderOpen(false); toast.success(t('preOrder.created')) }} onCancel={() => setPreOrderOpen(false)} /> : <POSGrid products={products} inventory={inventory} cart={cart} onAdd={addToCart} onRemove={(id) => setCart((items) => items.filter((item) => item.product.id !== id))} onChangeQuantity={changeQuantity} onSell={recordSale} onClear={() => setCart([])} onPreOrder={() => setPreOrderOpen(true)} saving={saving} />}
        {error && <p className="text-sm text-bad font-semibold">{error}</p>}

        <div className="card p-4 flex flex-col items-center gap-3">
          <div className="text-center">
            <p className="text-2xl font-black text-brown-dark">
              {todayTotal.toLocaleString(localeTag(i18n.language))} {t('common.currency')}
            </p>
            <p className="text-sm text-ink-muted font-semibold">{t('cashier.todayBalance')}</p>
          </div>
          <button
            type="button"
            onClick={() => setCloseConfirmOpen(true)}
            disabled={closing}
            className="btn-secondary h-12 w-full max-w-xs"
          >
            🧾 {closing ? t('common.saving') : t('dailyClose.button')}
          </button>
        </div>
        {receipt && <Receipt receipt={receipt} onClose={() => setReceipt(null)} />}
        {closeConfirmOpen && (
          <ConfirmDialog
            title={t('dailyClose.button')}
            message={t('dailyClose.confirmMessage')}
            onConfirm={closeDay}
            onCancel={() => setCloseConfirmOpen(false)}
          />
        )}
        {zReport && (
          <ZReport
            report={zReport}
            companyName={company?.name}
            closedByName={profile.full_name}
            onClose={() => setZReport(null)}
          />
        )}

        <div className="flex flex-col gap-2">
          <h2 className="font-extrabold text-brown-dark">{t('cashier.myTodaySales')}</h2>
          {loading && <p className="text-ink-muted font-semibold">{t('common.loading')}</p>}
          {!loading && sales.length === 0 && <p className="text-ink-muted font-semibold">{t('cashier.noSales')}</p>}
          {sales.map((sale) => (
            <div key={sale.id} className="card p-3 flex items-center justify-between text-sm">
              <span className="text-ink font-semibold">
                {sale.products?.name} × {sale.quantity}
              </span>
              <span className="font-bold text-brown-dark">
                {Number(sale.total).toLocaleString(localeTag(i18n.language))} {t('common.currency')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}

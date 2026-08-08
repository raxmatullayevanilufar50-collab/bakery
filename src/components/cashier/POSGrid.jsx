import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Icon from '../ui/Icon'
import { localeTag } from '../../lib/i18n'

const CATEGORIES = ['non', 'pishiriq', 'tort', 'shirinlik', 'ichimlik', 'boshqa']

export default function POSGrid({ products, inventory, cart, onAdd, onRemove, onChangeQuantity, onSell, onClear, onPreOrder, saving }) {
  const { t, i18n } = useTranslation()
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [weightProduct, setWeightProduct] = useState(null)
  const [weight, setWeight] = useState('')
  const visibleProducts = useMemo(() => products.filter((product) => product.is_available !== false && (category === 'all' || product.category === category) && product.name.toLowerCase().includes(search.toLowerCase())), [products, category, search])
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  function choose(product) {
    if ((inventory[product.id] || 0) <= 0) return
    if (product.sell_by_weight) { setWeightProduct(product); setWeight(''); return }
    onAdd(product, 1)
    navigator.vibrate?.(50)
  }
  function addWeight() {
    const amount = Number(weight)
    if (amount > 0) onAdd(weightProduct, amount)
    setWeightProduct(null)
  }
  return <div className="flex flex-col gap-4">
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button type="button" className={`px-4 py-2 rounded-full font-bold whitespace-nowrap ${category === 'all' ? 'bg-orange text-white' : 'bg-orange-pale text-brown'}`} onClick={() => setCategory('all')}>{t('pos.all')}</button>
      {CATEGORIES.map((item) => <button type="button" key={item} className={`px-4 py-2 rounded-full font-bold whitespace-nowrap ${category === item ? 'bg-orange text-white' : 'bg-orange-pale text-brown'}`} onClick={() => setCategory(item)}>{t(`categories.${item}`)}</button>)}
    </div>
    <label className="relative"><Icon name="search" className="absolute left-3 top-3 text-ink-muted" /><input className="input pl-10 w-full" aria-label={t('pos.search')} placeholder={t('pos.search')} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {visibleProducts.map((product) => {
        const available = Number(inventory[product.id] || 0)
        return <button key={product.id} type="button" disabled={available <= 0} onClick={() => choose(product)} className="card p-3 text-left active:scale-95 transition disabled:opacity-60">
          {product.image_url ? <img src={product.image_url} alt="" className="w-full aspect-square object-cover rounded-xl mb-2" /> : <div className="w-full aspect-square rounded-xl bg-orange-pale flex items-center justify-center text-4xl mb-2">🍞</div>}
          <p className="font-extrabold text-brown-dark truncate">{product.name}</p>
          <p className="font-bold text-orange">{Number(product.price).toLocaleString(localeTag(i18n.language))} {t('common.currency')}</p>
          {available > 0 ? <p className={`text-xs font-bold ${available > 5 ? 'text-good' : 'text-orange'}`}>{t('pos.available')}: {available}</p> : <span className="inline-block bg-bad text-white text-xs font-bold rounded-full px-2 py-0.5">{t('pos.soldOut')}</span>}
        </button>
      })}
    </div>
    <div className="card p-4 sticky bottom-2">
      <h2 className="font-extrabold text-brown-dark mb-2">{t('pos.cart')}</h2>
      {cart.length === 0 && <p className="text-sm text-ink-muted">{t('pos.cartEmpty')}</p>}
      {cart.map((item) => <div key={item.product.id} className="flex items-center gap-2 py-2 border-b border-brown/10">
        <span className="flex-1 font-semibold truncate">{item.product.name}</span><button type="button" aria-label={t('common.remove')} onClick={() => onRemove(item.product.id)}><Icon name="x" /></button>
        <button type="button" aria-label={t('common.remove')} onClick={() => onChangeQuantity(item.product.id, -1)}><Icon name="minus" size={16} /></button><span className="font-bold w-10 text-center">{item.quantity}</span><button type="button" aria-label={t('common.add')} onClick={() => onChangeQuantity(item.product.id, 1)}><Icon name="plus" size={16} /></button>
        <span className="font-bold w-24 text-right">{(item.product.price * item.quantity).toLocaleString(localeTag(i18n.language))}</span>
      </div>)}
      <div className="flex items-center justify-between py-4"><span className="font-extrabold">{t('pos.total')}</span><span className="text-xl font-black text-brown-dark">{total.toLocaleString(localeTag(i18n.language))} {t('common.currency')}</span></div>
      <div className="grid grid-cols-3 gap-2"><button type="button" disabled={!cart.length || saving} onClick={onSell} className="btn-primary h-12">{t('pos.sell')}</button><button type="button" onClick={onClear} className="btn-secondary h-12">{t('pos.clear')}</button><button type="button" onClick={onPreOrder} className="btn-secondary h-12 text-xs">{t('pos.preOrder')}</button></div>
    </div>
    {weightProduct && <div className="fixed inset-0 bg-black/50 z-[150] flex items-center justify-center p-4"><div className="card p-5 w-full max-w-sm"><h2 className="font-extrabold mb-3">{t('pos.enterWeight')}</h2><input autoFocus className="input w-full" type="number" min="0.01" step="0.01" aria-label={t('pos.weightInput')} value={weight} onChange={(event) => setWeight(event.target.value)} /><button type="button" className="btn-primary w-full mt-3" onClick={addWeight}>{t('common.add')}</button></div></div>}
  </div>
}

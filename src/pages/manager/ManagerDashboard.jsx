import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardShell from '../../components/DashboardShell'
import ScheduleTab from '../../features/ScheduleTab'
import ProductionTab from '../../features/ProductionTab'
import InventoryTab from '../../features/InventoryTab'
import OrdersTab from '../../features/OrdersTab'
import SalesTab from '../../features/SalesTab'
import ReportsTab from '../../features/ReportsTab'
import ForecastTab from '../../features/ForecastTab'
import { useLowStockCount } from '../../lib/useLowStockCount'
import DisplayInventory from '../../components/inventory/DisplayInventory'

// Diqqat: PricingTab shu yerga qo'shilmagan — narx tavsiyalari (tannarx,
// marja) moliyaviy ma'lumot hisoblanadi va faqat Owner'ga ochiq
// (price_recommendations RLS'iga mos, 20260729090200_ingredient_cost_pricing.sql).
const PANELS = {
  schedule: ScheduleTab,
  production: ProductionTab,
  inventory: InventoryTab,
  orders: OrdersTab,
  sales: SalesTab,
  reports: ReportsTab,
  forecast: ForecastTab,
  display: DisplayInventory,
}

export default function ManagerDashboard() {
  const { t } = useTranslation()
  const [active, setActive] = useState('schedule')
  const Panel = PANELS[active]
  const lowStockCount = useLowStockCount()

  const navGroups = [
    {
      title: t('navGroups.operations'),
      items: [
        { key: 'schedule', label: t('nav.schedule'), icon: 'calendar' },
        { key: 'production', label: t('nav.production'), icon: 'bread' },
        { key: 'inventory', label: t('nav.inventory'), icon: 'warehouse', badge: lowStockCount },
        { key: 'orders', label: t('nav.orders'), icon: 'truck' },
        { key: 'sales', label: t('nav.sales'), icon: 'cash' },
        { key: 'display', label: t('nav.display'), icon: 'bread' },
      ],
    },
    { title: t('navGroups.finance'), items: [{ key: 'reports', label: t('nav.reports'), icon: 'chart' }] },
    { title: t('navGroups.ai'), items: [{ key: 'forecast', label: t('nav.forecast'), icon: 'star' }] },
  ]

  const titles = {
    schedule: t('nav.schedule'),
    production: t('nav.production'),
    inventory: t('nav.inventory'),
    orders: t('nav.orders'),
    sales: t('nav.sales'),
    reports: t('nav.reports'),
    forecast: t('nav.forecast'),
    display: t('nav.display'),
  }

  return (
    <DashboardShell navGroups={navGroups} active={active} onNavigate={setActive} title={titles[active]}>
      <Panel />
    </DashboardShell>
  )
}

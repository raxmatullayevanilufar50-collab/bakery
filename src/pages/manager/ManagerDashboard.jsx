import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardShell from '../../components/DashboardShell'
import ScheduleTab from '../../features/ScheduleTab'
import ProductionTab from '../../features/ProductionTab'
import InventoryTab from '../../features/InventoryTab'
import OrdersTab from '../../features/OrdersTab'
import SalesTab from '../../features/SalesTab'
import ReportsTab from '../../features/ReportsTab'
import { useLowStockCount } from '../../lib/useLowStockCount'

const PANELS = {
  schedule: ScheduleTab,
  production: ProductionTab,
  inventory: InventoryTab,
  orders: OrdersTab,
  sales: SalesTab,
  reports: ReportsTab,
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
        { key: 'schedule', label: t('nav.schedule'), icon: '📅' },
        { key: 'production', label: t('nav.production'), icon: '🥖' },
        { key: 'inventory', label: t('nav.inventory'), icon: '🌾', badge: lowStockCount },
        { key: 'orders', label: t('nav.orders'), icon: '🚚' },
        { key: 'sales', label: t('nav.sales'), icon: '💰' },
      ],
    },
    { title: t('navGroups.finance'), items: [{ key: 'reports', label: t('nav.reports'), icon: '📊' }] },
  ]

  const titles = {
    schedule: t('nav.schedule'),
    production: t('nav.production'),
    inventory: t('nav.inventory'),
    orders: t('nav.orders'),
    sales: t('nav.sales'),
    reports: t('nav.reports'),
  }

  return (
    <DashboardShell navGroups={navGroups} active={active} onNavigate={setActive} title={titles[active]}>
      <Panel />
    </DashboardShell>
  )
}

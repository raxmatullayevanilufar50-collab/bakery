import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DashboardShell from '../../components/DashboardShell'
import EmployeesTab from '../../features/EmployeesTab'
import ScheduleTab from '../../features/ScheduleTab'
import ProductionTab from '../../features/ProductionTab'
import InventoryTab from '../../features/InventoryTab'
import OrdersTab from '../../features/OrdersTab'
import SalesTab from '../../features/SalesTab'
import ReportsTab from '../../features/ReportsTab'
import DailyCloseTab from '../../features/DailyCloseTab'
import SecurityTab from '../../features/SecurityTab'
import ForecastTab from '../../features/ForecastTab'
import PricingTab from '../../features/PricingTab'
import { useLowStockCount } from '../../lib/useLowStockCount'
import { usePendingPriceRecommendationsCount } from '../../lib/usePendingPriceRecommendationsCount'

const PANELS = {
  employees: EmployeesTab,
  schedule: ScheduleTab,
  production: ProductionTab,
  inventory: InventoryTab,
  orders: OrdersTab,
  sales: SalesTab,
  reports: ReportsTab,
  dailyClose: DailyCloseTab,
  security: SecurityTab,
  forecast: ForecastTab,
  pricing: PricingTab,
}

export default function OwnerDashboard() {
  const { t } = useTranslation()
  const [active, setActive] = useState('employees')
  const Panel = PANELS[active]
  const lowStockCount = useLowStockCount()
  const pendingRecCount = usePendingPriceRecommendationsCount()

  const navGroups = [
    { title: t('navGroups.management'), items: [{ key: 'employees', label: t('nav.employees'), icon: 'users' }] },
    {
      title: t('navGroups.operations'),
      items: [
        { key: 'schedule', label: t('nav.schedule'), icon: 'calendar' },
        { key: 'production', label: t('nav.production'), icon: 'bread' },
        { key: 'inventory', label: t('nav.inventory'), icon: 'warehouse', badge: lowStockCount },
        { key: 'orders', label: t('nav.orders'), icon: 'truck' },
        { key: 'sales', label: t('nav.sales'), icon: 'cash' },
      ],
    },
    {
      title: t('navGroups.finance'),
      items: [
        { key: 'reports', label: t('nav.reports'), icon: 'chart' },
        { key: 'dailyClose', label: t('nav.dailyClose'), icon: 'cash' },
      ],
    },
    {
      title: t('navGroups.ai'),
      items: [
        { key: 'forecast', label: t('nav.forecast'), icon: 'star' },
        { key: 'pricing', label: t('nav.pricing'), icon: 'settings', badge: pendingRecCount },
      ],
    },
    { title: t('navGroups.security'), items: [{ key: 'security', label: t('nav.security'), icon: 'lock' }] },
  ]

  const titles = {
    employees: t('nav.employees'),
    schedule: t('nav.schedule'),
    production: t('nav.production'),
    inventory: t('nav.inventory'),
    orders: t('nav.orders'),
    sales: t('nav.sales'),
    reports: t('nav.reports'),
    dailyClose: t('nav.dailyClose'),
    security: t('navGroups.security'),
    forecast: t('nav.forecast'),
    pricing: t('nav.pricing'),
  }

  return (
    <DashboardShell navGroups={navGroups} active={active} onNavigate={setActive} title={titles[active]}>
      <Panel />
    </DashboardShell>
  )
}

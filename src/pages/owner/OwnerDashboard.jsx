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
import SecurityTab from '../../features/SecurityTab'
import { useLowStockCount } from '../../lib/useLowStockCount'

const PANELS = {
  employees: EmployeesTab,
  schedule: ScheduleTab,
  production: ProductionTab,
  inventory: InventoryTab,
  orders: OrdersTab,
  sales: SalesTab,
  reports: ReportsTab,
  security: SecurityTab,
}

export default function OwnerDashboard() {
  const { t } = useTranslation()
  const [active, setActive] = useState('employees')
  const Panel = PANELS[active]
  const lowStockCount = useLowStockCount()

  const navGroups = [
    { title: t('navGroups.management'), items: [{ key: 'employees', label: t('nav.employees'), icon: '👥' }] },
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
    { title: t('navGroups.security'), items: [{ key: 'security', label: t('nav.security'), icon: '🛡️' }] },
  ]

  const titles = {
    employees: t('nav.employees'),
    schedule: t('nav.schedule'),
    production: t('nav.production'),
    inventory: t('nav.inventory'),
    orders: t('nav.orders'),
    sales: t('nav.sales'),
    reports: t('nav.reports'),
    security: t('navGroups.security'),
  }

  return (
    <DashboardShell navGroups={navGroups} active={active} onNavigate={setActive} title={titles[active]}>
      <Panel />
    </DashboardShell>
  )
}

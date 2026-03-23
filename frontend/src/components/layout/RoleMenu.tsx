import { useAuth } from '../../hooks/useAuth'
import { formatRole } from '../../utils/format'

function RoleMenu() {
  const { currentUser } = useAuth()

  if (!currentUser) {
    return null
  }

  return (
    <div className="min-w-0 max-w-[132px] text-right sm:max-w-[180px]">
      <p className="truncate text-xs font-semibold text-ink-950 sm:text-sm">
        {currentUser.fullName}
      </p>
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-600 sm:text-xs sm:tracking-[0.18em]">
        {formatRole(currentUser.role)}
      </p>
    </div>
  )
}

export default RoleMenu

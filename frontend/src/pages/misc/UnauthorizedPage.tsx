import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

import EmptyState from '../../components/common/EmptyState'
import { routes } from '../../constants/routes'

function UnauthorizedPage() {
  return (
    <div className="min-h-screen px-4 py-10 md:px-6">
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={ShieldAlert}
          title="You do not have access to this area."
          description="Your current role is authenticated, but it is not allowed to open the requested route."
          action={
            <Link
              to={routes.dashboard}
              className="inline-flex items-center gap-2 rounded-2xl bg-ink-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-ink-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Return to dashboard
            </Link>
          }
        />
      </div>
    </div>
  )
}

export default UnauthorizedPage

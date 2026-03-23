import { ArrowLeft, Search } from 'lucide-react'
import { Link } from 'react-router-dom'

import EmptyState from '../../components/common/EmptyState'
import { routes } from '../../constants/routes'

function NotFoundPage() {
  return (
    <div className="min-h-screen px-4 py-10 md:px-6">
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={Search}
          title="This page could not be found."
          description="The route exists neither in the current auth shell nor in the public area yet."
          action={
            <Link
              to={routes.login}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink-800 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          }
        />
      </div>
    </div>
  )
}

export default NotFoundPage

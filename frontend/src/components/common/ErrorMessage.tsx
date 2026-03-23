import { AlertCircle } from 'lucide-react'

interface ErrorMessageProps {
  message: string
}

function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="rounded-2xl border border-danger-500/20 bg-danger-500/8 px-4 py-3 text-sm text-danger-500">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{message}</p>
      </div>
    </div>
  )
}

export default ErrorMessage

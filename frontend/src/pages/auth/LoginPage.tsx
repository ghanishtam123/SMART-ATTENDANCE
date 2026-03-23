import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import ErrorMessage from '../../components/common/ErrorMessage'
import InputField from '../../components/forms/InputField'
import FormActions from '../../components/forms/FormActions'
import { useAuth } from '../../hooks/useAuth'
import { getErrorMessage } from '../../utils/format'
import { getDashboardRouteForRole } from '../../utils/role'

const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long.'),
})

type LoginFormValues = z.infer<typeof loginSchema>

function LoginPage() {
  const navigate = useNavigate()
  const { login, loading } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)

    try {
      const user = await login(values)
      navigate(getDashboardRouteForRole(user.role), { replace: true })
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'Unable to sign in.'))
    }
  })

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.22em] text-brand-700 ring-1 ring-brand-100">
          <ShieldCheck className="h-4 w-4" />
          Login
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-ink-950">
            Sign in to continue
          </h2>
          <p className="text-sm leading-6 text-ink-600">
            Use your backend-issued credentials. Access is automatically routed by
            role after authentication.
          </p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={onSubmit}>
        <InputField
          label="Email address"
          type="email"
          placeholder="admin@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <InputField
          label="Password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        {submitError ? <ErrorMessage message={submitError} /> : null}

        <FormActions
          submitLabel="Sign In"
          loadingLabel="Signing you in..."
          isSubmitting={isSubmitting || loading}
        />
      </form>
    </div>
  )
}

export default LoginPage

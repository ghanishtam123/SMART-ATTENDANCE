import { ShieldCheck } from 'lucide-react'
import { Outlet } from 'react-router-dom'

import heroImg from '../assets/hero.png'

function AuthLayout() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="app-surface relative hidden overflow-hidden p-8 lg:flex lg:flex-col lg:justify-between">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 ring-1 ring-brand-100">
              <ShieldCheck className="h-4 w-4" />
              AI-Powered Smart Classroom
            </div>
            <div className="space-y-4">
              <p className="font-mono text-xs uppercase tracking-[0.36em] text-brand-600">
                Secure Access
              </p>
              <h1 className="text-balance max-w-xl text-5xl font-semibold leading-tight tracking-tight text-ink-950">
                Attendance, monitoring, and role-based operations in one place.
              </h1>
              <p className="max-w-xl text-lg leading-8 text-ink-600">
                Sign in to manage classrooms, review attendance analytics, monitor live
                sessions, or access the student portal through the same backend-driven
                authentication flow.
              </p>
            </div>
          </div>
          <div className="relative mx-auto flex w-full max-w-xl items-center justify-center">
            <div className="absolute inset-x-10 bottom-8 top-10 rounded-[32px] bg-gradient-to-br from-brand-100 via-white to-amber-100 blur-3xl" />
            <img
              src={heroImg}
              alt="Smart classroom dashboard illustration"
              className="relative max-h-[420px] w-full object-contain"
            />
          </div>
        </section>

        <section className="app-surface flex items-center justify-center px-4 py-8 md:px-8">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  )
}

export default AuthLayout

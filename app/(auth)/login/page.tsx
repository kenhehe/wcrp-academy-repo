import LoginForm from '@/components/auth/LoginForm'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">WCRP Events Repository</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>
        <div className="rounded-lg border bg-background p-6 shadow-sm">
          <LoginForm />
        </div>
      </div>
    </div>
  )
}

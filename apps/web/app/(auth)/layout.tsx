export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-deep/15 via-terra/8 to-amber/12" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  );
}

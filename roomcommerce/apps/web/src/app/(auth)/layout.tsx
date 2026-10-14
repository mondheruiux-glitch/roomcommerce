import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in with a passwordless magic link or social OAuth to access your design studio.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-canvas px-4">
      <div className="w-full max-w-md">
        {/* Logo wordmark */}
        <div className="text-center mb-8">
          <span className="text-2xl font-extrabold text-brand-terracotta tracking-tight">
            RoomCommerce
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

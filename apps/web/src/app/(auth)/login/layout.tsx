import { Suspense } from 'react';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="min-h-screen pt-20 flex justify-center"><div className="w-full max-w-md h-80 glass-card animate-pulse rounded-2xl" /></div>}>{children}</Suspense>;
}

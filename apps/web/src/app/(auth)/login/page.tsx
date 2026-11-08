'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api, getApiError } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { blurReveal } from '@/lib/motion/variants';

// Demo credentials are a development convenience only. They are never rendered in a
// production build unless NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true is set deliberately
// (for example on a throw-away demo deployment that is seeded with those accounts).
const SHOW_DEMO_CREDENTIALS =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/account';
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      setAuth(res.data.data.user);
      const role = res.data.data.user.role;
      if (role === 'admin' || role === 'super_admin') router.push('/admin');
      else if (role === 'vendor') router.push('/vendor');
      else router.push(redirect.startsWith('/') ? redirect : '/account');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20">
      <motion.div variants={blurReveal} initial="hidden" animate="visible" className="w-full max-w-md glass-card p-8">
        <h1 className="font-display text-3xl font-bold mb-2">Welcome back</h1>
        <p className="text-muted-foreground mb-8">Sign in to your Nexus account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">{error}</div>}
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full glass rounded-xl px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-primary hover:underline">Create one</Link>
        </p>
        {SHOW_DEMO_CREDENTIALS && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Demo: customer@demo.com / Customer@123
          </p>
        )}
      </motion.div>
    </div>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User, LogOut, ShoppingBag, Heart, Settings, ChevronDown } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { logoutUser } from '@/lib/auth-actions';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutUser();
    setOpen(false);
    router.push('/');
    setLoggingOut(false);
  };

  if (!isAuthenticated || !user) {
    return (
      <Link href="/login">
        <Button variant="ghost" size="icon" aria-label="Account">
          <User className="h-4 w-4" />
        </Button>
      </Link>
    );
  }

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'U';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full glass px-2 py-1.5 pr-3 hover:bg-white/10 transition-colors"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/30 text-xs font-bold text-primary">
          {initials}
        </span>
        <span className="hidden md:inline text-sm font-medium max-w-[100px] truncate">
          {user.firstName}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 top-full mt-2 w-56 glass-card p-2 shadow-xl z-[60]"
            role="menu"
          >
            <div className="px-3 py-2 border-b border-white/10 mb-1">
              <p className="font-medium text-sm truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
              role="menuitem"
            >
              <User className="h-4 w-4 text-primary" /> Profile
            </Link>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
              role="menuitem"
            >
              <ShoppingBag className="h-4 w-4" /> Cart
            </Link>
            <Link
              href="/wishlist"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
              role="menuitem"
            >
              <Heart className="h-4 w-4" /> Wishlist
            </Link>
            <Link
              href="/account?tab=settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-white/10 transition-colors"
              role="menuitem"
            >
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <div className="border-t border-white/10 mt-1 pt-1">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" />
                {loggingOut ? 'Signing out...' : 'Log out'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

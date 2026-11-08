'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShoppingBag, Search, Heart, Menu } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { useCartStore } from '@/store/cart.store';
import { useWishlistStore } from '@/store/wishlist.store';
import { Button } from '@/components/ui/button';
import { SearchOverlay } from '@/components/layout/SearchOverlay';
import { UserMenu } from '@/components/layout/UserMenu';

const navLinks = [
  { href: '/shop', label: 'Shop' },
  { href: '/collections', label: 'Collections' },
  { href: '/about', label: 'About' },
];

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { isAuthenticated, user } = useAuthStore();
  const itemCount = useCartStore((s) => s.itemCount);
  const wishlistCount = useWishlistStore((s) => s.items.length);

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed top-0 left-0 right-0 z-50 px-4 py-4 md:px-8"
    >
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-2xl px-6 py-3">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight" data-cursor="pointer">
          Nexus<span className="text-primary">.</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              data-cursor="pointer"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <motion.div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            data-cursor="pointer"
            aria-label="Search"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
          <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
          <Link href="/wishlist" className="relative">
            <Button variant="ghost" size="icon" data-cursor="pointer" aria-label="Wishlist">
              <Heart className="h-4 w-4" />
            </Button>
            {wishlistCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {wishlistCount}
              </span>
            )}
          </Link>
          <Link href="/cart" className="relative">
            <Button variant="ghost" size="icon" data-cursor="pointer" aria-label="Cart">
              <ShoppingBag className="h-4 w-4" />
            </Button>
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </Link>
          <UserMenu />
          {!isAuthenticated && (
            <Link href="/login" className="hidden md:block">
              <Button size="sm">Sign In</Button>
            </Link>
          )}
          {user?.role === 'admin' || user?.role === 'super_admin' ? (
            <Link href="/admin" className="hidden md:block">
              <Button variant="outline" size="sm">Admin</Button>
            </Link>
          ) : null}
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
            <Menu className="h-4 w-4" />
          </Button>
        </motion.div>
      </nav>
    </motion.header>
  );
}

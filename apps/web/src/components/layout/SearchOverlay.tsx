'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    onClose();
    router.push(`/shop?search=${encodeURIComponent(q)}`);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-24 left-1/2 z-[101] w-full max-w-2xl -translate-x-1/2 px-4"
          >
            <form onSubmit={handleSubmit} className="glass rounded-2xl p-2 flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground ml-3 flex-shrink-0" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, brands, categories..."
                className="flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
                aria-label="Search products"
              />
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close search">
                <X className="h-4 w-4" />
              </Button>
              <Button type="submit" size="sm" className="mr-1">
                Search
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground mt-3">
              Press Enter to search · Esc to close
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

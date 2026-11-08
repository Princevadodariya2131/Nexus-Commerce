'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Heart, Trash2 } from 'lucide-react';
import { useWishlistStore } from '@/store/wishlist.store';
import { formatPrice } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400';

export default function WishlistPage() {
  const { items, remove } = useWishlistStore();

  return (
    <div className="min-h-screen pt-28 pb-16 px-4 md:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="font-display text-4xl font-bold mb-8 flex items-center gap-3">
          <Heart className="h-8 w-8 text-primary" />
          Wishlist ({items.length})
        </h1>

        {items.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted-foreground mb-4">Your wishlist is empty</p>
            <Link href="/shop">
              <Button>Explore Shop</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((product) => (
              <motion.div
                key={product.id}
                layout
                className="glass-card p-4 flex gap-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Link href={`/shop/${product.slug}`} className="relative h-24 w-24 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={product.images[0]?.url || PLACEHOLDER}
                    alt={product.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </Link>
                <div className="flex-1 min-w-0">
                  <Link href={`/shop/${product.slug}`}>
                    <h3 className="font-medium truncate hover:text-primary transition-colors">{product.name}</h3>
                  </Link>
                  {product.category && (
                    <p className="text-xs text-muted-foreground mt-0.5">{product.category.name}</p>
                  )}
                  <p className="font-semibold mt-2">{formatPrice(product.price)}</p>
                  <Link href={`/shop/${product.slug}`} className="inline-block mt-2">
                    <Button size="sm" variant="secondary">View Product</Button>
                  </Link>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0"
                  onClick={() => remove(product.id)}
                  aria-label="Remove from wishlist"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

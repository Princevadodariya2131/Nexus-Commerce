'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import {
  ShoppingBag,
  Heart,
  Star,
  ChevronLeft,
  ChevronRight,
  Check,
  Minus,
  Plus,
  Share2,
  Package,
  Shield,
  Truck,
  RotateCcw,
} from 'lucide-react';
import axios from 'axios';
import { api, getApiError } from '@/lib/api';
import { fetchProductBySlug, fetchRelatedProducts } from '@/lib/products';
import { formatPrice, formatRating, toNumber } from '@/lib/utils';
import { useCartStore } from '@/store/cart.store';
import { useAuthStore } from '@/store/auth.store';
import { useWishlistStore } from '@/store/wishlist.store';
import { Button } from '@/components/ui/button';
import { fadeUp, staggerContainer, blurReveal } from '@/lib/motion/variants';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductImage {
  url: string;
  isPrimary?: boolean;
  alt?: string;
}

interface ProductVariant {
  name: string;
  options: string[];
}

interface Product {
  _id: string;
  id: number;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  images: ProductImage[];
  rating: number;
  reviewCount: number;
  stock: number;
  brand?: string;
  sku: string;
  variants?: ProductVariant[] | null;
  tags?: string[];
  category?: { name: string; slug: string };
  vendor?: { businessName: string; slug: string; logo?: string; rating: number };
  soldCount: number;
}

interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  user: { firstName: string; lastName: string; avatar?: string };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StarRating({ rating, size = 14 }: { rating: unknown; size?: number }) {
  const value = toNumber(rating);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-white/20'}
        />
      ))}
    </div>
  );
}

function ImageGallery({ images }: { images: ProductImage[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const safeImages = images?.length ? images : [{ url: '/placeholder.jpg' }];

  const prev = useCallback(() =>
    setActiveIdx((i) => (i - 1 + safeImages.length) % safeImages.length), [safeImages.length]);
  const next = useCallback(() =>
    setActiveIdx((i) => (i + 1) % safeImages.length), [safeImages.length]);

  return (
    <div className="flex flex-col gap-4">
      {/* Main image */}
      <div className="relative aspect-square overflow-hidden rounded-2xl glass-card group">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIdx}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <Image
              src={safeImages[activeIdx]?.url || '/placeholder.jpg'}
              alt={safeImages[activeIdx]?.alt || 'Product image'}
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </motion.div>
        </AnimatePresence>

        {/* Zoom overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {safeImages.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 glass rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/15"
              aria-label="Previous image"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 glass rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/15"
              aria-label="Next image"
            >
              <ChevronRight size={16} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {safeImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setActiveIdx(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === activeIdx ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Thumbnails */}
      {safeImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {safeImages.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                i === activeIdx ? 'border-primary scale-95' : 'border-white/10 opacity-60 hover:opacity-100'
              }`}
            >
              <Image
                src={img.url || '/placeholder.jpg'}
                alt={`Thumbnail ${i + 1}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VariantSelector({
  variants,
  selected,
  onChange,
}: {
  variants: ProductVariant[];
  selected: Record<string, string>;
  onChange: (name: string, val: string) => void;
}) {
  if (!variants?.length) return null;
  return (
    <div className="space-y-4">
      {variants.map((variant) => (
        <div key={variant.name}>
          <p className="text-sm font-medium mb-2 text-muted-foreground uppercase tracking-wider">
            {variant.name}:{' '}
            <span className="text-foreground normal-case tracking-normal font-semibold">
              {selected[variant.name] || '—'}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {variant.options.map((opt) => (
              <button
                key={opt}
                onClick={() => onChange(variant.name, opt)}
                className={`px-4 py-2 rounded-xl text-sm border transition-all duration-200 ${
                  selected[variant.name] === opt
                    ? 'border-primary bg-primary/20 text-foreground'
                    : 'border-white/10 hover:border-white/30 text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: Review }) {
  return (
    <motion.div variants={fadeUp} className="glass-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
            {review.user.firstName[0]}
            {review.user.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-sm">
              {review.user.firstName} {review.user.lastName}
            </p>
            {review.isVerifiedPurchase && (
              <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                <Check size={10} /> Verified Purchase
              </span>
            )}
          </div>
        </div>
        <StarRating rating={review.rating} size={12} />
      </div>
      {review.title && <p className="font-semibold text-sm">{review.title}</p>}
      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const setCart = useCartStore((s) => s.setCart);
  const addLocalItem = useCartStore((s) => s.addLocalItem);
  const wishlistHas = useWishlistStore((s) => s.has);
  const wishlistToggle = useWishlistStore((s) => s.toggle);

  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [addedToCart, setAddedToCart] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'description' | 'reviews' | 'shipping'>('description');

  // ── Fetch product
  const { data: product, isLoading, isError } = useQuery<Product | null>({
    queryKey: ['product', params.slug],
    queryFn: () => fetchProductBySlug(params.slug),
    staleTime: 1000 * 60 * 5,
  });

  // ── Fetch reviews
  const { data: reviews } = useQuery<Review[]>({
    queryKey: ['reviews', params.slug],
    queryFn: async () => {
      const res = await api.get(`/reviews/product/${product?.id}`);
      return res.data.data ?? [];
    },
    enabled: !!product?.id,
    staleTime: 1000 * 60 * 2,
  });

  // ── Fetch related products
  const { data: related } = useQuery<Product[]>({
    queryKey: ['related', product?.id],
    queryFn: () => fetchRelatedProducts(product!.id),
    enabled: !!product?.id,
    staleTime: 1000 * 60 * 5,
  });

  const inWishlist = product ? wishlistHas(product.id) : false;

  // ── Add to cart mutation (API when logged in)
  const cartMutation = useMutation({
    mutationFn: async () => {
      const variantStr = Object.values(selectedVariants).filter(Boolean).join(' / ') || undefined;
      const res = await api.post('/cart/items', {
        productId: product!.id,
        quantity,
        variant: variantStr,
      });
      return res.data.data;
    },
    onSuccess: (data) => {
      if (data?.items) setCart(data.items);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      setCartError(null);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2500);
    },
    onError: (err) => setCartError(getApiError(err)),
  });

  const addToCart = async (redirectToCheckout = false) => {
    if (!product) return;
    setCartError(null);
    const variantStr = Object.values(selectedVariants).filter(Boolean).join(' / ') || undefined;

    if (isAuthenticated) {
      try {
        const res = await api.post('/cart/items', {
          productId: product.id,
          quantity,
          variant: variantStr,
        });
        if (res.data.data?.items) setCart(res.data.data.items);
        queryClient.invalidateQueries({ queryKey: ['cart'] });
        setAddedToCart(true);
        setTimeout(() => setAddedToCart(false), 2500);
        if (redirectToCheckout) {
          router.push('/checkout');
          return;
        }
        return;
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          router.push('/login');
          return;
        }
      }
    }

    addLocalItem(
      {
        _id: product._id || String(product.id),
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        images: product.images,
        rating: product.rating,
        reviewCount: product.reviewCount,
        stock: product.stock,
        sku: product.sku,
        soldCount: product.soldCount,
      },
      quantity,
      variantStr
    );
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
    if (redirectToCheckout) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/checkout');
        return;
      }
      router.push('/checkout');
    }
  };

  const handleAddToCart = () => addToCart(false);
  const handleBuyNow = () => addToCart(true);

  const handleWishlist = async () => {
    if (!product) return;
    wishlistToggle({
      _id: product._id || String(product.id),
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      images: product.images,
      rating: product.rating,
      reviewCount: product.reviewCount,
      stock: product.stock,
      sku: product.sku,
      soldCount: product.soldCount,
      category: product.category,
    });
    if (isAuthenticated) {
      try {
        if (inWishlist) await api.delete(`/wishlist/${product.id}`);
        else await api.post(`/wishlist/${product.id}`);
      } catch {
        /* local wishlist still works */
      }
    }
  };

  const handleVariantChange = (name: string, val: string) =>
    setSelectedVariants((prev) => ({ ...prev, [name]: val }));

  // ── Discount percent
  const discountPct =
    product?.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : null;

  // ── Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-4 md:px-8">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 animate-pulse">
          <div className="aspect-square glass-card rounded-2xl" />
          <div className="space-y-4">
            <div className="h-4 w-32 bg-white/10 rounded" />
            <div className="h-10 w-3/4 bg-white/10 rounded" />
            <div className="h-6 w-24 bg-white/10 rounded" />
            <div className="h-20 bg-white/10 rounded" />
            <div className="h-12 bg-primary/20 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error / not found
  if (isError || !product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 pt-20 text-center px-4">
        <h1 className="font-display text-4xl font-bold">Product Not Found</h1>
        <p className="text-muted-foreground max-w-sm">
          This product may have been removed or the link is incorrect.
        </p>
        <Link href="/shop">
          <Button>Back to Shop</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4 md:px-8">
      {/* Added to cart toast */}
      <AnimatePresence>
        {addedToCart && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 glass-card px-6 py-4 flex items-center gap-4 shadow-2xl max-w-md w-[calc(100%-2rem)]"
          >
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <Check className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Added to cart!</p>
              <p className="text-xs text-muted-foreground truncate">{product.name}</p>
            </div>
            <Link href="/checkout">
              <Button size="sm">Checkout</Button>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-7xl">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8 flex-wrap">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link href={`/shop?category=${product.category.slug}`} className="hover:text-foreground transition-colors">
                {product.category.name}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground truncate max-w-[160px]">{product.name}</span>
        </nav>

        {/* Main product grid */}
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">

          {/* Left — Gallery */}
          <motion.div
            variants={blurReveal}
            initial="hidden"
            animate="visible"
          >
            <ImageGallery images={product.images} />
          </motion.div>

          {/* Right — Product info */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-col gap-6"
          >
            {/* Header */}
            <motion.div variants={fadeUp} className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {product.brand && (
                  <span className="text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1">
                    {product.brand}
                  </span>
                )}
                {product.category && (
                  <span className="text-xs text-muted-foreground">{product.category.name}</span>
                )}
                {discountPct && (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-400/10 rounded-full px-3 py-1">
                    -{discountPct}% OFF
                  </span>
                )}
              </div>
              <h1 className="font-display text-3xl font-bold leading-tight md:text-4xl">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 flex-wrap">
                <StarRating rating={product.rating} />
                <span className="text-sm text-muted-foreground">
                  {formatRating(product.rating)} ({product.reviewCount} reviews)
                </span>
                <span className="text-sm text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{product.soldCount} sold</span>
              </div>
            </motion.div>

            {/* Pricing */}
            <motion.div variants={fadeUp} className="flex items-end gap-4">
              <span className="font-display text-4xl font-bold">
                {formatPrice(product.price)}
              </span>
              {product.compareAtPrice && (
                <span className="text-xl text-muted-foreground line-through mb-0.5">
                  {formatPrice(product.compareAtPrice)}
                </span>
              )}
            </motion.div>

            {/* Short description */}
            {product.shortDescription && (
              <motion.p variants={fadeUp} className="text-muted-foreground leading-relaxed">
                {product.shortDescription}
              </motion.p>
            )}

            {/* Variants */}
            {product.variants && Array.isArray(product.variants) && product.variants.length > 0 && (
              <motion.div variants={fadeUp}>
                <VariantSelector
                  variants={product.variants}
                  selected={selectedVariants}
                  onChange={handleVariantChange}
                />
              </motion.div>
            )}

            {/* Quantity + CTA */}
            <motion.div variants={fadeUp} className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Quantity */}
                <div className="glass flex items-center rounded-full h-12 w-fit">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="h-12 w-12 flex items-center justify-center hover:bg-white/10 rounded-l-full transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center text-sm font-semibold">{quantity}</span>
                  <button
                    onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                    className="h-12 w-12 flex items-center justify-center hover:bg-white/10 rounded-r-full transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Add to cart */}
                <Button
                  className="flex-1 h-12 text-base gap-2 relative overflow-hidden"
                  onClick={handleAddToCart}
                  disabled={cartMutation.isPending || product.stock === 0}
                >
                  <AnimatePresence mode="wait">
                    {addedToCart ? (
                      <motion.span
                        key="added"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2"
                      >
                        <Check size={16} /> Added to Cart
                      </motion.span>
                    ) : (
                      <motion.span
                        key="add"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2"
                      >
                        <ShoppingBag size={16} />
                        {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </Button>

                {/* Wishlist */}
                <Button
                  variant="outline"
                  size="icon"
                  className={`h-12 w-12 flex-shrink-0 ${inWishlist ? 'text-primary border-primary' : ''}`}
                  aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                  onClick={handleWishlist}
                >
                  <Heart size={16} className={inWishlist ? 'fill-current' : ''} />
                </Button>

              {/* Share */}
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 flex-shrink-0"
                aria-label="Share"
                onClick={() => navigator.share?.({ title: product.name, url: window.location.href })}
              >
                <Share2 size={16} />
              </Button>
              </div>

              <Button
                className="w-full h-12 text-base"
                variant="secondary"
                onClick={handleBuyNow}
                disabled={product.stock === 0}
              >
                Buy Now
              </Button>
              {cartError && (
                <p className="text-sm text-red-400">{cartError}</p>
              )}
            </motion.div>

            {/* Stock indicator */}
            <motion.div variants={fadeUp}>
              {product.stock === 0 ? (
                <p className="text-red-400 text-sm font-medium">Out of stock</p>
              ) : product.stock <= 10 ? (
                <p className="text-amber-400 text-sm font-medium">
                  Only {product.stock} left in stock
                </p>
              ) : (
                <p className="text-emerald-400 text-sm font-medium flex items-center gap-1.5">
                  <Check size={14} /> In stock
                </p>
              )}
            </motion.div>

            {/* Trust badges */}
            <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { icon: Truck, label: 'Free shipping over $100' },
                { icon: Shield, label: 'Secure checkout' },
                { icon: RotateCcw, label: '30-day returns' },
                { icon: Package, label: 'Authentic products' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="glass rounded-xl p-3 flex flex-col items-center gap-2 text-center">
                  <Icon size={16} className="text-primary" />
                  <span className="text-[11px] text-muted-foreground leading-tight">{label}</span>
                </div>
              ))}
            </motion.div>

            {/* Vendor */}
            {product.vendor && (
              <motion.div variants={fadeUp} className="glass rounded-xl p-4 flex items-center gap-3">
                {product.vendor.logo ? (
                  <div className="relative h-10 w-10 rounded-full overflow-hidden flex-shrink-0">
                    <Image src={product.vendor.logo} alt={product.vendor.businessName} fill className="object-cover" sizes="40px" />
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    {product.vendor.businessName[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Sold by</p>
                  <p className="font-medium truncate">{product.vendor.businessName}</p>
                </div>
                <StarRating rating={product.vendor.rating} size={12} />
              </motion.div>
            )}

            {/* SKU */}
            <motion.div variants={fadeUp}>
              <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Tabs: Description / Reviews / Shipping ── */}
        <div className="mt-16">
          <div className="flex gap-1 glass rounded-2xl p-1 w-fit mb-8">
            {(['description', 'reviews', 'shipping'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all capitalize ${
                  activeTab === tab ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab}
                {tab === 'reviews' && product.reviewCount > 0 && (
                  <span className="ml-2 text-xs opacity-70">({product.reviewCount})</span>
                )}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'description' && (
              <motion.div
                key="desc"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="glass-card p-8 prose prose-invert max-w-none"
              >
                <div className="text-muted-foreground leading-relaxed whitespace-pre-line">
                  {product.description}
                </div>
                {product.tags && Array.isArray(product.tags) && product.tags.length > 0 && (
                  <div className="mt-6 flex flex-wrap gap-2 not-prose">
                    {product.tags.map((tag: string) => (
                      <span key={tag} className="text-xs glass rounded-full px-3 py-1 text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'reviews' && (
              <motion.div
                key="reviews"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* Rating summary */}
                <div className="glass-card p-6 flex items-center gap-8 flex-wrap">
                  <div className="text-center">
                    <p className="font-display text-6xl font-bold">{formatRating(product.rating)}</p>
                    <StarRating rating={product.rating} size={18} />
                    <p className="text-sm text-muted-foreground mt-1">{product.reviewCount} reviews</p>
                  </div>
                </div>

                {reviews?.length ? (
                  <motion.div
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                    className="grid gap-4 sm:grid-cols-2"
                  >
                    {reviews.map((r) => (
                      <ReviewCard key={r._id} review={r} />
                    ))}
                  </motion.div>
                ) : (
                  <div className="glass-card p-10 text-center text-muted-foreground">
                    No reviews yet. Be the first to review this product.
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'shipping' && (
              <motion.div
                key="shipping"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="glass-card p-8 space-y-6"
              >
                {[
                  { icon: Truck, title: 'Free Standard Shipping', desc: 'On orders over $100. Estimated delivery 5–7 business days.' },
                  { icon: Package, title: 'Express Delivery', desc: '2–3 business days with tracking. Additional charges apply.' },
                  { icon: RotateCcw, title: '30-Day Returns', desc: 'Hassle-free returns for all unused items in original packaging.' },
                  { icon: Shield, title: 'Buyer Protection', desc: 'All orders are covered by our purchase protection policy.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-4">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Related Products ── */}
        {related && related.length > 0 && (
          <section className="mt-20">
            <div className="flex items-end justify-between mb-8">
              <h2 className="font-display text-2xl font-bold md:text-3xl">You May Also Like</h2>
              <Link href="/shop" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                View all →
              </Link>
            </div>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-80px' }}
              className="grid grid-cols-2 gap-4 md:grid-cols-4"
            >
              {related.map((p) => (
                <motion.div key={p._id} variants={fadeUp}>
                  <Link href={`/shop/${p.slug}`} className="glass-card block overflow-hidden group">
                    <div className="relative aspect-square overflow-hidden">
                      <Image
                        src={p.images[0]?.url || '/placeholder.jpg'}
                        alt={p.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 768px) 50vw, 25vw"
                      />
                    </div>
                    <div className="p-4">
                      {p.category && (
                        <p className="text-xs text-muted-foreground mb-1">{p.category.name}</p>
                      )}
                      <h3 className="font-medium truncate text-sm">{p.name}</h3>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-semibold text-sm">{formatPrice(p.price)}</span>
                        <span className="text-xs text-muted-foreground">★ {formatRating(p.rating)}</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </section>
        )}
      </div>
    </div>
  );
}

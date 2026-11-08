import type { ROLES, ORDER_STATUS, PAYMENT_STATUS, VENDOR_STATUS } from './constants';

export type Role = (typeof ROLES)[keyof typeof ROLES];
export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export type VendorStatus = (typeof VENDOR_STATUS)[keyof typeof VENDOR_STATUS];

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: PaginationMeta;
  errors?: ValidationError[];
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: Role;
  vendorId?: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  phone?: string;
}

export interface ProductVariant {
  name: string;
  options: string[];
  sku?: string;
  price?: number;
  stock?: number;
}

import type { Request, Response } from 'express';
import { cartService } from '../services/cart.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/param';

export const cartController = {
  getCart: asyncHandler(async (req, res) => {
    const cart = await cartService.getCart(req.user!.userId);
    ApiResponse.success(res, cart);
  }),

  addItem: asyncHandler(async (req, res) => {
    const cart = await cartService.addItem(
      req.user!.userId,
      req.body.productId,
      req.body.quantity,
      req.body.variant
    );
    ApiResponse.success(res, cart, 'Item added to cart');
  }),

  updateItem: asyncHandler(async (req, res) => {
    const cart = await cartService.updateItem(
      req.user!.userId,
      param(req, 'productId'),
      req.body.quantity
    );
    ApiResponse.success(res, cart, 'Cart updated');
  }),

  removeItem: asyncHandler(async (req, res) => {
    const cart = await cartService.removeItem(req.user!.userId, param(req, 'productId'));
    ApiResponse.success(res, cart, 'Item removed');
  }),

  clearCart: asyncHandler(async (req, res) => {
    await cartService.clearCart(req.user!.userId);
    ApiResponse.success(res, null, 'Cart cleared');
  }),
};

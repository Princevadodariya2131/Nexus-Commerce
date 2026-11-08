import { ORDER_STATUSES } from '../policies/orderPolicy';
import { AppError } from '../utils/AppError';
import type { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/param';

const orderStatusFilter = (value: unknown): string | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !(ORDER_STATUSES as readonly string[]).includes(value)) {
    throw new AppError('Invalid status filter', 400);
  }
  return value;
};

export const orderController = {
  createOrder: asyncHandler(async (req, res) => {
    const order = await orderService.createFromCart(
      req.user!.userId,
      req.body.shippingAddress,
      req.body.paymentMethod,
      req.body.couponCode
    );
    ApiResponse.created(res, order);
  }),

  getMyOrders: asyncHandler(async (req, res) => {
    const result = await orderService.getUserOrders(
      req.user!.userId,
      Number(req.query.page) || 1,
      Number(req.query.limit) || 10
    );
    ApiResponse.success(res, result.orders, 'Orders fetched', 200, result.meta);
  }),

  getOrder: asyncHandler(async (req, res) => {
    const order = await orderService.getOrderById(param(req, 'id'), req.user!.userId);
    ApiResponse.success(res, order);
  }),

  trackOrder: asyncHandler(async (req, res) => {
    const order = await orderService.trackOrder(param(req, 'orderNumber'));
    ApiResponse.success(res, order);
  }),

  getAllOrders: asyncHandler(async (req, res) => {
    const result = await orderService.getAllOrders({
      status: orderStatusFilter(req.query.status),
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
    });
    ApiResponse.success(res, result.orders, 'Orders fetched', 200, result.meta);
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const order = await orderService.updateOrderStatus(
      param(req, 'id'),
      req.body.status,
      { role: req.user!.role, vendorId: req.vendor?.id },
      req.body.note
    );
    ApiResponse.success(res, order, 'Order status updated');
  }),
};

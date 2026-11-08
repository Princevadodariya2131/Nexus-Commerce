import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';
import { config } from '../config';

const cookieOptions = {
  httpOnly: true,
  secure: config.isProd,
  sameSite: 'lax' as const,
  maxAge: 15 * 60 * 1000,
};

const refreshCookieOptions = {
  ...cookieOptions,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  res.cookie('accessToken', accessToken, cookieOptions);
  res.cookie('refreshToken', refreshToken, refreshCookieOptions);
};

export const authController = {
  register: asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    ApiResponse.created(res, { user: result.user, accessToken: result.accessToken });
  }),

  login: asyncHandler(async (req, res) => {
    const result = await authService.login(req.body.email, req.body.password);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    ApiResponse.success(res, { user: result.user, accessToken: result.accessToken });
  }),

  refresh: asyncHandler(async (req, res) => {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    const tokens = await authService.refreshToken(token);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    ApiResponse.success(res, { accessToken: tokens.accessToken });
  }),

  logout: asyncHandler(async (req, res) => {
    if (req.user) await authService.logout(req.user.userId);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    ApiResponse.success(res, null, 'Logged out successfully');
  }),

  verifyEmail: asyncHandler(async (req, res) => {
    const user = await authService.verifyEmail(req.query.token as string);
    ApiResponse.success(res, user, 'Email verified successfully');
  }),

  forgotPassword: asyncHandler(async (req, res) => {
    await authService.forgotPassword(req.body.email);
    ApiResponse.success(res, null, 'If email exists, reset link has been sent');
  }),

  resetPassword: asyncHandler(async (req, res) => {
    await authService.resetPassword(req.body.token, req.body.password);
    ApiResponse.success(res, null, 'Password reset successfully');
  }),

  getProfile: asyncHandler(async (req, res) => {
    const user = await authService.getProfile(req.user!.userId);
    ApiResponse.success(res, user);
  }),

  updateProfile: asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user!.userId, req.body);
    ApiResponse.success(res, user, 'Profile updated');
  }),

  socketToken: asyncHandler(async (req, res) => {
    ApiResponse.success(res, authService.createSocketToken(req.user!.userId, req.user!.role));
  }),
};

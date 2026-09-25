import type {
  AuthTokenInfo,
  ChangePasswordRequest,
  ForgotPasswordResponse,
  LoginResponse,
  SessionActor,
} from '@locamania/shared';

import { api } from './client';

export const authApi = {
  login: (identifier: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { identifier, password }),
  forgot: (identifier: string) => api.post<ForgotPasswordResponse>('/auth/forgot-password', { identifier }),
  tokenInfo: (token: string) => api.get<AuthTokenInfo>(`/auth/tokens/${encodeURIComponent(token)}`),
  reset: (token: string, password: string) => api.post<LoginResponse>('/auth/reset-password', { token, password }),
  meStaff: () => api.get<SessionActor>('/auth/me'),
  meCustomer: () => api.get<SessionActor>('/auth/me/customer'),
  changePasswordStaff: (body: ChangePasswordRequest) => api.post<LoginResponse>('/auth/change-password', body),
  changePasswordCustomer: (body: ChangePasswordRequest) =>
    api.post<LoginResponse>('/auth/customer/change-password', body),
  acceptPrivacy: () => api.post<void>('/auth/customer/accept-privacy'),
  logoutStaff: () => api.post<void>('/auth/logout'),
  logoutCustomer: () => api.post<void>('/auth/customer/logout'),
};

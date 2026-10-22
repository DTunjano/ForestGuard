import { request } from '../../../shared/api/client';
export const getMe = () => request('auth/me/');
export const register = (body) => request('auth/register/', { method: 'POST', body, auth: false });
export const editProfile = (body) => request('auth/me/', { method: 'PATCH', body });
export const changePassword = (body) => request('auth/password/change/', { method: 'POST', body });

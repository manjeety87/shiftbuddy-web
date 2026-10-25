import type { AuthResponse, CommuteMode, Features, Place, User } from '../interfaces/user.d';
import { api } from './api';
import { clearTokens, saveTokens } from './storage';

export const registerUser = async (name: string, email: string, password: string) => {
    const { data } = await api.post<{ data: AuthResponse }>('/auth/register', { name, email, password });
    await saveTokens(data.data.accessToken);
    return data.data.user;
};

export const loginUser = async (email: string, password: string) => {
    const { data } = await api.post<{ data: AuthResponse }>('/auth/login', { email, password });
    await saveTokens(data.data.accessToken);
    return data.data.user;
};

export const updateProfile = async (data: {
    name?: string;
    taxDeductionPercent?: number;
    commuteMode?: CommuteMode;
    arrivalBufferMinutes?: number;
    /** Only the switches that change */
    features?: Partial<Features>;
}): Promise<User> => {
    const { data: response } = await api.patch<{ data: User }>('/auth/profile', data);
    return response.data;
};
/** Emails a fresh 6-digit code (one is sent automatically at sign-up). */
export const sendVerificationCode = async (): Promise<void> => {
    await api.post('/auth/verify-email/send');
};

export const verifyEmail = async (code: string): Promise<User> => {
    const { data } = await api.post<{ data: User }>('/auth/verify-email', { code });
    return data.data;
};

export const setHomeLocation = async (place: Place): Promise<User> => {
    const { data } = await api.put<{ data: User }>('/auth/home', place);
    return data.data;
};

export const removeHomeLocation = async (): Promise<User> => {
    const { data } = await api.delete<{ data: User }>('/auth/home');
    return data.data;
};

export const changePassword = async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.patch('/auth/change-password', { currentPassword, newPassword });
};

export const googleLogin = async (idToken: string) => {
    const { data } = await api.post<{ data: AuthResponse }>('/auth/google', { idToken });
    await saveTokens(data.data.accessToken);
    return data.data.user;
};

export const getCurrentUser = async () => {
    const { data } = await api.get<{ data: User }>('/auth/me');
    return data.data;
};

export const forgotPassword = async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
};

export const resetPassword = async (email: string, code: string, newPassword: string): Promise<void> => {
    await api.post('/auth/reset-password', { email, code, newPassword });
};

export const logoutUser = async () => {
    try {
        await api.post('/auth/logout');
    } finally {
        // Chahe server call fail ho jaaye, local tokens hamesha clear karo
        await clearTokens();
    }
};

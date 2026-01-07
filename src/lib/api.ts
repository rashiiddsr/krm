import type { FollowUp, Notification, Profile, Prospect } from './database.types';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!apiBaseUrl) {
  throw new Error('Missing VITE_API_BASE_URL environment variable');
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSession {
  user: AuthUser;
  profile: Profile;
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown };

type NotificationPayload = Omit<Notification, 'id' | 'created_at'>;

const buildQuery = (params: Record<string, string | number | boolean | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const apiRequest = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
};

const apiRequestForm = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
};

export const buildAssetUrl = (path: string) => {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `${apiBaseUrl}${path}`;
};

export const api = {
  login: (identifier: string, password: string) =>
    apiRequest<AuthSession>('/auth/login', { method: 'POST', body: { identifier, password } }),
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST' }),

  listProfiles: (role?: string) =>
    apiRequest<Profile[]>(`/profiles${buildQuery({ role })}`),
  getProfile: (id: string) => apiRequest<Profile>(`/profiles/${id}`),
  createProfile: (payload: {
    full_name: string;
    email: string;
    username: string;
    no_hp: string;
    password: string;
    role: string;
  }) =>
    apiRequest<Profile>('/profiles', { method: 'POST', body: payload }),
  updateProfile: (id: string, payload: Partial<Profile> & { password?: string }) =>
    apiRequest<Profile>(`/profiles/${id}`, { method: 'PUT', body: payload }),
  uploadProfilePhoto: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);
    return apiRequestForm<Profile>(`/profiles/${id}/photo`, {
      method: 'POST',
      body: formData,
    });
  },
  deleteProfile: (id: string) => apiRequest<void>(`/profiles/${id}`, { method: 'DELETE' }),

  listProspects: (params: { salesId?: string; startDate?: string; endDate?: string } = {}) =>
    apiRequest<Prospect[]>(`/prospects${buildQuery(params)}`),
  listProspectsWithSales: (params: { salesId?: string } = {}) =>
    apiRequest<(Prospect & { sales?: Profile })[]>(`/prospects/with-sales${buildQuery(params)}`),
  createProspect: (payload: Omit<Prospect, 'id' | 'created_at' | 'updated_at'>) =>
    apiRequest<Prospect>('/prospects', { method: 'POST', body: payload }),
  updateProspect: (id: string, payload: Partial<Prospect>) =>
    apiRequest<Prospect>(`/prospects/${id}`, { method: 'PUT', body: payload }),

  listFollowUps: (
    params: { assignedTo?: string; startDate?: string; endDate?: string } = {}
  ) =>
    apiRequest<(FollowUp & { prospect?: Prospect; assignedToProfile?: Profile; assignedByProfile?: Profile })[]>(
      `/follow-ups${buildQuery(params)}`
    ),
  createFollowUp: (payload: Omit<FollowUp, 'id' | 'created_at' | 'updated_at' | 'completed_at'>) =>
    apiRequest<FollowUp>('/follow-ups', { method: 'POST', body: payload }),
  updateFollowUp: (id: string, payload: Partial<FollowUp>) =>
    apiRequest<FollowUp>(`/follow-ups/${id}`, { method: 'PUT', body: payload }),

  listNotifications: (params: { userId: string; limit?: number }) =>
    apiRequest<Notification[]>(`/notifications${buildQuery(params)}`),
  createNotifications: (payload: NotificationPayload[] | NotificationPayload) =>
    apiRequest<void>('/notifications', { method: 'POST', body: payload }),
  markNotificationRead: (id: string) =>
    apiRequest<void>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: (userId: string) =>
    apiRequest<void>('/notifications/read-all', { method: 'POST', body: { user_id: userId } }),
};

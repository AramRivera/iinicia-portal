import type {
  AuthorizedCourse,
  CourseOffering,
  EnrollmentRequest,
  LoginResponse,
  MoodleLaunchResponse,
  MoodleStatusResponse,
  Program,
  RegisterResponse,
  UserProfile,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('iinicia_access_token');
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('iinicia_access_token', token);
}

export function removeToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('iinicia_access_token');
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers || {});

  headers.set('Content-Type', 'application/json');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const response = await fetch(`${API_URL}${normalizedPath}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    let errorMessage = 'Ocurrió un error en la solicitud.';
    if (isJson && data) {
      if (Array.isArray(data.message)) {
        errorMessage = data.message.join(', ');
      } else if (typeof data.message === 'string') {
        errorMessage = data.message;
      }
    }
    throw new ApiError(errorMessage, response.status, data);
  }

  return data as T;
}

// ----------------- Auth API -----------------
export const authApi = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    const res = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    const token = res.session?.access_token || (res as any).access_token;
    if (token) {
      setToken(token);
    }
    return res;
  },

  register: async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
  }): Promise<RegisterResponse> => {
    const res = await apiFetch<RegisterResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const token = res.session?.access_token || (res as any).access_token;
    if (token) {
      setToken(token);
    }
    return res;
  },

  getMe: async (): Promise<UserProfile> => {
    return apiFetch<UserProfile>('/auth/me');
  },

  logout: () => {
    removeToken();
  },
};

// ----------------- Courses & Offerings API -----------------
export const coursesApi = {
  getAuthorizedCourses: async (): Promise<AuthorizedCourse[]> => {
    return apiFetch<AuthorizedCourse[]>('/courses');
  },

  getOfferings: async (): Promise<CourseOffering[]> => {
    return apiFetch<CourseOffering[]>('/courses/offerings');
  },

  createCourse: async (payload: any): Promise<CourseOffering> => {
    return apiFetch<CourseOffering>('/courses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateCourse: async (id: string, payload: any): Promise<CourseOffering> => {
    return apiFetch<CourseOffering>(`/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  launchCourse: async (courseMappingId: string): Promise<MoodleLaunchResponse> => {
    return apiFetch<MoodleLaunchResponse>(`/moodle/courses/${courseMappingId}/launch`, {
      method: 'POST',
    });
  },
};

// ----------------- Enrollments API -----------------
export const enrollmentsApi = {
  requestEnrollment: async (
    courseMappingId: string,
    options?: { user_id?: string; moodle_role?: string; notes?: string },
  ): Promise<EnrollmentRequest> => {
    return apiFetch<EnrollmentRequest>('/enrollments', {
      method: 'POST',
      body: JSON.stringify({
        course_mapping_id: courseMappingId,
        user_id: options?.user_id,
        moodle_role: options?.moodle_role || 'student',
        notes: options?.notes,
      }),
    });
  },

  getMyEnrollments: async (): Promise<EnrollmentRequest[]> => {
    return apiFetch<EnrollmentRequest[]>('/enrollments/my');
  },

  getAllEnrollments: async (status?: string): Promise<EnrollmentRequest[]> => {
    const query = status ? `?status=${status}` : '';
    const res = await apiFetch<any>(`/enrollments${query}`);
    return Array.isArray(res) ? res : res?.data || [];
  },

  authorizeEnrollment: async (
    enrollmentId: string,
    decision: { status: 'autorizada' | 'rechazada'; rejection_reason?: string; sync_to_moodle?: boolean },
  ): Promise<any> => {
    return apiFetch(`/enrollments/${enrollmentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(decision),
    });
  },

  retrySync: async (enrollmentId: string): Promise<any> => {
    return apiFetch(`/enrollments/${enrollmentId}/sync`, {
      method: 'POST',
    });
  },
};

// ----------------- Roles API -----------------
export const rolesApi = {
  getRoles: async (): Promise<any[]> => {
    return apiFetch<any[]>('/roles');
  },

  assignRole: async (userId: string, roleId: number): Promise<any> => {
    return apiFetch(`/roles/users/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ role_id: roleId }),
    });
  },

  revokeRole: async (userId: string, roleId: number): Promise<any> => {
    return apiFetch(`/roles/users/${userId}/${roleId}`, {
      method: 'DELETE',
    });
  },
};

// ----------------- Audit API -----------------
export const auditApi = {
  getLogs: async (params?: { limit?: number; offset?: number; action?: string }): Promise<any> => {
    const sp = new URLSearchParams();
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    if (params?.action) sp.set('action', params.action);
    const qs = sp.toString();
    return apiFetch<any>(`/audit${qs ? `?${qs}` : ''}`);
  },
};

// ----------------- Moodle API -----------------
export const moodleApi = {
  getStatus: async (): Promise<MoodleStatusResponse> => {
    return apiFetch<MoodleStatusResponse>('/moodle/status');
  },

  launchCampus: async (): Promise<{ access_url: string }> => {
    return apiFetch<{ access_url: string }>('/moodle/launch', {
      method: 'POST',
    });
  },

  syncAllUsers: async (): Promise<{ total: number; synced: number; failed: number; results: any[] }> => {
    return apiFetch('/moodle/sync/users', {
      method: 'POST',
    });
  },

  syncUser: async (userId: string): Promise<any> => {
    return apiFetch(`/moodle/sync/user/${userId}`, {
      method: 'POST',
    });
  },
};

// ----------------- Programs API -----------------
export const programsApi = {
  getPrograms: async (): Promise<Program[]> => {
    return apiFetch<Program[]>('/programs');
  },

  getProgramBySlugOrId: async (slugOrId: string): Promise<Program> => {
    return apiFetch<Program>(`/programs/${slugOrId}`);
  },

  createProgram: async (payload: any): Promise<Program> => {
    return apiFetch<Program>('/programs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateProgram: async (id: string, payload: any): Promise<Program> => {
    return apiFetch<Program>(`/programs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  enrollUserInProgram: async (programId: string, payload: { user_id: string; moodle_role?: string }): Promise<any> => {
    return apiFetch(`/programs/${programId}/enroll-user`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ----------------- Users API -----------------
export const usersApi = {
  getUsers: async (params?: { role?: string; status?: string; search?: string; limit?: number; offset?: number }): Promise<{ data: UserProfile[]; meta: any }> => {
    const sp = new URLSearchParams();
    if (params?.role) sp.set('role', params.role);
    if (params?.status) sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search);
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.offset) sp.set('offset', String(params.offset));
    const qs = sp.toString();
    return apiFetch<{ data: UserProfile[]; meta: any }>(`/users${qs ? `?${qs}` : ''}`);
  },

  getUserById: async (userId: string): Promise<UserProfile> => {
    return apiFetch<UserProfile>(`/users/${userId}`);
  },

  updateStatus: async (userId: string, payload: { status: string; reason?: string }): Promise<any> => {
    return apiFetch(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

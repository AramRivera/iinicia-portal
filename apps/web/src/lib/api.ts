import type {
  AdmissionApplication,
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
  recoverPassword: async (email: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>('/auth/recover', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: async (recoveryToken: string, password: string): Promise<{ message: string }> =>
    apiFetch<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      headers: { Authorization: `Bearer ${recoveryToken}` },
      body: JSON.stringify({ password }),
    }),

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
type CourseMappingResponse = Omit<CourseOffering, 'course_mapping_id' | 'code' | 'name' | 'program_name'> & {
  course_mapping_id?: string;
  code?: string;
  name?: string;
  program_name?: string;
};

function normalizeCourseOffering(course: CourseMappingResponse): CourseOffering {
  return {
    ...course,
    course_mapping_id: course.course_mapping_id || course.id,
    code: course.code || course.portal_course_code || course.moodle_shortname || '',
    name: course.name || course.course_name || '',
    program_name: course.program_name || course.programs?.name || '',
  };
}

export const coursesApi = {
  getAuthorizedCourses: async (): Promise<AuthorizedCourse[]> => {
    return apiFetch<AuthorizedCourse[]>('/courses');
  },

  getOfferings: async (): Promise<CourseOffering[]> => {
    const offerings = await apiFetch<CourseMappingResponse[]>('/courses/offerings');
    return offerings.map(normalizeCourseOffering);
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
    // La API filtra las solicitudes del usuario autenticado en GET /enrollments.
    return apiFetch<EnrollmentRequest[]>('/enrollments');
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

  deleteEnrollment: async (enrollmentId: string): Promise<any> => {
    return apiFetch(`/enrollments/${enrollmentId}`, {
      method: 'DELETE',
    });
  },
};

export const admissionsApi = {
  getMyApplications: (): Promise<AdmissionApplication[]> =>
    apiFetch<AdmissionApplication[]>('/admissions'),
  createApplication: (payload: {
    program_id: string;
    motivation_letter?: string;
  }): Promise<AdmissionApplication> =>
    apiFetch<AdmissionApplication>('/admissions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  reviewApplication: (id: string, status: 'en_revision' | 'admitido' | 'rechazado', reviewerNotes?: string): Promise<AdmissionApplication> =>
    apiFetch<AdmissionApplication>(`/admissions/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewer_notes: reviewerNotes }),
    }),
};

export interface ContactMessagePayload {
  full_name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface ContactMessageResponse {
  success: boolean;
  message_id: string;
  submitted_at: string;
}

export const contactApi = {
  submitMessage: (payload: ContactMessagePayload): Promise<ContactMessageResponse> =>
    apiFetch<ContactMessageResponse>('/contact', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
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

  getCourseContents: async (courseId: number): Promise<any[]> => {
    return apiFetch<any[]>(`/moodle/courses/${courseId}/contents`);
  },

  getCourseParticipants: async (courseId: number): Promise<any[]> => {
    return apiFetch<any[]>(`/moodle/courses/${courseId}/participants`);
  },

  getCourseProgress: async (courseId: number, moodleUserId?: number): Promise<any> => {
    const qs = moodleUserId ? `?moodle_user_id=${moodleUserId}` : '';
    return apiFetch<any>(`/moodle/courses/${courseId}/progress${qs}`);
  },

  getCourseTeacherOverview: async (courseId: number): Promise<any> => {
    return apiFetch<any>(`/moodle/courses/${courseId}/teacher-overview`);
  },
};

// ----------------- Programs API -----------------
export const programsApi = {
  getPrograms: async (type?: string): Promise<Program[]> => {
    const programs = await apiFetch<Program[]>('/programs');
    return type ? programs.filter((program) => program.type === type) : programs;
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

  updateOwnProfile: async (payload: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    avatar_url?: string;
    bio?: string;
  }): Promise<{ message: string; profile: UserProfile }> => {
    return apiFetch<{ message: string; profile: UserProfile }>('/users/me/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  createUser: async (payload: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    role_id: number;
  }): Promise<UserProfile> => {
    return apiFetch<UserProfile>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

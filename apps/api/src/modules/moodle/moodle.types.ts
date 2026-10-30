import type { MoodleRoleType } from '../../common/supabase/database.types.js';

export interface MoodleUserResponse {
  id: number;
  username: string;
  firstname: string;
  lastname: string;
  fullname?: string;
  email: string;
  department?: string;
  firstaccess?: number;
  lastaccess?: number;
  auth?: string;
  suspended?: boolean | number;
}

export interface MoodleCourseResponse {
  id: number;
  shortname: string;
  fullname: string;
  displayname?: string;
  idnumber?: string;
  summary?: string;
  progress?: number;
  completed?: boolean;
}

export interface MoodleActivityCompletionStatus {
  cmid: number;
  state: 0 | 1 | 2 | 3;
  tracking: 0 | 1 | 2;
  hascompletion?: boolean;
  istrackeduser?: boolean;
  uservisible?: boolean;
}

export interface MoodleActivitiesCompletionResponse {
  statuses: MoodleActivityCompletionStatus[];
  warnings?: unknown[];
}

export interface MoodleErrorResponse {
  exception?: string;
  errorcode?: string;
  message?: string;
  debuginfo?: string;
}

export const MOODLE_ROLE_IDS: Record<MoodleRoleType, number> = {
  manager: 1,
  coursecreator: 2,
  editingteacher: 3,
  teacher: 4,
  student: 5,
};

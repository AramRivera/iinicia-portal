import type {
  SyncStatusType,
  UserStatus,
} from '../../../common/supabase/database.types.js';

/**
 * Contrato de `GET /api/v1/auth/me`. Publicado en `docs/openapi.yaml`.
 */
export interface MeResponse {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  avatar_url?: string | null;
  status: UserStatus;
  roles: string[];
  permissions: string[];
  moodle_user_id?: number | null;
  moodle_sync_status?: SyncStatusType;
  password_changed_at?: string | null;
}

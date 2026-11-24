// IINICIA Portal · oferta de cursos · courses.service.spec.ts
/** Aísla las dependencias del servicio para comprobar cómo debe distinguir la oferta de los cursos autorizados y mantener su vínculo con Moodle. */
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseService } from '../../common/supabase/supabase.service.js';
import type { MoodleClient } from '../moodle/moodle.client.js';
import { CoursesService } from './courses.service.js';

describe('CoursesService catalog and authorization', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Configura el servicio y sus dependencias simuladas para cada escenario de oferta académica. */
  function setup(rows: unknown, status = 200) {
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify(rows), {
      status, headers: { 'content-type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetch);
    const supabase = new SupabaseService(new ConfigService({
      SUPABASE_URL: 'https://test.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-test',
    }));
    const sync = vi.fn();
    const service = new CoursesService(supabase, { getAllCourses: sync } as unknown as MoodleClient);
    return { service, fetch, sync };
  }

  it('reads active offerings under the user JWT without importing Moodle courses', async () => {
    const { service, fetch, sync } = setup([{ id: 'offering' }]);
    expect(await service.findOfferings('applicant-jwt')).toEqual([{ id: 'offering' }]);
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).toContain('is_active=eq.true');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer applicant-jwt');
    expect(sync).not.toHaveBeenCalled();
  });

  it('keeps the authorized course query restricted to the authenticated user', async () => {
    const { service, fetch } = setup([]);
    expect(await service.findCourses('student-id', false, 'student-jwt')).toEqual([]);
    expect(String(fetch.mock.calls[0][0])).toContain('v_user_authorized_courses');
    expect(String(fetch.mock.calls[0][0])).toContain('user_id=eq.student-id');
  });

  it('does not disguise catalog failures as an empty offer', async () => {
    const { service } = setup({ code: '42501', message: 'denied' }, 403);
    await expect(service.findOfferings('jwt')).rejects.toMatchObject({ status: 500 });
  });

  it('does not give an unassigned coordinator the global administrative catalog', async () => {
    const { service, fetch, sync } = setup([]);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify([
      { roles: { slug: 'coordinador' }, expires_at: null },
    ]), { headers: { 'content-type': 'application/json' } }));
    expect(await service.findCourses('coordinator', true, 'jwt')).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toContain('user_programs');
    expect(sync).not.toHaveBeenCalled();
  });

  it('returns mapped courses under the administrator JWT when synchronization cannot start', async () => {
    const { service, fetch, sync } = setup([{ id: 'mapped-course' }]);
    fetch.mockResolvedValueOnce(new Response(JSON.stringify([
      { roles: { slug: 'superadministrador' }, expires_at: null },
    ]), { headers: { 'content-type': 'application/json' } }));
    await expect(service.findCourses('admin', true, 'admin-jwt')).resolves.toEqual([{ id: 'mapped-course' }]);
    expect(String(fetch.mock.calls[1][0])).toContain('course_mappings');
    expect(new Headers(fetch.mock.calls[1][1].headers).get('Authorization')).toBe('Bearer admin-jwt');
    expect(sync).not.toHaveBeenCalled();
  });
});

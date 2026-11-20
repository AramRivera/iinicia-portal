import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MoodleClient } from './moodle.client.js';

describe('MoodleClient transport', () => {
  const site = 'https://moodle.example/moodle';
  const client = new MoodleClient(new ConfigService({
    MOODLE_URL: site,
    MOODLE_WS_TOKEN: 'example-token',
  }));

  afterEach(() => vi.unstubAllGlobals());

  it('uses only the configured endpoint and keeps the service token in the POST body', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      sitename: 'Campus de ensayo',
      siteurl: 'https://other.example',
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(client.checkConnection()).resolves.toMatchObject({ ok: true });
    await expect(client.getEffectiveBaseUrl()).resolves.toBe(site);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, request] = fetch.mock.calls[0];
    expect(url).toBe(site + '/webservice/rest/server.php');
    expect(request).toMatchObject({ method: 'POST', redirect: 'error' });
    expect(new URLSearchParams(request.body).get('wstoken')).toBe('example-token');
  });

  it('returns only the configured SSO path and the temporary key', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({
      loginurl: site + '/auth/userkey/login.php?key=example&unexpected=value',
    })).mockResolvedValueOnce(Response.json({
      loginurl: 'https://other.example/moodle/auth/userkey/login.php?key=example',
    }));
    vi.stubGlobal('fetch', fetch);

    await expect(client.requestUserKeyLoginUrl('test@example.com'))
      .resolves.toBe(site + '/auth/userkey/login.php?key=example');
    await expect(client.requestUserKeyLoginUrl('test@example.com')).resolves.toBeNull();
  });
});

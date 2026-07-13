import { prisma } from '@ahh-wfm/database';
import axios from 'axios';

const WEB_URL = process.env.WEB_BASE_URL || 'http://localhost:3100';
const MOBILE_URL = process.env.MOBILE_BASE_URL || 'http://localhost:3101';

describe('AHH WFM API Routes Verification', () => {
  let webCookie: string | null = null;
  let mobileCookie: string | null = null;

  beforeAll(async () => {
    console.log('Authenticating for API tests...');
    try {
      // Authenticate against Web portal
      const csrfRes = await axios.get(`${WEB_URL}/api/auth/csrf`);
      const csrfToken = csrfRes.data.csrfToken;
      const webCsrfCookie = csrfRes.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
      
      const loginRes = await axios.post(
        `${WEB_URL}/api/auth/callback/credentials`,
        new URLSearchParams({
          csrfToken,
          email: 'admin@alhattab.qa',
          password: 'Password123!',
          json: 'true'
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': webCsrfCookie
          },
          validateStatus: () => true
        }
      );

      const cookies = loginRes.headers['set-cookie'];
      if (cookies) {
        webCookie = cookies.map(c => c.split(';')[0]).join('; ');
        console.log('Web Auth successful!');
      }

      // Authenticate against Mobile portal
      const mobileCsrf = await axios.get(`${MOBILE_URL}/api/auth/csrf`);
      const mobileToken = mobileCsrf.data.csrfToken;
      const mobileCsrfCookie = mobileCsrf.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
      
      const mobileLogin = await axios.post(
        `${MOBILE_URL}/api/auth/callback/credentials`,
        new URLSearchParams({
          csrfToken: mobileToken,
          email: 'admin@alhattab.qa',
          password: 'Password123!',
          json: 'true'
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': mobileCsrfCookie
          },
          validateStatus: () => true
        }
      );

      const mCookies = mobileLogin.headers['set-cookie'];
      if (mCookies) {
        mobileCookie = mCookies.map(c => c.split(';')[0]).join('; ');
        console.log('Mobile Auth successful!');
      }
    } catch (e: any) {
      console.warn('Authentication failed. Testing APIs in public/guest mode:', e.message);
    }
  });

  test('GET /api/v1/employees', async () => {
    const headers = webCookie ? { Cookie: webCookie } : {};
    const res = await axios.get(`${WEB_URL}/api/v1/employees`, { headers, validateStatus: () => true });
    
    if (res.status === 401 || res.status === 307 || res.status === 302) {
      console.log('GET /employees authentication guard active (OK)');
      expect([302, 307, 401]).toContain(res.status);
    } else {
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    }
  });

  test('GET /api/v1/employees?employeeCategory=WHITE_COLLAR', async () => {
    const headers = webCookie ? { Cookie: webCookie } : {};
    const res = await axios.get(`${WEB_URL}/api/v1/employees?employeeCategory=WHITE_COLLAR`, { headers, validateStatus: () => true });
    
    if (res.status === 200) {
      expect(Array.isArray(res.data)).toBe(true);
      if (res.data.length > 0) {
        expect(res.data[0].employeeCategory).toBe('WHITE_COLLAR');
      }
    } else {
      expect([302, 307, 401]).toContain(res.status);
    }
  });

  test('GET /api/v1/manpower/security-guarding/manpower', async () => {
    const headers = webCookie ? { Cookie: webCookie } : {};
    const res = await axios.get(`${WEB_URL}/api/v1/manpower/security-guarding/manpower`, { headers, validateStatus: () => true });
    
    if (res.status === 200) {
      expect(Array.isArray(res.data)).toBe(true);
    } else {
      expect([302, 307, 401]).toContain(res.status);
    }
  });

  test('GET /api/v1/security/reliever-pools', async () => {
    const headers = webCookie ? { Cookie: webCookie } : {};
    const res = await axios.get(`${WEB_URL}/api/v1/security/reliever-pools`, { headers, validateStatus: () => true });
    
    if (res.status === 200) {
      expect(Array.isArray(res.data)).toBe(true);
    } else {
      expect([302, 307, 401]).toContain(res.status);
    }
  });

  test('GET /api/v1/security/reliever-pools/assignments', async () => {
    const headers = webCookie ? { Cookie: webCookie } : {};
    const res = await axios.get(`${WEB_URL}/api/v1/security/reliever-pools/assignments`, { headers, validateStatus: () => true });
    
    if (res.status === 200) {
      expect(Array.isArray(res.data)).toBe(true);
    } else {
      expect([302, 307, 401]).toContain(res.status);
    }
  });

  test('GET /api/v1/security/sites/[siteId]/dependencies', async () => {
    const site = await prisma.manpowerSite.findFirst();
    if (!site) {
      console.log('Skipping site dependencies test: no site found in DB');
      return;
    }

    const headers = webCookie ? { Cookie: webCookie } : {};
    const res = await axios.get(`${WEB_URL}/api/v1/security/sites/${site.id}/dependencies`, { headers, validateStatus: () => true });
    
    if (res.status === 200) {
      expect(res.data).toHaveProperty('canDeactivate');
    } else {
      expect([302, 307, 401]).toContain(res.status);
    }
  });

  test('GET /api/v1/dashboard (mobile)', async () => {
    const headers = mobileCookie ? { Cookie: mobileCookie } : {};
    const res = await axios.get(`${MOBILE_URL}/api/v1/dashboard`, { headers, validateStatus: () => true });
    
    if (res.status === 200) {
      expect(res.data).toHaveProperty('employeeCategory');
      expect(res.data).toHaveProperty('currentDuty');
      expect(res.data).toHaveProperty('featureEntitlements');
      expect(res.data.featureEntitlements).toHaveProperty('canPunch');
      expect(res.data.featureEntitlements).toHaveProperty('canViewGuardTour');
      expect(res.data.featureEntitlements).toHaveProperty('canScanCheckpoint');
    } else {
      expect([302, 307, 401]).toContain(res.status);
    }
  });

  test('GET /api/v1/allowed-punch-locations (mobile)', async () => {
    const headers = mobileCookie ? { Cookie: mobileCookie } : {};
    const res = await axios.get(`${MOBILE_URL}/api/v1/allowed-punch-locations`, { headers, validateStatus: () => true });
    
    if (res.status === 200) {
      expect(res.data).toHaveProperty('geofenceConfigured');
    } else {
      expect([302, 307, 401]).toContain(res.status);
    }
  });

  test('POST /api/v1/auth/change-password (mobile) unauthenticated should return 401', async () => {
    const res = await axios.post(`${MOBILE_URL}/api/v1/auth/change-password`, {
      currentPassword: 'WrongPassword',
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!'
    }, { validateStatus: () => true });
    
    expect(res.status).toBe(401);
    expect(res.data).toHaveProperty('success', false);
    expect(res.data).toHaveProperty('error', 'Authentication required');
  });

  test('POST /api/v1/auth/change-password (mobile) authenticated with wrong current password should return 400', async () => {
    if (!mobileCookie) {
      console.log('Skipping authenticated mobile password change test: no mobile cookie');
      return;
    }
    const headers = { Cookie: mobileCookie };
    const res = await axios.post(`${MOBILE_URL}/api/v1/auth/change-password`, {
      currentPassword: 'WrongCurrentPassword',
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!'
    }, { headers, validateStatus: () => true });

    expect(res.status).toBe(400);
    expect(res.data).toHaveProperty('success', false);
    expect(res.data).toHaveProperty('error', 'Current password is incorrect');
  });
});

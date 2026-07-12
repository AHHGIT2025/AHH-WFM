import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests must complete under 1s
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
  },
};

const WEB_URL = __ENV.WEB_BASE_URL || 'http://localhost:3100';
const MOBILE_URL = __ENV.MOBILE_BASE_URL || 'http://localhost:3101';

export default function () {
  // 1. GET /api/v1/employees (public/guard check)
  const resEmployees = http.get(`${WEB_URL}/api/v1/employees`);
  check(resEmployees, {
    'employees status is 200 or 401/307': (r) => [200, 302, 307, 401].includes(r.status),
  });

  // 2. GET /api/v1/security/reliever-pools
  const resRelievers = http.get(`${WEB_URL}/api/v1/security/reliever-pools`);
  check(resRelievers, {
    'reliever-pools status is 200 or 401/307': (r) => [200, 302, 307, 401].includes(r.status),
  });

  // 3. GET /api/v1/allowed-punch-locations (mobile)
  const resLocations = http.get(`${MOBILE_URL}/api/v1/allowed-punch-locations`);
  check(resLocations, {
    'allowed-locations status is 200 or 401/307': (r) => [200, 302, 307, 401].includes(r.status),
  });

  sleep(1);
}

// hardening-campana T4.1 — pruebas de carga y saturación del alta de firmas (k6).
//
// SOLO contra STAGING (nunca producción ni forms-qsm). Datos sintéticos: nombre "LoadTest …",
// correo @loadtest.invalid. Ver loadtest/README.md para el entorno, la limpieza y los umbrales.
//
//   k6 run -e BASE_URL=http://staging:8011 -e CAMPAIGN_ID=<uuid> -e SCENARIO=ramp loadtest/signatures.js
//
// SCENARIO: smoke | nominal | ramp | spike | simultaneous | race | soak | read | abuse
//   nominal   = carga esperada (OBLIGATORIA): 1 firma/s sostenida + ráfaga de 10/s (≈ 3 000 firmas/hora)
//   simultaneous = pico: 100 envíos a la vez (R7)   |   ramp, spike, soak = estrés exploratorio (sin pasa/falla de capacidad)
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:8011').replace(/\/$/, '');
const CAMPAIGN = __ENV.CAMPAIGN_ID;
const SLUG = __ENV.CAMPAIGN_SLUG || '';
const SCENARIO = __ENV.SCENARIO || 'smoke';
const API = `${BASE}/v1/public-campaign`;
// En staging se golpea la API directo: X-Real-IP aleatorio simula clientes distintos (el límite de
// 5/min es por IP). Con RANDOM_IP=0 se usa la IP real de la máquina de pruebas.
const RANDOM_IP = (__ENV.RANDOM_IP || '1') === '1';

function randomIntBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const created201 = new Counter('signatures_created');
export const dup409 = new Counter('signatures_duplicate');
export const limited429 = new Counter('rate_limited');
export const server5xx = new Counter('server_errors');

http.setResponseCallback(http.expectedStatuses(200, 201, 204, 302, 409, 422, 429));

const PROFILES = {
  smoke: { executor: 'constant-vus', vus: 2, duration: '1m', exec: 'smokeFlow' },
  // Carga NOMINAL esperada: 1 firma/s durante NOMINAL_MINUTES (30) y una ráfaga de 10/s durante BURST_MINUTES (5).
  nominal: {
    executor: 'ramping-arrival-rate', startRate: 1, timeUnit: '1s', preAllocatedVUs: 20, maxVUs: 100,
    stages: [
      { target: 1, duration: `${__ENV.NOMINAL_MINUTES || 30}m` },
      { target: 10, duration: '30s' },
      { target: 10, duration: `${__ENV.BURST_MINUTES || 5}m` },
    ],
    exec: 'signFlow',
  },
  ramp: {
    executor: 'ramping-arrival-rate', startRate: 1, timeUnit: '1s', preAllocatedVUs: 50, maxVUs: 400,
    stages: [{ target: 10, duration: '3m' }, { target: 30, duration: '4m' }, { target: 30, duration: '3m' }],
    exec: 'signFlow',
  },
  spike: {
    executor: 'ramping-arrival-rate', startRate: 2, timeUnit: '1s', preAllocatedVUs: 100, maxVUs: 600,
    stages: [{ target: 2, duration: '1m' }, { target: 100, duration: '30s' }, { target: 100, duration: '2m' },
             { target: 2, duration: '30s' }, { target: 2, duration: '2m' }],
    exec: 'signFlow',
  },
  simultaneous: { executor: 'shared-iterations', vus: 100, iterations: 100, maxDuration: '2m', exec: 'signFlow' },
  race: { executor: 'shared-iterations', vus: 30, iterations: 30, maxDuration: '1m', exec: 'raceFlow' },
  soak: {
    executor: 'constant-arrival-rate', rate: 5, timeUnit: '1s', duration: __ENV.SOAK_DURATION || '2h',
    preAllocatedVUs: 30, maxVUs: 120, exec: 'signFlow',
  },
  read: { executor: 'constant-vus', vus: 300, duration: '3m', exec: 'readFlow' },
  abuse: { executor: 'constant-vus', vus: 3, duration: '1m', exec: 'abuseFlow' },
};

export const options = {
  scenarios: { [SCENARIO]: PROFILES[SCENARIO] },
  thresholds: {
    'http_req_duration{name:signature}': ['p(95)<1500'],
    'http_req_duration{name:read}': ['p(95)<800'],
    server_errors: ['count==0'],
    ...(SCENARIO === 'race' ? { signatures_created: ['count==1'] } : {}),
    ...(SCENARIO === 'abuse' ? { rate_limited: ['count>0'] } : {}),
  },
};

// Cédula ecuatoriana válida (provincia 17, módulo 10).
function cedula() {
  const d = [1, 7, randomIntBetween(0, 5)];
  for (let i = 3; i < 9; i++) d.push(randomIntBetween(0, 9));
  let sum = 0;
  d.forEach((n, i) => { let p = n * (i % 2 === 0 ? 2 : 1); if (p > 9) p -= 9; sum += p; });
  return d.join('') + ((10 - (sum % 10)) % 10);
}

function ip() {
  return `${randomIntBetween(11, 223)}.${randomIntBetween(0, 255)}.${randomIntBetween(0, 255)}.${randomIntBetween(1, 254)}`;
}

function headers(fixedIp) {
  const h = { 'Content-Type': 'application/json' };
  if (fixedIp) h['X-Real-IP'] = fixedIp;
  else if (RANDOM_IP) h['X-Real-IP'] = ip();
  return h;
}

function payload(email, ced) {
  return JSON.stringify({
    signer_type: 'natural', name: `LoadTest ${__VU}-${__ITER}`, email, cedula: ced,
    location_mode: 'nacional', provincia: 'Pichincha', visibility: 'anon', consent: true,
    subscribe_newsletter: false, cf_turnstile_token: 'loadtest',
  });
}

function sign(email, ced, fixedIp) {
  const res = http.post(`${API}/${CAMPAIGN}/signatures`, payload(email, ced), {
    headers: headers(fixedIp), tags: { name: 'signature' },
  });
  if (res.status === 201) created201.add(1);
  else if (res.status === 409) dup409.add(1);
  else if (res.status === 429) limited429.add(1);
  else if (res.status >= 500 || res.status === 0) server5xx.add(1);
  return res;
}

export function smokeFlow() {
  signFlow();
  sleep(1);
}

export function signFlow() {
  const res = sign(`lt-${__VU}-${__ITER}-${Date.now()}@loadtest.invalid`, cedula());
  check(res, { 'alta aceptada o controlada': (r) => [201, 409, 422, 429].includes(r.status) });
}

// Misma persona, muchas peticiones a la vez: debe crearse exactamente 1 firma.
export function raceFlow() {
  sign('lt-race@loadtest.invalid', '1710034065');
}

export function readFlow() {
  const calls = [`${API}/${CAMPAIGN}`, `${API}/${CAMPAIGN}/signatures/recent`];
  if (SLUG) calls.push(`${API}/by-slug/${SLUG}`);
  const res = http.batch(calls.map((u) => ['GET', u, null, { headers: headers(), tags: { name: 'read' } }]));
  res.forEach((r) => { if (r.status >= 500 || r.status === 0) server5xx.add(1); });
}

// Una sola IP insistiendo: tiene que aparecer 429.
export function abuseFlow() {
  sign(`lt-abuse-${__VU}-${__ITER}-${Date.now()}@loadtest.invalid`, cedula(), '203.0.113.77');
}

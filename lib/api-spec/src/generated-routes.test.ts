import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { GetAnalyticsOverviewQueryParams } from '../../api-zod/src/generated/api.ts';

const generatedClient = readFileSync(
  new URL('../../api-client-react/src/generated/api.ts', import.meta.url),
  'utf8',
);

function operationSource(operationName: string): string {
  const start = generatedClient.indexOf(`export const ${operationName}`);
  assert.notEqual(start, -1, `No se generó ${operationName}`);
  return generatedClient.slice(start, start + 300);
}

test('las operaciones sensibles conservan su ruta OpenAPI', () => {
  assert.match(operationSource('getUpdateExchangeRateUrl'), /\/api\/exchange-rate/);
  assert.match(operationSource('getAdminLogoutUrl'), /\/api\/auth\/logout/);
  assert.match(operationSource('getUploadProductImagesUrl'), /\/api\/uploads/);
});

test('el rango de Analytics acepta fechas ISO reales', () => {
  assert.equal(
    GetAnalyticsOverviewQueryParams.safeParse({
      from: '2026-08-01',
      to: '2026-08-05',
    }).success,
    true,
  );
  assert.equal(
    GetAnalyticsOverviewQueryParams.safeParse({
      from: '01/08/2026',
      to: '05/08/2026',
    }).success,
    false,
  );
});

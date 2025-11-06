#!/usr/bin/env node

import assert from 'node:assert/strict';

const gatewayBaseCandidates = [
  process.env.GATEWAY_BASE,
  process.env.SMOKE_GIFTS_BASE,
  'http://gateway:80',
]
  .filter(Boolean)
  .map((base) => base.replace(/\/+$/, ''));

let resolvedGatewayBase;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function httpJson(method, path, body) {
  const basesToTry = resolvedGatewayBase
    ? [resolvedGatewayBase]
    : gatewayBaseCandidates.length > 0
      ? gatewayBaseCandidates
      : ['http://localhost:4000'];

  let lastError;

  for (const base of basesToTry) {
    const finalBase = base.replace(/\/+$/, '');
    const ensuredPath = path.startsWith('/') ? path : `/${path}`;
    const prefixedPath = `/api/fundraising${ensuredPath}`;
    const init = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body !== undefined) {
      init.body = JSON.stringify(body);
    } else if (method === 'PATCH') {
      init.body = '{}';
    }
    const url = `${finalBase}${prefixedPath}`;

    let response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      console.warn(`Request failed for base ${base}: ${error}`);
      lastError = error;
      if (resolvedGatewayBase === base) {
        resolvedGatewayBase = undefined;
      }
      continue;
    }

    const text = await response.text();

    let parsed;
    try {
      parsed = text ? JSON.parse(text) : undefined;
    } catch (error) {
      console.error('Failed to parse response body:', text);
      throw error;
    }

    if (!response.ok) {
      console.error('Request failed', {
        method,
        url,
        status: response.status,
        statusText: response.statusText,
        body,
        response: parsed,
      });
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    if (resolvedGatewayBase !== base) {
      resolvedGatewayBase = base;
      console.log(`Using fundraising gateway at ${base}`);
    }

    return parsed;
  }

  throw lastError ?? new Error('Unable to reach fundraising gateway');
}

async function main() {
  console.log('--- Gift staging manual processing flow ---');
  const uniqueSuffix = Date.now();
  console.log('\n--- Appeals API smoke ---');
  const appealName = `Smoke Test Appeal ${uniqueSuffix}`;
  const createAppealResponse = await httpJson('POST', '/appeals', {
    name: appealName,
    appealType: 'email',
    startDate: new Date().toISOString().slice(0, 10),
  });
  const createdAppeal = createAppealResponse?.data?.createAppeal;
  assert(createdAppeal?.id, 'createAppeal payload missing id');
  console.log(`Appeal created with id ${createdAppeal.id}`);

  const listAppealsResponse = await httpJson('GET', '/appeals?limit=20');
  const appeals = listAppealsResponse?.data?.appeals;
  assert(Array.isArray(appeals), 'appeals list response missing array');
  assert(
    appeals.some((appeal) => appeal?.id === createdAppeal.id),
    'created appeal not returned in list',
  );

  const updateAppealResponse = await httpJson('PATCH', `/appeals/${createdAppeal.id}`, {
    description: 'Smoke test appeal updated',
  });
  const updatedAppeal = updateAppealResponse?.data?.updateAppeal;
  assert(updatedAppeal?.id === createdAppeal.id, 'updateAppeal response id mismatch');

  const snapshotResponse = await httpJson(
    'POST',
    `/appeals/${createdAppeal.id}/solicitation-snapshots`,
    {
      countSolicited: 123,
      source: 'Smoke test send',
    },
  );
  const createdSnapshot = snapshotResponse?.data?.createSolicitationSnapshot;
  assert(createdSnapshot?.id, 'createSolicitationSnapshot payload missing id');

  const snapshotListResponse = await httpJson(
    'GET',
    `/appeals/${createdAppeal.id}/solicitation-snapshots`,
  );
  const snapshotList = snapshotListResponse?.data?.solicitationSnapshots;
  assert(Array.isArray(snapshotList), 'snapshot list response missing array');
  assert(
    snapshotList.some((snapshot) => snapshot?.id === createdSnapshot.id),
    'created snapshot not returned in list',
  );

  const stagedResponse = await httpJson('POST', '/gifts', {
    amount: { currencyCode: 'GBP', value: 15.5 },
    name: `Smoke Test Staged Gift ${uniqueSuffix}`,
    autoPromote: false,
    appealId: createdAppeal.id,
    contact: {
      firstName: 'Smoke',
      lastName: `Tester${uniqueSuffix}`,
      email: `smoketester+${uniqueSuffix}@example.org`,
    },
  });

  const stagedGift = stagedResponse?.data?.giftStaging;
  const stagedMeta = stagedResponse?.meta;
  assert(stagedMeta?.stagedOnly === true, 'expected stagedOnly meta flag');
  assert(stagedGift?.id, 'staged gift response missing id');

  console.log(`Staged gift row created with id ${stagedGift.id}`);

  const rawPayloadString = stagedMeta?.rawPayload ?? stagedGift.rawPayload;
  if (!rawPayloadString) {
    console.warn('Smoke test: staging response missing raw payload, continuing');
  }

  console.log('Marking staging row ready for manual processing');
  await httpJson('PATCH', `/gift-staging/${stagedGift.id}/status`, {
    promotionStatus: 'ready_for_commit',
    validationStatus: 'passed',
    dedupeStatus: 'passed',
    rawPayload: rawPayloadString,
  });

  const processResponse = await httpJson('POST', `/gift-staging/${stagedGift.id}/process`);
  console.log('Processing response:', processResponse);
  assert(processResponse?.status === 'committed', 'processing did not commit gift');
  assert(processResponse?.giftId, 'processing response missing giftId');

  const processedGiftId = processResponse.giftId;
  console.log(`Processing committed gift ${processedGiftId}`);

  const processedGiftResponse = await httpJson('GET', `/gifts/${processedGiftId}`);
  const processedGift = processedGiftResponse?.data?.gift;
  assert(processedGift?.id === processedGiftId, 'processed gift not retrievable');

  console.log('Cleaning up promoted gift');
  await httpJson('DELETE', `/gifts/${processedGiftId}`);

  console.log('✅ Staging processing smoke test succeeded');

  console.log('\n--- Gift proxy CRUD flow ---');
  console.log('Creating gift via fundraising-service → Twenty proxy');
  const createResponse = await httpJson('POST', '/gifts', {
    amount: { currencyCode: 'USD', value: 42 },
    name: 'Smoke Test Gift',
    autoPromote: true,
    appealId: createdAppeal.id,
  });

  const createdGift = createResponse?.data?.createGift;
  assert(createdGift, 'createGift payload missing');
  assert(uuidPattern.test(createdGift.id), 'gift id not a UUID');

  console.log(`Gift created with id ${createdGift.id}`);

  console.log('Listing gifts via proxy');
  const listResponse = await httpJson('GET', '/gifts');
  const gifts = listResponse?.data?.gifts;
  assert(Array.isArray(gifts), 'list response missing gifts array');
  assert(gifts.some((gift) => gift.id === createdGift.id), 'created gift not found in list');

  console.log('Fetching gift by id via proxy');
  const getResponse = await httpJson('GET', `/gifts/${createdGift.id}`);
  const fetchedGift = getResponse?.data?.gift;
  assert(fetchedGift?.id === createdGift.id, 'get response id mismatch');

  console.log('Updating gift via proxy');
  const updateResponse = await httpJson('PATCH', `/gifts/${createdGift.id}`, {
    name: 'Smoke Test Gift (Updated)',
  });
  const updatedGift = updateResponse?.data?.updateGift;
  assert(updatedGift?.id === createdGift.id, 'update response id mismatch');

  console.log('Deleting gift via proxy');
  const deleteResponse = await httpJson('DELETE', `/gifts/${createdGift.id}`);
  const deletedGift = deleteResponse?.data?.deleteGift;
  assert(deletedGift?.id === createdGift.id, 'delete response id mismatch');

  console.log('✅ Smoke test succeeded');

  console.log('\nCreating a persistent gift for UI verification');
  const persistentCreateResponse = await httpJson('POST', '/gifts', {
    amount: { currencyCode: 'EUR', value: 99 },
    name: 'Persistent Smoke Test Gift',
    autoPromote: true,
    appealId: createdAppeal.id,
  });

  const persistentGift = persistentCreateResponse?.data?.createGift;
  if (!persistentGift) {
    console.error(
      'Persistent gift create response:',
      JSON.stringify(persistentCreateResponse, null, 2),
    );
    throw new Error('persistent createGift payload missing');
  }
  assert(uuidPattern.test(persistentGift.id), 'persistent gift id not a UUID');

  console.log(`Persistent gift created with id ${persistentGift.id}`);
  console.log('Please verify this gift in the Twenty UI.');
}

main().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});

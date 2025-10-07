#!/usr/bin/env node

import assert from 'node:assert/strict';

const DEFAULT_GATEWAY_BASE =
  process.env.GATEWAY_BASE ?? process.env.SMOKE_GIFTS_BASE ?? 'http://gateway:4000/api/fundraising';

const GATEWAY_BASE = DEFAULT_GATEWAY_BASE;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function httpJson(method, path, body) {
  const url = `${GATEWAY_BASE}${path.startsWith('/') ? path : `/${path}`}`;

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

  const response = await fetch(url, init);
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

  return parsed;
}

async function main() {
  console.log('--- Gift staging manual processing flow ---');
  const uniqueSuffix = Date.now();
  const stagedResponse = await httpJson('POST', '/gifts', {
    amount: { currencyCode: 'GBP', value: 15.5 },
    name: `Smoke Test Staged Gift ${uniqueSuffix}`,
    autoPromote: false,
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

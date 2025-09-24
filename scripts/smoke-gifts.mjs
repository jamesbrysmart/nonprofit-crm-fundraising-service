#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const GATEWAY_BASE = process.env.GATEWAY_BASE ?? 'http://localhost:4000/api/fundraising';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function curlJson(method, path, body) {
  const url = `${GATEWAY_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const args = ['curl', '-sS', '-X', method, url, '-H', 'Content-Type: application/json'];

  if (body !== undefined) {
    args.push('-d', JSON.stringify(body));
  } else if (method === 'PATCH') {
    // curl sends an empty body for PATCH by default; explicitly provide {} so Twenty treats it as JSON
    args.push('-d', '{}');
  }

  const { stdout } = await execFileAsync(args[0], args.slice(1));

  try {
    return JSON.parse(stdout);
  } catch (error) {
    console.error('Failed to parse response body:', stdout);
    throw error;
  }
}

async function main() {
  console.log('Creating gift via fundraising-service → Twenty proxy');
  const createResponse = await curlJson('POST', '/gifts', {
    amount: { currencyCode: 'USD', value: 42 },
    name: 'Smoke Test Gift',
  });

  const createdGift = createResponse?.data?.createGift;
  assert(createdGift, 'createGift payload missing');
  assert(uuidPattern.test(createdGift.id), 'gift id not a UUID');

  console.log(`Gift created with id ${createdGift.id}`);

  console.log('Listing gifts via proxy');
  const listResponse = await curlJson('GET', '/gifts');
  const gifts = listResponse?.data?.gifts;
  assert(Array.isArray(gifts), 'list response missing gifts array');
  assert(gifts.some((gift) => gift.id === createdGift.id), 'created gift not found in list');

  console.log('Fetching gift by id via proxy');
  const getResponse = await curlJson('GET', `/gifts/${createdGift.id}`);
  const fetchedGift = getResponse?.data?.gift;
  assert(fetchedGift?.id === createdGift.id, 'get response id mismatch');

  console.log('Updating gift via proxy');
  const updateResponse = await curlJson('PATCH', `/gifts/${createdGift.id}`, {
    name: 'Smoke Test Gift (Updated)',
  });
  const updatedGift = updateResponse?.data?.updateGift;
  assert(updatedGift?.id === createdGift.id, 'update response id mismatch');

  console.log('Deleting gift via proxy');
  const deleteResponse = await curlJson('DELETE', `/gifts/${createdGift.id}`);
  const deletedGift = deleteResponse?.data?.deleteGift;
  assert(deletedGift?.id === createdGift.id, 'delete response id mismatch');

  console.log('✅ Smoke test succeeded');
}

main().catch((error) => {
  console.error('Smoke test failed:', error);
  process.exit(1);
});

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- Start Diagnostics ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const defaultEnvPath = path.resolve(__dirname, '..', '..', '..', '.env');
const envFilePath = process.env.TWENTY_ENV_PATH
  ? path.resolve(process.env.TWENTY_ENV_PATH)
  : defaultEnvPath;
console.log(`Script execution started.`);
console.log(`Script's absolute path: ${__filename}`);
console.log(`Script's dirname: ${__dirname}`);
console.log(`Calculated .env path: ${envFilePath}`);
console.log(`Current working directory (process.cwd()): ${process.cwd()}`);

const result = dotenv.config({ path: envFilePath, debug: true }); // Add debug for dotenv
if (result.error) {
  console.error('ERROR loading .env file:', result.error);
}
console.log('Dotenv parsed object:', result.parsed);
console.log(`TWENTY_API_KEY from process.env (after dotenv): ${process.env.TWENTY_API_KEY}`);
// --- End Diagnostics ---

const TWENTY_REST_METADATA_URL = process.env.TWENTY_METADATA_BASE_URL
  ? process.env.TWENTY_METADATA_BASE_URL.replace(/\/$/, '')
  : 'http://localhost:3000/rest/metadata';
const API_KEY = process.env.TWENTY_API_KEY;

async function restCall(method, endpoint, payload) {
  const url = `${TWENTY_REST_METADATA_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  const init = {
    method,
    headers,
  };

  if (payload !== undefined) {
    init.body = JSON.stringify(payload);
  }

  console.log(`Calling REST API: ${method} ${url} with payload:`, payload);

  const response = await fetch(url, init);
  const resultText = await response.text();
  let parsed;

  try {
    parsed = resultText ? JSON.parse(resultText) : {};
  } catch (parseError) {
    console.error('Failed to parse response body:', resultText);
    throw parseError;
  }

  if (!response.ok) {
    const messages = parsed?.messages || parsed?.message;
    const errorDetails = Array.isArray(messages) ? messages.join(', ') : messages;
    const customError = new Error(`REST API Error: ${errorDetails || response.statusText}`);
    customError.response = parsed;
    throw customError;
  }

  console.log('Success:', JSON.stringify(parsed, null, 2), '\n');
  return parsed;
}

async function findObjectByNameSingular(nameSingular) {
  const url = `${TWENTY_REST_METADATA_URL}/objects?filter[nameSingular]=${encodeURIComponent(nameSingular)}`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
  };

  console.log(`Finding object: ${nameSingular} via GET ${url}`);

  const response = await fetch(url, { method: 'GET', headers });
  const result = await response.json();

  if (!response.ok) {
    console.error(`Failed to find object ${nameSingular}:`);
    console.error(JSON.stringify(result, null, 2));
    const messages = result?.messages || result?.message;
    throw new Error(`REST API Error: ${messages || response.statusText}`);
  }

  if (result.data && result.data.objects && result.data.objects.length > 0) {
    console.log(`Found object ${nameSingular} with ID: ${result.data.objects[0].id}`);
    return result.data.objects[0].id;
  }
  return null;
}

async function ensureObject(objectData) {
  const existingId = await findObjectByNameSingular(objectData.nameSingular);
  if (existingId) {
    console.log(`Object ${objectData.nameSingular} already exists. Using ID ${existingId}.`);
    return existingId;
  }

  console.log(`Creating object: ${objectData.nameSingular}`);
  const response = await restCall('POST', '/objects', objectData);
  const createdId = response?.data?.createOneObject?.id;
  if (!createdId) {
    throw new Error(`Failed to create object ${objectData.nameSingular}; missing id in response`);
  }
  return createdId;
}

async function createField(fieldData) {
  console.log(`Creating field: ${fieldData.name} for object ID: ${fieldData.objectMetadataId}`);
  try {
    return await restCall('POST', '/fields', fieldData);
  } catch (error) {
    const messages = error.response?.messages;
    const messageList = Array.isArray(messages)
      ? messages
      : typeof messages === 'string'
        ? [messages]
        : [];
    if (messageList.includes('Field already exists')) {
      console.log(`Field ${fieldData.name} already exists. Skipping.`);
      return null;
    }
    throw error;
  }
}

async function main() {
  if (!API_KEY) {
    console.error('Error: TWENTY_API_KEY environment variable is not set.');
    process.exit(1);
  }

  console.log('--- Setting up Campaign Object ---');
  const campaignObjectId = await ensureObject({
    nameSingular: "campaign",
    namePlural: "campaigns",
    labelSingular: "Campaign",
    labelPlural: "Campaigns",
    icon: "IconTargetArrow",
    description: "A fundraising campaign to raise money for a specific purpose."
  });

  await createField({
    objectMetadataId: campaignObjectId,
    name: "StartDate",
    label: "Start Date",
    type: "DATE"
  });

  await createField({
    objectMetadataId: campaignObjectId,
    name: "EndDate",
    label: "End Date",
    type: "DATE"
  });

  console.log('--- Setting up Gift Object ---');
  const giftObjectId = await ensureObject({
    nameSingular: "gift",
    namePlural: "gifts",
    labelSingular: "Gift",
    labelPlural: "Gifts",
    icon: "IconGift",
    description: "A single donation made by a contact to a campaign."
  });

  await createField({
    objectMetadataId: giftObjectId,
    name: "Amount",
    label: "Amount",
    type: "CURRENCY"
  });

  await createField({
    objectMetadataId: giftObjectId,
    name: "Date",
    label: "Gift Date",
    type: "DATE"
  });

  console.log('--- Linking Objects (Manual Step Required) ---');
  console.log('NOTE: RELATION/LOOKUP fields cannot be created via API at this time.');
  console.log('Please create the following LOOKUP fields manually in the Twenty UI:');
  console.log('- For Gift object: "Campaign" (linking to Campaign object)');
  console.log('- For Gift object: "Contact" (linking to Person object)');

  console.log('✅ Twenty CRM custom objects and fields setup complete (manual steps for LOOKUP fields pending).');
}

main().catch(error => {
  console.error('\nScript failed:', error.message);
  process.exit(1);
});

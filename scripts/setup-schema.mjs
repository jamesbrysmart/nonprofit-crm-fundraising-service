import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// --- Start Diagnostics ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const localEnvPath = path.resolve(__dirname, '..', '.env');
const rootEnvPath = path.resolve(__dirname, '..', '..', '..', '.env');
const envCandidates = [
  process.env.TWENTY_ENV_PATH ? path.resolve(process.env.TWENTY_ENV_PATH) : null,
  localEnvPath,
  rootEnvPath,
].filter(Boolean);
const envFilePath = envCandidates[0];
console.log(`Script execution started.`);
console.log(`Script's absolute path: ${__filename}`);
console.log(`Script's dirname: ${__dirname}`);
console.log(`Calculated .env path: ${envFilePath}`);
console.log(`Current working directory (process.cwd()): ${process.cwd()}`);

let resolvedEnvPath = null;
for (const candidate of envCandidates) {
  const result = dotenv.config({ path: candidate, debug: true });
  if (result.error) {
    console.warn(`WARN: failed to load ${candidate}:`, result.error.message);
    continue;
  }
  resolvedEnvPath = candidate;
  console.log(`Dotenv parsed object from ${candidate}:`, result.parsed);
  if (process.env.TWENTY_API_KEY) {
    break;
  }
}
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
  const url = `${TWENTY_REST_METADATA_URL}/objects`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
  };

  console.log(`Fetching all objects to find: ${nameSingular}`);

  const response = await fetch(url, { method: 'GET', headers });
  const result = await response.json();

  if (!response.ok) {
    console.error(`Failed to fetch objects:`);
    console.error(JSON.stringify(result, null, 2));
    const messages = result?.messages || result?.message;
    throw new Error(`REST API Error: ${messages || response.statusText}`);
  }

  if (result.data && result.data.objects) {
    const foundObject = result.data.objects.find(obj => obj.nameSingular === nameSingular);
    if (foundObject) {
      console.log(`Found object ${nameSingular} with ID: ${foundObject.id}`);
      return foundObject.id;
    }
  }
  
  console.log(`Object ${nameSingular} not found.`);
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
    if (messageList.some(msg => msg.includes('Field already exists') || msg.includes('is not available'))) {
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
    name: "startDate",
    label: "Start Date",
    type: "DATE"
  });

  await createField({
    objectMetadataId: campaignObjectId,
    name: "endDate",
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

  const giftFields = [
    { name: "amount", label: "Amount", type: "CURRENCY" },
    { name: "date", label: "Gift Date", type: "DATE" },
    { name: "donorFirstName", label: "Donor First Name", type: "TEXT" },
    { name: "donorLastName", label: "Donor Last Name", type: "TEXT" },
    { name: "donorEmail", label: "Donor Email", type: "TEXT" },
    { name: "provider", label: "Provider", type: "TEXT" },
    { name: "providerPaymentId", label: "Provider Payment ID", type: "TEXT" },
    { name: "intakeSource", label: "Intake Source", type: "TEXT" },
    { name: "recurringStatus", label: "Recurring Status Snapshot", type: "TEXT" },
    { name: "recurringMetadata", label: "Recurring Metadata", type: "RAW_JSON" },
  ];

  for (const field of giftFields) {
    await createField({
      objectMetadataId: giftObjectId,
      name: field.name,
      label: field.label,
      type: field.type,
    });
  }

  console.log('--- Ensuring Person Rollup Fields ---');
  const personObjectId = await findObjectByNameSingular('person');
  if (!personObjectId) {
    throw new Error('Unable to locate core Person object via metadata API; cannot create rollup fields.');
  }

  const personRollupFields = [
    { name: 'lifetimeGiftAmount', label: 'Lifetime Gift Amount', type: 'CURRENCY' },
    { name: 'lifetimeGiftCount', label: 'Lifetime Gift Count', type: 'NUMBER' },
    { name: 'lastGiftDate', label: 'Last Gift Date', type: 'DATE' },
    { name: 'firstGiftDate', label: 'First Gift Date', type: 'DATE' },
    { name: 'yearToDateGiftAmount', label: 'Year-To-Date Gift Amount', type: 'CURRENCY' },
    { name: 'yearToDateGiftCount', label: 'Year-To-Date Gift Count', type: 'NUMBER' },
  ];

  for (const field of personRollupFields) {
    await createField({
      objectMetadataId: personObjectId,
      name: field.name,
      label: field.label,
      type: field.type,
    });
  }

  console.log('--- Setting up Gift Staging Object ---');
  const giftStagingObjectId = await ensureObject({
    nameSingular: 'giftStaging',
    namePlural: 'giftStagings',
    labelSingular: 'Gift Staging',
    labelPlural: 'Gift Stagings',
    icon: 'IconInbox',
    description: 'Temporary staging record for gifts prior to commit.',
  });

  const giftStagingFields = [
    { name: 'source', label: 'Source', type: 'TEXT' },
    { name: 'intakeSource', label: 'Intake Source', type: 'TEXT' },
    { name: 'sourceFingerprint', label: 'Source Fingerprint', type: 'TEXT' },
    { name: 'externalId', label: 'External ID', type: 'TEXT' },
    { name: 'amount', label: 'Amount', type: 'CURRENCY' },
    { name: 'amountMinor', label: 'Amount (minor units)', type: 'NUMBER' },
    { name: 'paymentMethod', label: 'Payment Method', type: 'TEXT' },
    { name: 'dateReceived', label: 'Date Received', type: 'DATE' },
    { name: 'expectedAt', label: 'Expected At', type: 'DATE' },
    { name: 'validationStatus', label: 'Validation Status', type: 'TEXT' },
    { name: 'dedupeStatus', label: 'Dedupe Status', type: 'TEXT' },
    { name: 'promotionStatus', label: 'Promotion Status', type: 'TEXT' },
    { name: 'autoPromote', label: 'Auto Promote', type: 'BOOLEAN' },
    { name: 'giftAidEligible', label: 'Gift Aid Eligible', type: 'BOOLEAN' },
    { name: 'giftBatchId', label: 'Gift Batch ID', type: 'TEXT' },
    { name: 'provider', label: 'Provider', type: 'TEXT' },
    { name: 'providerPaymentId', label: 'Provider Payment ID', type: 'TEXT' },
    { name: 'providerContext', label: 'Provider Context', type: 'RAW_JSON' },
    { name: 'donorFirstName', label: 'Donor First Name', type: 'TEXT' },
    { name: 'donorLastName', label: 'Donor Last Name', type: 'TEXT' },
    { name: 'donorEmail', label: 'Donor Email', type: 'TEXT' },
    { name: 'notes', label: 'Notes', type: 'TEXT' },
    { name: 'errorDetail', label: 'Error Detail', type: 'RAW_JSON' },
    { name: 'rawPayload', label: 'Raw Payload', type: 'RAW_JSON' },
  ];

  for (const field of giftStagingFields) {
    await createField({
      objectMetadataId: giftStagingObjectId,
      name: field.name,
      label: field.label,
      type: field.type,
    });
  }

  console.log('--- Setting up Recurring Agreement Object ---');
  const recurringAgreementObjectId = await ensureObject({
    nameSingular: 'recurringAgreement',
    namePlural: 'recurringAgreements',
    labelSingular: 'Recurring Agreement',
    labelPlural: 'Recurring Agreements',
    icon: 'IconRepeat',
    description: 'Represents a donor’s recurring commitment (amount, cadence, defaults, provider linkage).',
  });

  const recurringAgreementFields = [
    { name: 'status', label: 'Status', type: 'TEXT' },
    { name: 'cadence', label: 'Cadence', type: 'TEXT' },
    { name: 'intervalCount', label: 'Interval Count', type: 'NUMBER' },
    { name: 'amountMinor', label: 'Amount (minor units)', type: 'NUMBER' },
    { name: 'currency', label: 'Currency', type: 'TEXT' },
    { name: 'startDate', label: 'Start Date', type: 'DATE' },
    { name: 'endDate', label: 'End Date', type: 'DATE' },
    { name: 'nextExpectedAt', label: 'Next Expected At', type: 'DATE' },
    { name: 'autoPromoteEnabled', label: 'Auto Promote Enabled', type: 'BOOLEAN' },
    { name: 'defaultCampaignId', label: 'Default Campaign ID', type: 'TEXT' },
    { name: 'defaultFundId', label: 'Default Fund ID', type: 'TEXT' },
    { name: 'defaultSoftCreditJson', label: 'Default Soft Credit JSON', type: 'RAW_JSON' },
    { name: 'giftAidDeclarationId', label: 'Gift Aid Declaration ID', type: 'TEXT' },
    { name: 'provider', label: 'Provider', type: 'TEXT' },
    { name: 'providerAgreementId', label: 'Provider Agreement ID', type: 'TEXT' },
    { name: 'providerPaymentMethodId', label: 'Provider Payment Method ID', type: 'TEXT' },
    { name: 'mandateReference', label: 'Mandate Reference', type: 'TEXT' },
    { name: 'providerContext', label: 'Provider Context', type: 'RAW_JSON' },
    { name: 'source', label: 'Source', type: 'TEXT' },
    { name: 'canceledAt', label: 'Canceled At', type: 'DATE_TIME' },
    { name: 'completedAt', label: 'Completed At', type: 'DATE_TIME' },
    { name: 'statusUpdatedAt', label: 'Status Updated At', type: 'DATE_TIME' },
  ];

  for (const field of recurringAgreementFields) {
    await createField({
      objectMetadataId: recurringAgreementObjectId,
      name: field.name,
      label: field.label,
      type: field.type,
    });
  }

  console.log('--- Linking Objects (Manual Step Required) ---');
  console.log('NOTE: RELATION/LOOKUP fields cannot be created via API at this time.');
  console.log('Please create the following LOOKUP fields manually in the Twenty UI:');
  console.log('- For Gift object: "Campaign" (linking to Campaign object)');
  console.log('- For Gift object: "Contact" (linking to Person object)');
  console.log('- For Gift object: "Recurring Agreement" (linking to Recurring Agreement object)');
  console.log('- For Gift Staging object: "Gift" (linking to Gift object)');
  console.log('- For Gift Staging object: "Gift Batch" (linking to Gift Batch object, optional)');
  console.log('- For Gift Staging object: "Recurring Agreement" (linking to Recurring Agreement object)');
  console.log('- For Recurring Agreement object: "Contact" (linking to Person object)');

  console.log('✅ Twenty CRM custom objects and fields setup complete (manual steps for LOOKUP fields pending).');
}

main().catch(error => {
  console.error('\nScript failed:', error.message);
  process.exit(1);
});

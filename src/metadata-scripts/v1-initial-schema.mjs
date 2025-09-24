import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path'; // Need path for resolve
import { fileURLToPath } from 'url'; // Need for __filename, __dirname
import { dirname } from 'path'; // Need for dirname

// --- Start Diagnostics ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envFilePath = path.join(__dirname, '..', '..', '..', '..', '.env'); // Corrected path from script to dev-stack root
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

const TWENTY_REST_METADATA_URL = 'http://localhost:3000/rest/metadata'; // Changed to REST Metadata API
const API_KEY = process.env.TWENTY_API_KEY;

async function restCall(method, endpoint, payload) {
  const url = `${TWENTY_REST_METADATA_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  const init = {
    method: method,
    headers: headers,
    body: JSON.stringify(payload),
  };

  console.log(`Calling REST API: ${method} ${url} with payload:`, payload);

  const response = await fetch(url, init);
  const result = await response.json();

  if (!response.ok) {
    const customError = new Error(`REST API Error: ${result.message || response.statusText}`);
    customError.response = result; // Attach the full result for inspection
    throw customError;
  }

  console.log('Success:', JSON.stringify(result, null, 2), '\n');
  return result;
}

async function findObjectByNameSingular(nameSingular) {
  const url = `${TWENTY_REST_METADATA_URL}/objects?filter[nameSingular]=${nameSingular}`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
  };

  console.log(`Finding object: ${nameSingular} via GET ${url}`);

  const response = await fetch(url, { method: 'GET', headers });
  const result = await response.json();

  if (!response.ok) {
    console.error(`Failed to find object ${nameSingular}:`);
    console.error(JSON.stringify(result, null, 2));
    throw new Error(`REST API Error: ${result.message || response.statusText}`);
  }

  if (result.data && result.data.objects && result.data.objects.length > 0) {
    console.log(`Found object ${nameSingular} with ID: ${result.data.objects[0].id}`);
    return result.data.objects[0].id;
  }
  return null;
}

async function createObject(objectData) {
  console.log(`Creating object: ${objectData.nameSingular}`);
  try {
    const response = await restCall('POST', '/objects', objectData);
    return response; // This will have the id if created
  } catch (error) {
    if (error.response && error.response.messages && error.response.messages.includes('Object already exists')) {
      console.log(`Object ${objectData.nameSingular} already exists. Skipping field creation for this object.`);
      return null; // Return null if object already exists
    }
    throw error;
  }
}

async function createField(fieldData) {
  console.log(`Creating field: ${fieldData.name} for object ID: ${fieldData.objectMetadataId}`);
  return restCall('POST', '/fields', fieldData);
}

async function main() {
  if (!API_KEY) {
    console.error('Error: TWENTY_API_KEY environment variable is not set.');
    process.exit(1);
  }

  console.log('--- Setting up Campaign Object ---');
  const campaignObject = await createObject({
    nameSingular: "campaign",
    namePlural: "campaigns",
    labelSingular: "Campaign",
    labelPlural: "Campaigns",
    icon: "IconTargetArrow",
    description: "A fundraising campaign to raise money for a specific purpose."
  });

  if (campaignObject) { // Only create fields if object was created or found
    const campaignObjectId = campaignObject.data.createOneObject.id;

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
  } else {
    console.log('Skipping field creation for Campaign as object already existed.');
  }

  console.log('--- Setting up Gift Object ---');
  const giftObject = await createObject({
    nameSingular: "gift",
    namePlural: "gifts",
    labelSingular: "Gift",
    labelPlural: "Gifts",
    icon: "IconGift",
    description: "A single donation made by a contact to a campaign."
  });

  if (giftObject) { // Only create fields if object was created or found
    const giftObjectId = giftObject.data.createOneObject.id;

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
  } else {
    console.log('Skipping field creation for Gift as object already existed.');
  }

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

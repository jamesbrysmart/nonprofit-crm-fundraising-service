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

const TWENTY_API_URL = 'http://localhost:3000/graphql';
const API_KEY = process.env.TWENTY_API_KEY;

const CREATE_OBJECT_MUTATION = `
  mutation CreateOneObjectMetadataItem($input: CreateOneObjectInput!) {
    createOneObject(input: $input) {
      id
      nameSingular
    }
  }
`;

const CREATE_FIELD_MUTATION = `
  mutation CreateOneFieldMetadataItem($input: CreateOneFieldInput!) {
    createOneField(input: $input) {
      id
      name
      label
    }
  }
`;

async function callApi(query, variables = {}) {
  const response = await fetch(TWENTY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  if (result.errors) {
    // If the error is that it already exists, we can consider it a success for idempotency
    const alreadyExistsError = result.errors.find(e => e.message?.includes('already exists'));
    if (alreadyExistsError) {
      console.log(`Skipped: ${alreadyExistsError.message}`);
      return result; 
    }
    
    console.error('API call failed:');
    console.error(JSON.stringify(result, null, 2));
    throw new Error(`GraphQL API Error: ${result.errors?.[0]?.message || response.statusText}`);
  }

  console.log('Success:', JSON.stringify(result.data, null, 2), '\n');
  return result;
}

async function main() {
  if (!API_KEY) {
    console.error('Error: TWENTY_API_KEY environment variable is not set.');
    process.exit(1);
  }

  console.log('--- Setting up Campaign Object ---');
  await callApi(CREATE_OBJECT_MUTATION, {
    input: {
      nameSingular: "Campaign",
      namePlural: "Campaigns",
      labelSingular: "Campaign",
      labelPlural: "Campaigns",
      icon: "IconTargetArrow",
      description: "A fundraising campaign to raise money for a specific purpose."
    }
  });

  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Campaign" } },
      name: "StartDate",
      label: "Start Date",
      type: "DATE"
    }
  });

  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Campaign" } },
      name: "EndDate",
      label: "End Date",
      type: "DATE"
    }
  });

  console.log('--- Setting up Gift Object ---');
  await callApi(CREATE_OBJECT_MUTATION, {
    input: {
      nameSingular: "Gift",
      namePlural: "Gifts",
      labelSingular: "Gift",
      labelPlural: "Gifts",
      icon: "IconGift",
      description: "A single donation made by a contact to a campaign."
    }
  });

  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Gift" } },
      name: "Amount",
      label: "Amount",
      type: "CURRENCY"
    }
  });

  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Gift" } },
      name: "Date",
      label: "Gift Date",
      type: "DATE"
    }
  });

  console.log('--- Linking Objects ---');
  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Gift" } },
      name: "Campaign",
      label: "Campaign",
      type: "LOOKUP",
      lookup: { object: { connect: { nameSingular: "Campaign" } } }
    }
  });

  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Gift" } },
      name: "Contact",
      label: "Contact",
      type: "LOOKUP",
      lookup: { object: { connect: { nameSingular: "person" } } } // NOTE: The internal name for Contact is 'person'
    }
  });

  console.log('✅ Twenty CRM custom objects and fields setup complete.');
}

main().catch(error => {
  console.error('\nScript failed:', error.message);
  process.exit(1);
});

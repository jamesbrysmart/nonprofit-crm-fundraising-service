import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import fetch from 'node-fetch';

// It's good practice to source configuration from environment variables.
const TWENTY_API_URL = 'http://localhost:3000/graphql';
const API_KEY = process.env.TWENTY_API_KEY;

const CREATE_OBJECT_MUTATION = `
  mutation CreateOneObjectMetadataItem($input: CreateOneObjectInput!) {
    createOneObject(input: $input) {
      id
      dataSourceId
      nameSingular
      namePlural
      labelSingular
      labelPlural
      description
      icon
      isCustom
      isActive
      isSearchable
      createdAt
      updatedAt
      labelIdentifierFieldMetadataId
      imageIdentifierFieldMetadataId
      isLabelSyncedWithName
      __typename
    }
  }
`;

const CREATE_FIELD_MUTATION = `
  mutation CreateOneFieldMetadataItem($input: CreateOneFieldInput!) {
    createOneField(input: $input) {
      id
      name
      label
      type
      object {
        id
        nameSingular
      }
      lookup {
        object {
          id
          nameSingular
        }
      }
      __typename
    }
  }
`;

async function callApi(query, variables = {}) {
  console.log(`Executing: ${query}`);
  const response = await fetch(TWENTY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  const result = await response.json();

  // Check for both network-level errors and GraphQL-level errors.
  if (!response.ok || result.errors) {
    console.error('API call failed:');
    console.error(JSON.stringify(result, null, 2));
    // Throw an error to stop the script execution.
    throw new Error(`GraphQL API Error: ${result.errors?.[0]?.message || response.statusText}`);
  }

  console.log('Success:', JSON.stringify(result, null, 2), '\n');
  return result;
}

async function main() {
  // Fail fast if the API key is not provided.
  if (!API_KEY) {
    console.error('Error: TWENTY_API_KEY environment variable is not set.');
    process.exit(1);
  }

  console.log('Creating Custom Object: Campaign__c');
  await callApi(CREATE_OBJECT_MUTATION, {
    input: {
      nameSingular: "Campaign",
      namePlural: "Campaigns",
      labelSingular: "Campaign",
      labelPlural: "Campaigns",
      description: "A fundraising campaign to raise money for a specific purpose."
    }
  });

  console.log('Adding fields to Campaign__c...');
  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Campaign" } },
      name: "StartDate__c",
      label: "Start Date",
      type: "DATE"
    }
  });
  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Campaign" } },
      name: "EndDate__c",
      label: "End Date",
      type: "DATE"
    }
  });
  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Campaign" } },
      name: "GoalAmount__c",
      label: "Goal Amount",
      type: "CURRENCY"
    }
  });

  console.log('Creating Custom Object: Gift__c');
  await callApi(CREATE_OBJECT_MUTATION, {
    input: {
      nameSingular: "Gift",
      namePlural: "Gifts",
      labelSingular: "Gift",
labelPlural: "Gifts",
      description: "A single donation made by a contact to a campaign."
    }
  });

  console.log('Adding fields to Gift__c...');
  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Gift" } },
      name: "Amount__c",
      label: "Amount",
      type: "CURRENCY"
    }
  });
  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Gift" } },
      name: "GiftDate__c",
      label: "Gift Date",
      type: "DATE"
    }
  });
  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Gift" } },
      name: "Campaign__c",
      label: "Campaign",
      type: "LOOKUP",
      lookup: { object: { connect: { nameSingular: "Campaign" } } }
    }
  });
  await callApi(CREATE_FIELD_MUTATION, {
    input: {
      object: { connect: { nameSingular: "Gift" } },
      name: "Contact__c",
      label: "Contact",
      type: "LOOKUP",
      lookup: { object: { connect: { nameSingular: "Contact" } } }
    }
  });

  console.log('✅ Twenty CRM custom objects and fields setup complete.');
}

main().catch(error => {
  console.error('Script failed:', error.message);
  process.exit(1);
});
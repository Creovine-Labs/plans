/**
 * Google Sheets Sync Utility
 * 
 * Usage:
 *   node sheets_sync.js create    → Create new spreadsheets
 *   node sheets_sync.js update    → Update from CSVs
 *   node sheets_sync.js status    → Show current sheet IDs
 * 
 * Service Account: yerinssaibs@personalfiles-496318.iam.gserviceaccount.com
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Config
const SERVICE_ACCOUNT_FILE = path.join(__dirname, 'google-service-account.json.json');
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive',
];

// Sheet tracking file
const SHEETS_CONFIG = path.join(__dirname, '.sheets_config.json');

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: SCOPES,
  });
  return auth.getClient();
}

function loadConfig() {
  if (fs.existsSync(SHEETS_CONFIG)) {
    return JSON.parse(fs.readFileSync(SHEETS_CONFIG, 'utf8'));
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(SHEETS_CONFIG, JSON.stringify(config, null, 2));
}

// No pre-defined outreach companies — Yerins will add them day by day.
// Each sheet starts with just headers.
const OUTREACH_HEADERS = [
  'Organization',
  'Contact Person',
  'Role/Title',
  'Phone',
  'Email',
  'Source (How Found)',
  'Outreach Method',
  'Date First Contacted',
  'Last Follow-Up Date',
  'Status',                // Not Started | In Progress | Done | Pending Follow-up | Rejected
  'Priority',             // High | Medium | Low
  'Notes / Last Action',
  'Next Action',
  'Next Action Deadline',
  'Pilot Opportunity?',   // Yes | No | Maybe
  'Deal Value Estimate',
];

const JOB_HEADERS = [
  'Company',
  'Role',
  'Location',
  'Job URL / Source',
  'Date Applied',
  'Application Method',    // Company Site | LinkedIn | Email | Referral | Other
  'Status',                // Not Started | Applied | Screening | Interview | Offer | Rejected | On Hold
  'Priority',              // High | Medium | Low
  'CV Version Used',       // Backend | Full-Stack
  'Cover Letter?',         // Yes | No
  'Follow-Up Date',
  'Contact Person',
  'Contact Email/Phone',
  'Notes',
  'Next Action',
  'Salary Range',
  'Referral Source',
];

async function createSpreadsheet(auth, title, headers) {
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  
  // Create file via Drive API (works with service accounts)
  const fileRes = await drive.files.create({
    resource: {
      name: title,
      mimeType: 'application/vnd.google-apps.spreadsheet',
    },
  });
  const spreadsheetId = fileRes.data.id;
  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Write headers via Sheets API
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Tracker!A1',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [headers] },
  });

  // Rename default sheet to "Tracker" and freeze header row
  const sheetMetadata = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetId = sheetMetadata.data.sheets[0].properties.sheetId;
  
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          updateSheetProperties: {
            properties: {
              sheetId,
              title: 'Tracker',
              gridProperties: { frozenRowCount: 1 },
            },
            fields: 'title,gridProperties.frozenRowCount',
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.13, green: 0.59, blue: 0.95, alpha: 1 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1, alpha: 1 } },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
      ],
    },
  });

  return { spreadsheetId, sheetUrl };
}

async function addDropdowns(auth, spreadsheetId, sheetId, colIndex, values) {
  const sheets = google.sheets({ version: 'v4', auth });
  const numRows = 500; // cover many rows

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          setDataValidation: {
            range: {
              sheetId,
              startRowIndex: 1,
              endRowIndex: numRows,
              startColumnIndex: colIndex,
              endColumnIndex: colIndex + 1,
            },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: values.map(v => ({ userEnteredValue: v })),
              },
              showCustomUi: true,
              strict: true,
            },
          },
        },
      ],
    },
  });
}

async function createSheets() {
  const auth = await getAuthClient();
  const config = loadConfig();

  console.log('Creating Brydg Outreach Tracker...');
  const outreachRes = await createSpreadsheet(auth, 'Brydg Outreach Tracker', OUTREACH_HEADERS);
  console.log(`  ✓ ${outreachRes.sheetUrl}`);

  // Add dropdown for Status (col 9, 0-indexed = column J = index 9)
  const statusIdxOut = OUTREACH_HEADERS.indexOf('Status');
  await addDropdowns(auth, outreachRes.spreadsheetId, 0, statusIdxOut, [
    'Not Started', 'In Progress', 'Done', 'Pending Follow-up', 'Rejected',
  ]);
  const priorityIdxOut = OUTREACH_HEADERS.indexOf('Priority');
  await addDropdowns(auth, outreachRes.spreadsheetId, 0, priorityIdxOut, ['High', 'Medium', 'Low']);
  const pilotIdxOut = OUTREACH_HEADERS.indexOf('Pilot Opportunity?');
  await addDropdowns(auth, outreachRes.spreadsheetId, 0, pilotIdxOut, ['Yes', 'No', 'Maybe']);

  console.log('Creating Job Applications Tracker...');
  const jobRes = await createSpreadsheet(auth, 'Job Applications Tracker', JOB_HEADERS);
  console.log(`  ✓ ${jobRes.sheetUrl}`);

  const statusIdxJob = JOB_HEADERS.indexOf('Status');
  await addDropdowns(auth, jobRes.spreadsheetId, 0, statusIdxJob, [
    'Not Started', 'Applied', 'Screening', 'Interview', 'Offer', 'Rejected', 'On Hold',
  ]);
  const priorityIdxJob = JOB_HEADERS.indexOf('Priority');
  await addDropdowns(auth, jobRes.spreadsheetId, 0, priorityIdxJob, ['High', 'Medium', 'Low']);
  const cvIdxJob = JOB_HEADERS.indexOf('CV Version Used');
  await addDropdowns(auth, jobRes.spreadsheetId, 0, cvIdxJob, ['Backend', 'Full-Stack']);
  const coverIdxJob = JOB_HEADERS.indexOf('Cover Letter?');
  await addDropdowns(auth, jobRes.spreadsheetId, 0, coverIdxJob, ['Yes', 'No']);

  // Share with personal email
  const drive = google.drive({ version: 'v3', auth });
  await drive.permissions.create({
    fileId: outreachRes.spreadsheetId,
    resource: { type: 'user', role: 'writer', emailAddress: 'yerinssaibs@gmail.com' },
  });
  await drive.permissions.create({
    fileId: jobRes.spreadsheetId,
    resource: { type: 'user', role: 'writer', emailAddress: 'yerinssaibs@gmail.com' },
  });

  config.brydg_outreach = { spreadsheetId: outreachRes.spreadsheetId, url: outreachRes.sheetUrl };
  config.job_applications = { spreadsheetId: jobRes.spreadsheetId, url: jobRes.sheetUrl };
  config.last_sync = new Date().toISOString();
  saveConfig(config);

  console.log('\nSheets shared with yerinssaibs@gmail.com');
  console.log('Config saved to .sheets_config.json');
  return config;
}

async function updateSheet(auth, spreadsheetId, csvFile, headers) {
  const sheets = google.sheets({ version: 'v4', auth });
  const csvPath = path.join(__dirname, csvFile);

  if (!fs.existsSync(csvPath)) {
    console.log(`  CSV not found: ${csvFile}, skipping.`);
    return;
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(csvContent);

  // First clear existing data (keep header)
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Tracker!A2:Z1000',
  });

  // Write all rows
  if (rows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Tracker!A2',
      valueInputOption: 'USER_ENTERED',
      resource: { values: rows },
    });
  }

  console.log(`  Updated ${rows.length} rows in ${csvFile}`);
}

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length <= 1) return []; // only header
  return lines.slice(1).map(line => {
    // Simple CSV parser (handles basic cases)
    const result = [];
    let current = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  });
}

async function updateSheets() {
  const auth = await getAuthClient();
  const config = loadConfig();

  if (config.brydg_outreach?.spreadsheetId) {
    console.log('Updating Brydg Outreach Tracker...');
    await updateSheet(auth, config.brydg_outreach.spreadsheetId, 'brydg_outreach_tracker.csv', OUTREACH_HEADERS);
  }

  if (config.job_applications?.spreadsheetId) {
    console.log('Updating Job Applications Tracker...');
    await updateSheet(auth, config.job_applications.spreadsheetId, 'job_applications_tracker.csv', JOB_HEADERS);
  }

  config.last_sync = new Date().toISOString();
  saveConfig(config);
  console.log('Sync complete.');
}

async function status() {
  const config = loadConfig();
  console.log('Google Sheets Configuration:');
  console.log(JSON.stringify(config, null, 2));
}

// Main
(async () => {
  const cmd = process.argv[2] || 'status';

  try {
    if (cmd === 'create') await createSheets();
    else if (cmd === 'update') await updateSheets();
    else if (cmd === 'status') await status();
    else console.log('Usage: node sheets_sync.js [create|update|status]');
  } catch (err) {
    console.error('Error:', err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
    process.exit(1);
  }
})();

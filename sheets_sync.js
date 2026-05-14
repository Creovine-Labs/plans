/**
 * Google Sheets Sync Utility — Abraham & Sarah (Shared)
 *
 * Pushes CSV data to Google Sheets using the abrahamsarah service account.
 *
 * Usage:
 *   node sheets_sync.js            → Sync all
 *   node sheets_sync.js brydg      → Sync Brydg outreach
 *   node sheets_sync.js jobs       → Sync Abraham job applications
 */
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const SHEETS_CONFIG = path.join(__dirname, '.sheets_config.json');

const OH = [
  'Organization','Contact Person','Role/Title','Phone','Email','Source (How Found)',
  'Outreach Method','Date First Contacted','Last Follow-Up Date','Status',
  'Priority','Notes / Last Action','Next Action','Next Action Deadline',
  'Pilot Opportunity?','Deal Value Estimate',
];

const JH = [
  'Company','Role','Location','Job URL / Source','Date Applied','Application Method',
  'Status','Priority','CV Version Used','Cover Letter?','Follow-Up Date',
  'Contact Person','Contact Email/Phone','Notes','Next Action','Salary Range','Referral Source',
];

function loadConfig() {
  if (!fs.existsSync(SHEETS_CONFIG)) { console.error('Missing .sheets_config.json'); process.exit(1); }
  return JSON.parse(fs.readFileSync(SHEETS_CONFIG, 'utf8'));
}

function pcsv(c) {
  const ls = c.split('\n').filter(l => l.trim());
  if (ls.length <= 1) return [];
  return ls.slice(1).map(line => {
    const r = []; let cur = ''; let iq = false;
    for (const ch of line) {
      if (ch === '"') { iq = !iq; }
      else if (ch === ',' && !iq) { r.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    r.push(cur.trim());
    return r;
  });
}

async function syncSheet(sheets, spreadsheetId, csvFile, headers) {
  const csvPath = path.join(__dirname, csvFile);
  if (!fs.existsSync(csvPath)) { console.log('  SKIP: ' + csvFile + ' not found'); return 0; }
  const rows = pcsv(fs.readFileSync(csvPath, 'utf8'));
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Tracker!A:Z' });
  await sheets.spreadsheets.values.update({ spreadsheetId, range: 'Tracker!A1', valueInputOption: 'USER_ENTERED', resource: { values: [headers, ...rows] } });
  return rows.length;
}

async function main() {
  const config = loadConfig();
  const target = process.argv[2] || 'all';
  const saFile = config.service_account || 'abrahamsarah-805a6c939f73.json';

  const a = new google.auth.GoogleAuth({ keyFile: saFile, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const c = await a.getClient();
  const s = google.sheets({ version: 'v4', auth: c });

  console.log('Syncing CSVs \u2192 Google Sheets\n');

  if (target === 'all' || target === 'brydg') {
    if (config.brydg_outreach && config.brydg_outreach.spreadsheetId) {
      const n = await syncSheet(s, config.brydg_outreach.spreadsheetId, 'brydg_outreach_tracker.csv', OH);
      console.log('  \u2713 Brydg Outreach: ' + n + ' rows');
      console.log('    ' + config.brydg_outreach.url);
    }
  }

  if (target === 'all' || target === 'jobs') {
    if (config.abraham_jobs && config.abraham_jobs.spreadsheetId) {
      const n = await syncSheet(s, config.abraham_jobs.spreadsheetId, 'abraham_job_applications_tracker.csv', JH);
      console.log('  \u2713 Abraham Jobs: ' + n + ' rows');
      console.log('    ' + config.abraham_jobs.url);
    }
  }

  config.last_sync = new Date().toISOString();
  fs.writeFileSync(SHEETS_CONFIG, JSON.stringify(config, null, 2));
  console.log('\n\u2705 Sync done - ' + config.last_sync);
}

main().catch(e => { console.error(e.message); process.exit(1); });

const { google } = require('googleapis');
const fs = require('fs');

const BRYDG = '1n1QB20s021hkxbPHRAHCjUTgnkFrT83BZDoFt5hS5Ww';
const ABRAHAM_JOBS = '1ryDZkE9C6cP3ZEld9Q8vLRNTBQfxRawl-lXTzj7jei0';

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

function dd(col, vals) {
  return { setDataValidation: { range: { sheetId: 0, startRowIndex: 1, endRowIndex: 500, startColumnIndex: col, endColumnIndex: col + 1 }, rule: { condition: { type: 'ONE_OF_LIST', values: vals.map(v => ({ userEnteredValue: v })) }, showCustomUi: true, strict: true } } };
}

async function setupSheet(sheets, spreadsheetId, csvFile, headers, label, dropdowns) {
  // Step 1: Rename the default sheet to 'Tracker'
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheetName = meta.data.sheets[0].properties.title;
  console.log('  Current sheet name: ' + sheetName);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: { requests: [
      { updateSheetProperties: { properties: { sheetId: 0, title: 'Tracker', gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } },
    ]},
  });

  // Step 2: Populate data
  const rows = pcsv(fs.readFileSync(csvFile, 'utf8'));
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: 'Tracker!A:Z' });
  await sheets.spreadsheets.values.update({
    spreadsheetId, range: 'Tracker!A1',
    valueInputOption: 'USER_ENTERED',
    resource: { values: [headers, ...rows] },
  });

  // Step 3: Style + dropdowns
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: { requests: [
      { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0.13, green: 0.59, blue: 0.95, alpha: 1 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1, alpha: 1 } } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
      ...dropdowns,
    ]},
  });

  console.log('  ' + label + ': ' + rows.length + ' rows, dropdowns active');
}

async function main() {
  const a = new google.auth.GoogleAuth({ keyFile: 'abrahamsarah-805a6c939f73.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const c = await a.getClient();
  const s = google.sheets({ version: 'v4', auth: c });

  console.log('Setting up sheets...\n');

  await setupSheet(s, BRYDG, 'brydg_outreach_tracker.csv', OH, 'Brydg Outreach', [
    dd(OH.indexOf('Status'), ['Not Started','In Progress','Done','Pending Follow-up','Rejected']),
    dd(OH.indexOf('Priority'), ['High','Medium','Low']),
    dd(OH.indexOf('Pilot Opportunity?'), ['Yes','No','Maybe']),
    dd(OH.indexOf('Outreach Method'), ['Email','WhatsApp','Call','Office Visit','LinkedIn','Instagram DM','Referral']),
  ]);

  await setupSheet(s, ABRAHAM_JOBS, 'abraham_job_applications_tracker.csv', JH, 'Abraham Jobs', [
    dd(JH.indexOf('Status'), ['Not Started','Applied','Screening','Interview','Offer','Rejected','On Hold']),
    dd(JH.indexOf('Priority'), ['High','Medium','Low']),
    dd(JH.indexOf('CV Version Used'), ['Backend','Full-Stack']),
    dd(JH.indexOf('Cover Letter?'), ['Yes','No']),
    dd(JH.indexOf('Application Method'), ['Company Site','LinkedIn','Email','Referral','Other']),
  ]);

  console.log('\nAll done!');
}
main().catch(e => { console.error(e.message); if(e.response&&e.response.data) console.error(JSON.stringify(e.response.data)); process.exit(1); });

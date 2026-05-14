const { google } = require('googleapis');
const fs = require('fs');

const BRYDG = '1vjD1l9_1B3857Wdg-66IpNErVPVqSvQMU3owsPdIAtI';
const JOBS = '1mWB0HXkYrw8-z7ITzFcFKJE5L56xAncz4E1sWv2hY2U';

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

async function main() {
  const a = new google.auth.GoogleAuth({ keyFile: 'google-service-account.json.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const c = await a.getClient();
  const s = google.sheets({ version: 'v4', auth: c });

  // --- BRYDG ---
  console.log('Setting up Brydg Outreach...');
  const orows = pcsv(fs.readFileSync('brydg_outreach_tracker.csv', 'utf8'));
  await s.spreadsheets.values.clear({ spreadsheetId: BRYDG, range: 'Tracker!A:Z' });
  await s.spreadsheets.values.update({ spreadsheetId: BRYDG, range: 'Tracker!A1', valueInputOption: 'USER_ENTERED', resource: { values: [OH, ...orows] } });
  await s.spreadsheets.batchUpdate({ spreadsheetId: BRYDG, resource: { requests: [
    { updateSheetProperties: { properties: { sheetId: 0, title: 'Tracker', gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } },
    { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: OH.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0.13, green: 0.59, blue: 0.95, alpha: 1 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1, alpha: 1 } } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
    dd(OH.indexOf('Status'), ['Not Started','In Progress','Done','Pending Follow-up','Rejected']),
    dd(OH.indexOf('Priority'), ['High','Medium','Low']),
    dd(OH.indexOf('Pilot Opportunity?'), ['Yes','No','Maybe']),
    dd(OH.indexOf('Outreach Method'), ['Email','WhatsApp','Call','Office Visit','LinkedIn','Instagram DM','Referral']),
  ] } });
  console.log('  OK: ' + orows.length + ' rows');

  // --- JOBS ---
  console.log('Setting up Job Applications...');
  const jrows = pcsv(fs.readFileSync('job_applications_tracker.csv', 'utf8'));
  await s.spreadsheets.values.clear({ spreadsheetId: JOBS, range: 'Tracker!A:Z' });
  await s.spreadsheets.values.update({ spreadsheetId: JOBS, range: 'Tracker!A1', valueInputOption: 'USER_ENTERED', resource: { values: [JH, ...jrows] } });
  await s.spreadsheets.batchUpdate({ spreadsheetId: JOBS, resource: { requests: [
    { updateSheetProperties: { properties: { sheetId: 0, title: 'Tracker', gridProperties: { frozenRowCount: 1 } }, fields: 'title,gridProperties.frozenRowCount' } },
    { repeatCell: { range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: JH.length }, cell: { userEnteredFormat: { backgroundColor: { red: 0.13, green: 0.59, blue: 0.95, alpha: 1 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1, alpha: 1 } } } }, fields: 'userEnteredFormat(backgroundColor,textFormat)' } },
    dd(JH.indexOf('Status'), ['Not Started','Applied','Screening','Interview','Offer','Rejected','On Hold']),
    dd(JH.indexOf('Priority'), ['High','Medium','Low']),
    dd(JH.indexOf('CV Version Used'), ['Backend','Full-Stack']),
    dd(JH.indexOf('Cover Letter?'), ['Yes','No']),
    dd(JH.indexOf('Application Method'), ['Company Site','LinkedIn','Email','Referral','Other']),
  ] } });
  console.log('  OK: ' + jrows.length + ' rows');

  console.log('\nAll done! Both sheets ready.');
}
main().catch(e => { console.error(e.message); if(e.response&&e.response.data) console.error(JSON.stringify(e.response.data)); process.exit(1); });

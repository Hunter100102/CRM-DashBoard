const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { google } = require('googleapis');

const demoPath = path.join(__dirname, '..', 'data', 'sites.json');
const aliases = {
  site_id: ['site_id','site id','work_order','work order','wo','id'],
  site_name: ['site_name','site name','site','location','store','customer'],
  city: ['city'], state:['state'], region:['region'], coordinator:['coordinator','owner','project manager'],
  status:['status','site status','work order status'], request_date:['request_date','request date','created_date','created date','date received'],
  sourcing_started:['sourcing_started','sourcing started','source start','sourcing start'], technician_sourced:['technician_sourced','technician sourced','tech sourced','assigned date','technician assigned'],
  scheduled_date:['scheduled_date','scheduled date','schedule date','service date'], completed_date:['completed_date','completed date','completion date'],
  scheduled_time:['scheduled_time','scheduled time','appointment time','service time'], priority:['priority','urgency'],
  site_contact:['site_contact','site contact','contact name'], contact_phone:['contact_phone','contact phone','phone'],
  technician:['technician','tech','provider','technician name'], platform:['platform','source','vendor','marketplace'],
  labor_cost:['labor_cost','labor cost','technician cost','tech cost','pay','labor'], travel_cost:['travel_cost','travel cost','travel'], materials_cost:['materials_cost','materials cost','materials'],
  hours:['hours','labor hours','time on site','onsite hours'], revisit:['revisit','return visit','repeat visit'], issue:['issue','blocker','problem'], notes:['notes','comments']
};

function key(s=''){ return String(s).trim().toLowerCase().replace(/[_-]+/g,' ').replace(/\s+/g,' '); }
function num(v){ const n = Number(String(v ?? '').replace(/[$,%]/g,'').trim()); return Number.isFinite(n) ? n : 0; }
function bool(v){ return ['true','yes','y','1','revisit'].includes(String(v ?? '').trim().toLowerCase()); }
function cleanDate(v){ if(!v) return ''; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v).trim() : d.toISOString().slice(0,10); }
function normalizeRow(row){
  const keyed = {}; Object.entries(row).forEach(([k,v]) => keyed[key(k)] = v);
  const out = {};
  for (const [field,names] of Object.entries(aliases)) {
    const value = names.map(key).find(n => Object.prototype.hasOwnProperty.call(keyed,n));
    out[field] = value ? keyed[value] : '';
  }
  ['labor_cost','travel_cost','materials_cost','hours'].forEach(f => out[f] = num(out[f]));
  out.revisit = bool(out.revisit);
  ['request_date','sourcing_started','technician_sourced','scheduled_date','completed_date'].forEach(f => out[f] = cleanDate(out[f]));
  out.status = out.status || 'Unknown';
  out.coordinator = out.coordinator || 'Katy';
  return out;
}

async function fromPublicCsv(){
  const url = process.env.SHEET_CSV_URL;
  if(!url) throw new Error('SHEET_CSV_URL is not configured');
  const res = await fetch(url);
  if(!res.ok) throw new Error(`Google Sheet CSV returned ${res.status}`);
  const text = await res.text();
  return parse(text,{columns:true,skip_empty_lines:true,relax_column_count:true}).map(normalizeRow);
}

async function fromGoogleServiceAccount(){
  if(!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('Google Sheets service-account settings are incomplete');
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({credentials:creds,scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']});
  const sheets = google.sheets({version:'v4',auth});
  const range = process.env.GOOGLE_SHEET_RANGE || 'Dashboard_Data!A:Z';
  const response = await sheets.spreadsheets.values.get({spreadsheetId:process.env.GOOGLE_SHEET_ID,range});
  const values = response.data.values || [];
  if(values.length < 2) return [];
  const [headers,...rows] = values;
  return rows.map(r => Object.fromEntries(headers.map((h,i)=>[h,r[i] ?? '']))).map(normalizeRow);
}

async function getSites(){
  const source = (process.env.DATA_SOURCE || 'demo').toLowerCase();
  if(source === 'public_csv') return fromPublicCsv();
  if(source === 'google_service_account') return fromGoogleServiceAccount();
  return JSON.parse(fs.readFileSync(demoPath,'utf8')).map(normalizeRow);
}

function saveDemoSites(sites){
  fs.writeFileSync(demoPath, JSON.stringify(sites, null, 2));
  return sites;
}

function requireDemoSource(){
  if((process.env.DATA_SOURCE || 'demo').toLowerCase() !== 'demo') {
    const error = new Error('Editing is available in demo mode only until a writable Google Sheets connection is configured.');
    error.status = 405;
    throw error;
  }
}

async function createSite(input){
  requireDemoSource();
  const sites = await getSites();
  const record = normalizeRow(input || {});
  if(!record.site_id) record.site_id = `SP-${Date.now().toString().slice(-7)}`;
  if(!record.request_date) record.request_date = new Date().toISOString().slice(0,10);
  if(!record.sourcing_started) record.sourcing_started = record.request_date;
  if(!record.site_name) throw Object.assign(new Error('Site name is required.'), {status:400});
  if(sites.some(site => site.site_id === record.site_id)) throw Object.assign(new Error('That work-order ID already exists.'), {status:409});
  sites.push(record);
  saveDemoSites(sites);
  return record;
}

async function updateSite(siteId,input){
  requireDemoSource();
  const sites = await getSites();
  const index = sites.findIndex(site => site.site_id === siteId);
  if(index < 0) throw Object.assign(new Error('Install not found.'), {status:404});
  const merged = {...sites[index], ...(input || {}), site_id:siteId};
  sites[index] = normalizeRow(merged);
  saveDemoSites(sites);
  return sites[index];
}

module.exports = { getSites, normalizeRow, createSite, updateSite };

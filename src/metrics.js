function date(v){ return v ? new Date(`${v}T12:00:00`) : null; }
function daysBetween(a,b){ const x=date(a), y=date(b); return x&&y ? Math.max(0,(y-x)/86400000) : null; }
function money(s){ return (+s.labor_cost||0)+(+s.travel_cost||0)+(+s.materials_cost||0); }
function avg(arr){ const v=arr.filter(x=>Number.isFinite(x)); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0; }
function round(n,d=1){ const p=10**d; return Math.round(n*p)/p; }
function weekKey(v){ const d=date(v); if(!d)return 'Unknown'; const t=new Date(d); t.setHours(0,0,0,0); t.setDate(t.getDate()+3-((t.getDay()+6)%7)); const week1=new Date(t.getFullYear(),0,4); const w=1+Math.round(((t-week1)/86400000-3+((week1.getDay()+6)%7))/7); return `${t.getFullYear()}-W${String(w).padStart(2,'0')}`; }

function filterSites(sites,q={}){
  let out=[...sites];
  if(q.region && q.region!=='all') out=out.filter(s=>s.region===q.region);
  if(q.status && q.status!=='all') out=out.filter(s=>s.status===q.status);
  if(q.technician && q.technician!=='all') out=out.filter(s=>s.technician===q.technician);
  if(q.search){ const z=String(q.search).toLowerCase(); out=out.filter(s=>[s.site_id,s.site_name,s.city,s.state,s.technician,s.notes,s.issue].some(v=>String(v||'').toLowerCase().includes(z))); }
  if(q.from){ const f=date(q.from); out=out.filter(s=>{const d=date(s.request_date);return d&&d>=f;}); }
  if(q.to){ const t=date(q.to); out=out.filter(s=>{const d=date(s.request_date);return d&&d<=t;}); }
  return out;
}

function summary(sites){
  const completed=sites.filter(s=>s.status.toLowerCase()==='completed');
  const attempted=sites.filter(s=>!['sourcing','scheduled'].includes(s.status.toLowerCase()));
  const sourced=sites.filter(s=>s.technician_sourced);
  const spent=sites.reduce((a,s)=>a+money(s),0);
  return {
    total_sites: sites.length,
    completed_sites: completed.length,
    active_sites: sites.filter(s=>!['completed','cancelled'].includes(s.status.toLowerCase())).length,
    completion_rate: round(attempted.length ? completed.length/attempted.length*100 : 0),
    total_spend: round(spent,2),
    avg_site_cost: round(avg(completed.map(money)),2),
    avg_sourcing_days: round(avg(sourced.map(s=>daysBetween(s.sourcing_started||s.request_date,s.technician_sourced))),1),
    avg_request_to_complete_days: round(avg(completed.map(s=>daysBetween(s.request_date,s.completed_date))),1),
    revisit_rate: round(sites.length ? sites.filter(s=>s.revisit).length/sites.length*100 : 0),
    avg_onsite_hours: round(avg(completed.map(s=>+s.hours||0)),1)
  };
}

function weekly(sites){
  const map={};
  sites.forEach(s=>{ const k=weekKey(s.request_date); map[k] ||= {week:k,submitted:0,completed:0,spend:0}; map[k].submitted++; if(s.status.toLowerCase()==='completed')map[k].completed++; map[k].spend+=money(s); });
  return Object.values(map).sort((a,b)=>a.week.localeCompare(b.week)).map(x=>({...x,spend:round(x.spend,2)}));
}

function statusBreakdown(sites){ const m={}; sites.forEach(s=>m[s.status]=(m[s.status]||0)+1); return Object.entries(m).map(([status,count])=>({status,count})).sort((a,b)=>b.count-a.count); }
function regionBreakdown(sites){ const m={}; sites.forEach(s=>{const k=s.region||'Unknown';m[k]=(m[k]||0)+1}); return Object.entries(m).map(([region,count])=>({region,count})).sort((a,b)=>b.count-a.count); }

function technicians(sites){
  const map={};
  sites.filter(s=>s.technician).forEach(s=>{const k=s.technician; map[k] ||= {technician:k,platforms:new Set(),sites:0,completed:0,revisits:0,spend:0,hours:0,sourcing_days:[]}; const x=map[k]; x.platforms.add(s.platform||'Unknown');x.sites++;x.spend+=money(s);x.hours+=+s.hours||0;if(s.status.toLowerCase()==='completed')x.completed++;if(s.revisit)x.revisits++;const d=daysBetween(s.sourcing_started||s.request_date,s.technician_sourced);if(d!==null)x.sourcing_days.push(d);});
  return Object.values(map).map(x=>({technician:x.technician,platform:[...x.platforms].join(', '),sites:x.sites,completed:x.completed,completion_rate:round(x.sites?x.completed/x.sites*100:0),revisits:x.revisits,revisit_rate:round(x.sites?x.revisits/x.sites*100:0),total_spend:round(x.spend,2),avg_cost:round(x.sites?x.spend/x.sites:0,2),avg_hours:round(x.sites?x.hours/x.sites:0,1),avg_sourcing_days:round(avg(x.sourcing_days),1)})).sort((a,b)=>b.sites-a.sites);
}

function sourcing(sites){
  return sites.map(s=>({...s,sourcing_days:daysBetween(s.sourcing_started||s.request_date,s.technician_sourced),request_to_schedule_days:daysBetween(s.request_date,s.scheduled_date),request_to_complete_days:daysBetween(s.request_date,s.completed_date),total_cost:round(money(s),2)}));
}

module.exports={filterSites,summary,weekly,statusBreakdown,regionBreakdown,technicians,sourcing,money};

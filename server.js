require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const cookieSession = require('cookie-session');
const helmet = require('helmet');
const { getSites } = require('./src/data');
const M = require('./src/metrics');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy',1);
app.use(helmet({contentSecurityPolicy:false}));
app.use(express.json({limit:'1mb'}));
app.use(express.urlencoded({extended:false}));
const secureCookie = false;
app.use(cookieSession({
  name:'smartpark_session',
  keys:[process.env.SESSION_SECRET || 'dev-only-change-me'],
  maxAge:8*60*60*1000,
  httpOnly:true,
  sameSite:'lax',
  secure:secureCookie
}));
app.use(express.static(path.join(__dirname,'public')));

function configuredHash(){ if(process.env.ADMIN_PASSWORD_HASH) return process.env.ADMIN_PASSWORD_HASH; if(process.env.NODE_ENV==='production') return null; return bcrypt.hashSync('ChangeMe-Now!',12); }
function auth(req,res,next){ if(req.session?.authenticated) return next(); res.status(401).json({error:'Authentication required'}); }

app.get('/',(req,res)=>res.redirect('/login.html'));
app.post('/api/auth/login',async(req,res)=>{ const {username,password}=req.body||{}; const okUser=String(username||'').toLowerCase()===String(process.env.ADMIN_USERNAME||'KatyH').toLowerCase(); const hash=configuredHash(); if(!hash) return res.status(503).json({error:'ADMIN_PASSWORD_HASH is not configured'}); const okPass=password ? await bcrypt.compare(password,hash) : false; if(!okUser||!okPass) return res.status(401).json({error:'Invalid username or password'}); req.session.authenticated=true;req.session.user={name:'Katy',username:process.env.ADMIN_USERNAME||'KatyH',role:'Administrator'};res.json({ok:true,user:req.session.user}); });
app.post('/api/auth/logout',(req,res)=>{req.session=null;res.json({ok:true});});
app.get('/api/auth/me',(req,res)=>req.session?.authenticated?res.json({authenticated:true,user:req.session.user}):res.status(401).json({authenticated:false}));
app.get('/api/health',(req,res)=>res.json({ok:true,source:process.env.DATA_SOURCE||'demo'}));

async function loaded(req,res,next){ try{ req.sites=M.filterSites(await getSites(),req.query); next(); }catch(e){ next(e); } }
app.get('/api/sites',auth,loaded,(req,res)=>res.json({sites:M.sourcing(req.sites)}));
app.get('/api/dashboard',auth,loaded,(req,res)=>res.json({summary:M.summary(req.sites),weekly:M.weekly(req.sites),statuses:M.statusBreakdown(req.sites),regions:M.regionBreakdown(req.sites),recent:M.sourcing(req.sites).sort((a,b)=>(b.request_date||'').localeCompare(a.request_date||'')).slice(0,8)}));
app.get('/api/technicians',auth,loaded,(req,res)=>res.json({technicians:M.technicians(req.sites)}));
app.get('/api/sourcing',auth,loaded,(req,res)=>{const rows=M.sourcing(req.sites);res.json({summary:{avg_sourcing_days:M.summary(req.sites).avg_sourcing_days,open_sourcing:rows.filter(x=>x.status.toLowerCase()==='sourcing').length,fastest_sourced:rows.filter(x=>x.sourcing_days!==null).sort((a,b)=>a.sourcing_days-b.sourcing_days)[0]||null},rows});});
app.get('/api/finance',auth,loaded,(req,res)=>{ const tech=M.technicians(req.sites); res.json({summary:M.summary(req.sites),technicians:tech.sort((a,b)=>b.total_spend-a.total_spend),sites:M.sourcing(req.sites).sort((a,b)=>b.total_cost-a.total_cost)}); });
app.get('/api/meta',auth,async(req,res,next)=>{try{const sites=await getSites();const uniq=k=>[...new Set(sites.map(s=>s[k]).filter(Boolean))].sort();res.json({regions:uniq('region'),statuses:uniq('status'),technicians:uniq('technician'),data_source:process.env.DATA_SOURCE||'demo'});}catch(e){next(e);}});

app.use((err,req,res,next)=>{ console.error(err); res.status(500).json({error:'Dashboard data could not be loaded',detail:process.env.NODE_ENV==='production'?undefined:err.message}); });
app.listen(PORT,()=>console.log(`SmartPark dashboard running on ${PORT}`));

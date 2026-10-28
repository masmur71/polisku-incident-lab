// Reproducible local incident checks. Uses the existing database; never deletes volumes.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const pause = ms => new Promise(r=>setTimeout(r,ms));
const base = 'http://127.0.0.1:3000';
const report = {at:new Date().toISOString(), commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),workingTreeDirty:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),sourceDiffSha256:require('node:crypto').createHash('sha256').update(execFileSync('git',['diff','HEAD'],{encoding:'utf8'})).digest('hex'),packageLockSha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../app/package-lock.json'))).digest('hex'),checks:[]};
const out = path.join(__dirname,'../docs/evidence/revalidation',report.at.replace(/[:.]/g,'-'));
fs.mkdirSync(out,{recursive:true});
const save = (name,data) => fs.writeFileSync(path.join(out,name),typeof data==='string'?data:JSON.stringify(data,null,2));
const docker = (...args) => execFileSync('docker',args,{encoding:'utf8'});
const sql = text => docker('compose','exec','-T','postgres','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','poliskudb','-c',text);
async function call(route,body,timeout=20000) {
 const start=performance.now();
 const r=await fetch(base+route,{signal:AbortSignal.timeout(timeout),...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})});
 return {at:new Date().toISOString(),status:r.status,ms:Math.round(performance.now()-start),body:await r.json()};
}
async function alerts() { return (await (await fetch('http://127.0.0.1:9090/api/v1/alerts')).json()).data.alerts; }
async function waitForAlert(name, timeoutMs = 150000) {
 const until=Date.now()+timeoutMs;
 while(Date.now()<until) {
  const current=await alerts();
  if(current.some(a=>a.labels.alertname===name && a.state==='firing')) return current;
  await pause(5000);
 }
 throw new Error(`${name} did not reach firing within ${timeoutMs}ms`);
}
async function main() {
 execFileSync(process.execPath,[path.join(__dirname,'reset.js')],{stdio:'pipe'});
 save('environment.txt',docker('compose','ps')+sql("SELECT 'customers' AS relation, count(*) FROM customers UNION ALL SELECT 'policies', count(*) FROM policies UNION ALL SELECT 'claims',count(*) FROM claims UNION ALL SELECT 'premium_payments',count(*) FROM premium_payments;"));
 for(let i=0;i<10;i++) assert.equal((await call('/simulations/leak-connection')).status,200);
 const until=Date.now()+85000;
 const workers=Array.from({length:5},async()=>{while(Date.now()<until) assert.equal((await call('/health')).status,503);});
 await pause(35000);
 save('INC-001-pool.json',await call('/simulations/stats'));
 await Promise.all(workers);
 const active=await waitForAlert('HighErrorRate');save('INC-001-alerts.json',active);
 assert(active.some(a=>a.labels.alertname==='HighErrorRate'&&a.state==='firing'));
 assert.equal((await call('/simulations/release-leaks',{})).status,200);
 assert.equal((await call('/health')).status,200);
 report.checks.push('INC-001: exhausted pool, 503, HighErrorRate firing, release and health recovery');
 console.log(report.checks.at(-1));
 const memBefore=await call('/simulations/stats');
 for(let i=0;i<8;i++) await call('/simulations/memory-leak',{items:8000,sizeKb:8});
 const memDuring=await call('/simulations/stats');
 assert.equal(memDuring.body.memory.leakArrayLength,64000);
 await call('/simulations/clear-memory-leak',{});
 assert.equal((await call('/simulations/stats')).body.memory.leakArrayLength,0);
 save('INC-002-memory.json',{before:memBefore,during:memDuring,after:await call('/simulations/stats'),note:'Reference release is verified. Immediate RSS shrink or GC-pause causality is not asserted.'});
 report.checks.push('INC-002: retained object growth and reference cleanup');console.log(report.checks.at(-1));
 const npmRoot=execFileSync(process.platform==='win32'?'npm.cmd':'npm',['root','-g'],{encoding:'utf8',shell:process.platform==='win32'}).trim();
 const autocannon=require(path.join(npmRoot,'autocannon'));
 const bench=()=>new Promise((resolve,reject)=>autocannon({url:base+'/claims?status=PENDING',connections:20,pipelining:1,duration:10},(err,r)=>err?reject(err):resolve(r)));
 const query="EXPLAIN (ANALYZE, BUFFERS) SELECT id, policy_id, claim_type, description, amount, status, filed_at, resolved_at FROM claims WHERE status='PENDING' ORDER BY filed_at DESC LIMIT 100;";
 save('INC-003-before-plan.txt',sql(query));save('INC-003-before-load.json',await bench());
 sql('CREATE INDEX CONCURRENTLY idx_claims_status_filed_at ON claims(status,filed_at DESC);');
 save('INC-003-after-plan.txt',sql(query));save('INC-003-after-load.json',await bench());
 report.checks.push('INC-003: matching query and 20-connection load before/after index');console.log(report.checks.at(-1));
 assert.equal((await call('/simulations/fill-disk',{megabytes:28})).status,200);
 const diskAlerts=await waitForAlert('DiskSpaceUsageAbove80');save('INC-004-alerts.json',diskAlerts);
 assert(diskAlerts.some(a=>a.labels.alertname==='DiskSpaceUsageAbove80'&&a.state==='firing'));
 const full=await call('/simulations/fill-disk',{megabytes:8});assert.equal(full.status,507);assert.equal(full.body.error,'ENOSPC');save('INC-004-full.json',full);
 assert.equal((await call('/health')).status,200);
 await call('/simulations/clean-disk',{});
 assert.equal((await call('/simulations/disk-stats')).body.fileSizeBytes,0);
 save('INC-004-recovered.json',await call('/simulations/disk-stats'));
 report.checks.push('INC-004: bounded tmpfs alert, real ENOSPC/507, business health intact, truncate recovery');console.log(report.checks.at(-1));
 const slow=await call('/simulations/external-claim-verification');assert.equal(slow.status,200);assert(slow.ms>=11000);
 const timeout=await call('/simulations/external-claim-verification?withTimeout=true&timeoutMs=2000');assert.equal(timeout.status,504);assert.equal(timeout.body.queued,false);assert(timeout.ms<4000);
 save('INC-005-timeout.json',{slow,timeout});
 await pause(11000);
 save('INC-005-metrics.txt',await (await fetch(base+'/metrics')).text());
 report.checks.push('INC-005: 12s mock versus 2s deadline, HTTP 504, no false acceptance');console.log(report.checks.at(-1));
 save('reset.json',execFileSync(process.execPath,[path.join(__dirname,'reset.js')],{encoding:'utf8'}));
 await pause(10000);save('alerts-after-recovery.json',await alerts());
 report.status='passed';save('summary.json',report);console.log(out);
}
main().catch(err=>{
 report.status='failed'; report.error=err.stack; save('summary.json',report); console.error(err);
 try { save('failure-recovery.txt',execFileSync(process.execPath,[path.join(__dirname,'reset.js')],{encoding:'utf8'})); }
 catch (recoveryError) { save('failure-recovery.txt',String(recoveryError)); }
 process.exitCode=1;
});

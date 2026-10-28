const { execFileSync } = require('node:child_process');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = 'http://127.0.0.1:3000';
function docker(...args) { return execFileSync('docker', args, {encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim(); }
async function get(url, options = {}) {
  const r = await fetch(url, {...options, signal: AbortSignal.timeout(7000)});
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
async function main() {
  const indexed = process.argv.includes('--indexed');
  docker('info', '--format', '{{.ServerVersion}}');
  // Clean only simulated faults; never terminate unrelated database sessions.
  await get(`${base}/simulations/release-leaks`, {method:'POST'});
  await get(`${base}/simulations/clean-disk`, {method:'POST'});
  docker('compose','restart','app');
  let ready = false;
  for (let i=0;i<30;i++) { try { await get(`${base}/health`); ready=true; break; } catch { await pause(1000); } }
  if (!ready) throw new Error('Application did not recover');
  const sql = indexed
    ? 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_claims_status_filed_at ON claims(status, filed_at DESC);'
    : 'DROP INDEX IF EXISTS idx_claims_status; DROP INDEX IF EXISTS idx_claims_status_filed_at;';
  docker('compose','exec','-T','postgres','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','poliskudb','-c',sql);
  const stats = await get(`${base}/simulations/stats`);
  const disk = await get(`${base}/simulations/disk-stats`);
  if (stats.pool.simulatedLeakedCount || stats.pool.waitingCount || stats.memory.leakArrayLength || disk.fileSizeBytes) throw new Error('Fault state is not clean');
  const policy = await get(`${base}/policies/1`);
  if (policy.id !== 1) throw new Error('Seed policy missing');
  let claimId;
  try {
    const claim = await get(`${base}/claims`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({policyId:1,claimType:'DEATH',description:'Recovery smoke verification',amount:1})});
    claimId = claim.id;
    if (!Number.isSafeInteger(claimId) || claim.status !== 'PENDING') throw new Error('Claim creation failed');
    const saved = docker('compose','exec','-T','postgres','psql','-At','-U','postgres','-d','poliskudb','-c',`SELECT status FROM claims WHERE id=${claimId};`);
    if (saved !== 'PENDING') throw new Error('Claim was not persisted');
  } finally {
    if (Number.isSafeInteger(claimId)) docker('compose','exec','-T','postgres','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','poliskudb','-c',`DELETE FROM claims WHERE id=${claimId};`);
  }
  let target;
  for (let i=0;i<20;i++) {
    const targets = await get('http://127.0.0.1:9090/api/v1/targets');
    target = targets.data.activeTargets.find(t=>t.labels.job==='polisku-app');
    if (target?.health==='up') break;
    await pause(1000);
  }
  if (target?.health!=='up') throw new Error('Prometheus application target is not UP');
  console.log(JSON.stringify({at:new Date().toISOString(), status:'recovered', index:indexed?'indexed':'unindexed', businessReadWrite:'passed', data:'Existing data preserved; only the smoke claim was deleted', pool:stats.pool, disk, prometheus:target.health},null,2));
}
main().catch(err=>{console.error(err.message);process.exitCode=1;});

/**
 * loadtest/autocannon-traffic.js
 * 
 * PolisKu Incident Lab - Realistic Traffic Generator
 * Simulates 70% read / 30% write realistic workload against PolisKu API.
 * 
 * Workload distribution:
 * - 10% GET /health
 * - 30% GET /policies/:id (random id between 1 and 200,000)
 * - 30% GET /claims?status=PENDING
 * - 30% POST /claims (random policyId, claimType, amount)
 * 
 * Usage:
 *   node loadtest/autocannon-traffic.js --level light|medium|heavy|all
 *   node loadtest/autocannon-traffic.js -c 10 -d 30
 */

const path = require('path');
const http = require('http');

// Support requiring autocannon from local node_modules or global npm modules
let autocannon;
try {
  autocannon = require('autocannon');
} catch (e1) {
  try {
    const globalPath = path.join(process.env.APPDATA || '', 'npm/node_modules/autocannon');
    autocannon = require(globalPath);
  } catch (e2) {
    try {
      autocannon = require('../app/node_modules/autocannon');
    } catch (e3) {
      console.error('[!] Error: autocannon not found. Install it with: npm i -g autocannon');
      process.exit(1);
    }
  }
}

const CLAIM_TYPES = ['HEALTH', 'DEATH', 'ACCIDENT', 'CRITICAL_ILLNESS'];
const TARGET_HOST = process.env.TARGET_URL || 'http://localhost:3000';

// Pre-defined load levels as specified in projectphases.md
const PROFILES = {
  light: {
    name: 'Beban Ringan (Light Load)',
    connections: 10,
    duration: 30,
    description: '10 concurrent connections, 30 detik'
  },
  medium: {
    name: 'Beban Sedang (Medium Load)',
    connections: 50,
    duration: 60,
    description: '50 concurrent connections, 60 detik'
  },
  heavy: {
    name: 'Beban Berat (Heavy Load)',
    connections: 150,
    duration: 60,
    description: '150 concurrent connections, 60 detik'
  }
};

/**
 * Fetch Prometheus metrics from /metrics endpoint
 */
async function fetchMetrics() {
  return new Promise((resolve) => {
    http.get(`${TARGET_HOST}/metrics`, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const metrics = {
          heapUsedMb: null,
          heapTotalMb: null,
          dbPoolTotal: null,
          dbPoolIdle: null,
          dbPoolWaiting: null,
        };

        const heapUsedMatch = data.match(/nodejs_heap_size_used_bytes\s+([0-9.e+-]+)/);
        if (heapUsedMatch) metrics.heapUsedMb = (parseFloat(heapUsedMatch[1]) / (1024 * 1024)).toFixed(2);

        const heapTotalMatch = data.match(/nodejs_heap_size_total_bytes\s+([0-9.e+-]+)/);
        if (heapTotalMatch) metrics.heapTotalMb = (parseFloat(heapTotalMatch[1]) / (1024 * 1024)).toFixed(2);

        const poolTotalMatch = data.match(/polisku_pg_pool_total_connections\s+([0-9.]+)/);
        if (poolTotalMatch) metrics.dbPoolTotal = parseInt(poolTotalMatch[1], 10);

        const poolIdleMatch = data.match(/polisku_pg_pool_idle_connections\s+([0-9.]+)/);
        if (poolIdleMatch) metrics.dbPoolIdle = parseInt(poolIdleMatch[1], 10);

        const poolWaitingMatch = data.match(/polisku_pg_pool_waiting_connections\s+([0-9.]+)/);
        if (poolWaitingMatch) metrics.dbPoolWaiting = parseInt(poolWaitingMatch[1], 10);

        resolve(metrics);
      });
    }).on('error', () => {
      resolve({ heapUsedMb: 'N/A', heapTotalMb: 'N/A', dbPoolTotal: 'N/A', dbPoolIdle: 'N/A', dbPoolWaiting: 'N/A' });
    });
  });
}

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Build 70/30 requests definition
 */
function buildRequests() {
  return [
    // 10% GET /health (Read)
    {
      method: 'GET',
      path: '/health'
    },
    // 30% GET /policies/:id (Read)
    {
      method: 'GET',
      path: '/policies/1'
    },
    {
      method: 'GET',
      path: '/policies/2'
    },
    {
      method: 'GET',
      path: '/policies/3'
    },
    // 30% GET /claims?status=PENDING (Read)
    {
      method: 'GET',
      path: '/claims?status=PENDING'
    },
    {
      method: 'GET',
      path: '/claims?status=PENDING'
    },
    {
      method: 'GET',
      path: '/claims?status=PENDING'
    },
    // 30% POST /claims (Write)
    {
      method: 'POST',
      path: '/claims',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ policyId: 1, claimType: 'HEALTH', description: 'Load test', amount: 1000000 })
    },
    {
      method: 'POST',
      path: '/claims',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ policyId: 2, claimType: 'ACCIDENT', description: 'Load test', amount: 2000000 })
    },
    {
      method: 'POST',
      path: '/claims',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ policyId: 3, claimType: 'CRITICAL_ILLNESS', description: 'Load test', amount: 5000000 })
    }
  ];
}

/**
 * Dynamically randomize IDs for policies and claim creation
 */
function setupRequest(clientReq) {
  if (clientReq.path.startsWith('/policies/')) {
    const randomPolicyId = Math.floor(Math.random() * 200000) + 1;
    clientReq.path = `/policies/${randomPolicyId}`;
  } else if (clientReq.method === 'POST') {
    const randomPolicyId = Math.floor(Math.random() * 200000) + 1;
    const claimType = CLAIM_TYPES[Math.floor(Math.random() * CLAIM_TYPES.length)];
    const amount = (Math.floor(Math.random() * 50) + 1) * 1000000;
    clientReq.body = JSON.stringify({
      policyId: randomPolicyId,
      claimType,
      description: `Baseline loadtest claim for policy #${randomPolicyId}`,
      amount
    });
  }
  return clientReq;
}

/**
 * Run a load test profile
 */
async function runProfile(profileKey) {
  const profile = PROFILES[profileKey];
  if (!profile) {
    throw new Error(`Profile unknown: ${profileKey}`);
  }

  console.log(`\n============================================================`);
  console.log(`🚀 MENJALANKAN LOAD TEST: ${profile.name}`);
  console.log(`   Konfigurasi: ${profile.description} ke ${TARGET_HOST}`);
  console.log(`   Komposisi: 70% Read (/health, /policies/:id, /claims) | 30% Write (POST /claims)`);
  console.log(`============================================================\n`);

  const initialMetrics = await fetchMetrics();
  console.log(`[Metrics Awal] Heap: ${initialMetrics.heapUsedMb} MB / ${initialMetrics.heapTotalMb} MB | Pool: ${initialMetrics.dbPoolIdle} idle, ${initialMetrics.dbPoolWaiting} waiting`);

  const opts = {
    url: TARGET_HOST,
    connections: profile.connections,
    duration: profile.duration,
    pipelining: 1,
    requests: buildRequests(),
    setupRequest
  };

  return new Promise((resolve, reject) => {
    const instance = autocannon(opts, async (err, result) => {
      if (err) return reject(err);

      console.log('\n--- Hasil Uji Beban (Autocannon) ---');
      console.log(autocannon.printResult(result));

      const postMetrics = await fetchMetrics();

      const summary = {
        profile: profileKey,
        name: profile.name,
        connections: profile.connections,
        duration: profile.duration,
        totalRequests: result.requests.total,
        rpsAvg: result.requests.average,
        rpsMax: result.requests.max,
        latencyAvgMs: result.latency.average,
        latencyP50Ms: result.latency.p50,
        latencyP90Ms: result.latency.p90,
        latencyP97_5Ms: result.latency.p97_5,
        latencyP99Ms: result.latency.p99,
        latencyMaxMs: result.latency.max,
        status2xx: result['2xx'],
        statusNon2xx: result.non2xx,
        timeouts: result.timeouts,
        errors: result.errors,
        heapUsedMb: postMetrics.heapUsedMb,
        heapTotalMb: postMetrics.heapTotalMb,
        dbPoolTotal: postMetrics.dbPoolTotal,
        dbPoolIdle: postMetrics.dbPoolIdle,
        dbPoolWaiting: postMetrics.dbPoolWaiting,
      };

      console.log('--- Ringkasan Metrik Normal PolisKu ---');
      console.log(`• Throughput (Avg RPS) : ${summary.rpsAvg.toLocaleString()} req/s`);
      console.log(`• Total Permintaan     : ${summary.totalRequests.toLocaleString()} req (${summary.status2xx} 2xx, ${summary.statusNon2xx} non-2xx)`);
      console.log(`• Latency p50 (median) : ${summary.latencyP50Ms} ms`);
      console.log(`• Latency p97.5        : ${summary.latencyP97_5Ms} ms`);
      console.log(`• Latency p99          : ${summary.latencyP99Ms} ms`);
      console.log(`• Node.js Heap Used    : ${summary.heapUsedMb} MB / ${summary.heapTotalMb} MB`);
      console.log(`• DB Pool Connections  : ${summary.dbPoolTotal} Total (${summary.dbPoolIdle} Idle, ${summary.dbPoolWaiting} Waiting)\n`);

      resolve(summary);
    });

    autocannon.track(instance, { renderProgressBar: true });
  });
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  let mode = 'all';

  if (args.includes('--level')) {
    const idx = args.indexOf('--level');
    mode = args[idx + 1] || 'all';
  } else if (args.includes('light')) {
    mode = 'light';
  } else if (args.includes('medium')) {
    mode = 'medium';
  } else if (args.includes('heavy')) {
    mode = 'heavy';
  }

  const results = [];

  if (mode === 'all') {
    console.log('=== MEMULAI SERI UJI BEBAN BASELINE LENGKAP (LIGHT -> MEDIUM -> HEAVY) ===');
    
    // Light
    const lightResult = await runProfile('light');
    results.push(lightResult);
    console.log('[*] Cooldown selama 10 detik sebelum beban sedang...');
    await sleep(10000);

    // Medium
    const medResult = await runProfile('medium');
    results.push(medResult);
    console.log('[*] Cooldown selama 10 detik sebelum beban berat...');
    await sleep(10000);

    // Heavy
    const heavyResult = await runProfile('heavy');
    results.push(heavyResult);

    console.log('\n========================================================================');
    console.log('📊 TABEL PERBANDINGAN BASELINE LENGKAP (Fase 4)');
    console.log('========================================================================');
    console.table(results.map(r => ({
      Profile: r.name,
      'Conn': r.connections,
      'Dur(s)': r.duration,
      'Total Req': r.totalRequests,
      'Avg RPS': Math.round(r.rpsAvg),
      'p50 (ms)': r.latencyP50Ms,
      'p97.5 (ms)': r.latencyP97_5Ms,
      'p99 (ms)': r.latencyP99Ms,
      'Heap (MB)': `${r.heapUsedMb} / ${r.heapTotalMb}`,
      'Pool Waiting': r.dbPoolWaiting,
      'Errors': r.errors + r.timeouts
    })));

    // Output JSON output to stdout or file
    const fs = require('fs');
    const outPath = path.join(__dirname, 'baseline-results.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`[+] Hasil tersimpan dalam format JSON di: ${outPath}`);

  } else if (PROFILES[mode]) {
    const res = await runProfile(mode);
    const fs = require('fs');
    const outPath = path.join(__dirname, `baseline-${mode}.json`);
    fs.writeFileSync(outPath, JSON.stringify(res, null, 2));
  } else {
    console.error(`Mode tidak dikenal: ${mode}. Gunakan: light, medium, heavy, atau all.`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[!] Load test error:', err);
  process.exit(1);
});

/**
 * MongoDB Atlas Connection Diagnostic Tool
 * Run: node diagnose.js
 * This tells you exactly what is wrong and how to fix it.
 */
require('dotenv').config();
const dns  = require('dns');
const net  = require('net');
const http = require('http');

const uri = process.env.MONGODB_URI || '';

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Aircoast Solutions — MongoDB Diagnostic');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('Node version:', process.version);
console.log('Platform:    ', process.platform);
console.log('URI starts:  ', uri.substring(0, 60) + '...\n');

// Extract hostname from URI
const hostMatch = uri.match(/mongodb\+srv:\/\/[^@]+@([^/]+)/);
const srvHost   = hostMatch ? hostMatch[1] : null;

if (!srvHost) {
  console.error('❌  Could not parse hostname from MONGODB_URI');
  process.exit(1);
}

console.log('Atlas hostname:', srvHost);
console.log('SRV record:   ', `_mongodb._tcp.${srvHost}\n`);

// Step 1: Basic internet
console.log('Testing internet (google.com)...');
dns.resolve4('google.com', (err, addrs) => {
  if (err) {
    console.log('  ❌ FAIL — No internet:', err.message);
    console.log('     → Check your WiFi/ethernet connection\n');
  } else {
    console.log('  ✅ OK — Internet works:', addrs[0]);
  }

  // Step 2: Atlas hostname A record
  console.log(`\nTesting Atlas hostname DNS (${srvHost})...`);
  dns.resolve4(srvHost, (err2, addrs2) => {
    if (err2) {
      console.log('  ❌ FAIL:', err2.message);
    } else {
      console.log('  ✅ OK — Resolves to:', addrs2[0]);
    }

    // Step 3: SRV record
    console.log(`\nTesting SRV record (_mongodb._tcp.${srvHost})...`);
    dns.resolveSrv(`_mongodb._tcp.${srvHost}`, (err3, records) => {
      if (err3) {
        console.log('  ❌ FAIL:', err3.message);
        console.log('');
        console.log('  ━━━ LIKELY CAUSE ━━━');
        if (err3.message.includes('ECONNREFUSED')) {
          console.log('  Your DNS server is BLOCKING SRV queries.');
          console.log('  Fix: Change your DNS server to Google or Cloudflare.');
          console.log('');
          console.log('  WINDOWS — How to change DNS:');
          console.log('    1. Open "Network Connections" (ncpa.cpl)');
          console.log('    2. Right-click your WiFi/Ethernet → Properties');
          console.log('    3. Select "Internet Protocol Version 4" → Properties');
          console.log('    4. Use these DNS servers:');
          console.log('         Preferred:  8.8.8.8   (Google)');
          console.log('         Alternate:  1.1.1.1   (Cloudflare)');
          console.log('    5. Click OK, restart the connection');
          console.log('    6. Run this script again\n');
        } else if (err3.message.includes('ENOTFOUND')) {
          console.log('  SRV record not found. Check your cluster name in Atlas.');
          console.log('  Also ensure Network Access allows your IP (0.0.0.0/0)\n');
        } else if (err3.message.includes('ETIMEOUT')) {
          console.log('  SRV lookup timed out. Firewall is blocking UDP port 53.');
          console.log('  Try mobile hotspot or change DNS to 8.8.8.8\n');
        }
        
        console.log('  ALTERNATIVE — Use direct connection (no SRV needed):');
        console.log('  Get it from Atlas → Connect → Drivers → copy the');
        console.log('  "Standard Connection String" (starts with mongodb://)');
        console.log('  and paste it as MONGODB_URI in your .env file\n');
      } else {
        console.log('  ✅ OK — SRV records found:', records.length);
        records.forEach(r => {
          console.log(`     ${r.name}:${r.port}`);
          // Step 4: TCP connection to each shard
          const sock = net.createConnection({ host: r.name, port: r.port, timeout: 5000 });
          sock.on('connect', () => {
            console.log(`  ✅ TCP OK — ${r.name}:${r.port} reachable`);
            sock.destroy();
          });
          sock.on('error', e => {
            console.log(`  ❌ TCP FAIL — ${r.name}:${r.port}: ${e.message}`);
            console.log('     → Add your IP to Atlas Network Access (0.0.0.0/0)');
          });
        });
        console.log('\n  DNS is working. If mongoose still fails, check Network Access in Atlas.');
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    });
  });
});

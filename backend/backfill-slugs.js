/**
 * backfill-slugs.js
 * Adds slugs to all ShopProducts that don't have one yet.
 * Run once: node backfill-slugs.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8','8.8.4.4','1.1.1.1']);

const { ShopProduct } = require('./models');

function slugify(t) {
  return String(t||'').toLowerCase().trim()
    .replace(/[^a-z0-9 -]/g,'').replace(/ +/g,'-')
    .replace(/-+/g,'-').replace(/^-|-$/g,'');
}

async function uniqueSlug(shopId, name, excludeId) {
  const base = slugify(name); let slug = base; let n = 1;
  while (true) {
    const q = { shopId, slug };
    if (excludeId) q._id = { $ne: excludeId };
    if (!await ShopProduct.findOne(q)) return slug;
    slug = base + '-' + (++n);
  }
}

async function run() {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS:20000, connectTimeoutMS:20000, family:4
  });
  console.log('✅ Connected');

  const products = await ShopProduct.find({ $or:[{slug:null},{slug:''}] });
  console.log(`Found ${products.length} products without slugs`);

  let fixed = 0;
  for (const p of products) {
    const slug = await uniqueSlug(p.shopId, p.name, p._id);
    await ShopProduct.updateOne({ _id: p._id }, { $set: { slug } });
    console.log(`  ✅ ${p.name} → ${slug}`);
    fixed++;
  }

  console.log(`\n🎉 Backfilled ${fixed} slugs`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });

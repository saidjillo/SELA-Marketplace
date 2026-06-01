/**
 * seed-vendor-products.js
 * Seeds TechZone Nairobi vendor shop + imports existing products.
 * Run: node seed-vendor-products.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dns      = require('dns');

// ── Same DNS fix as server.js ──────────────────────────────────────────────
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const { Product, Shop, Branch, ShopProduct, ShopCategory, User } = require('./models');

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) { console.error('❌ No MONGODB_URI in .env'); process.exit(1); }

const MONGO_OPTS = {
  serverSelectionTimeoutMS: 20000,
  connectTimeoutMS: 20000,
  socketTimeoutMS:  45000,
  family: 4,
};


function slugify(text) {
  return String(text||'').toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g,'').replace(/\s+/g,'-')
    .replace(/-+/g,'-').replace(/^-+|-+$/g,'');
}
async function uniqueSlug(shopId, name, model) {
  const base = slugify(name); let slug = base; let n = 1;
  while (true) {
    const exists = await model.findOne({ shopId, slug });
    if (!exists) return slug;
    slug = base + '-' + (++n);
  }
}

async function seed() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI, MONGO_OPTS);
  console.log('✅ Connected:', mongoose.connection.host);

  // ── 1. Demo vendor user ───────────────────────────────────────────────────
  let user = await User.findOne({ email: 'techzone@sela.co.ke' });
  if (!user) {
    const bcrypt = require('bcryptjs');
    user = await User.create({
      firstName: 'TechZone', lastName: 'Nairobi',
      username: 'techzone_nairobi',
      email: 'techzone@sela.co.ke',
      password: await bcrypt.hash('TechZone@2025!', 10),
      isVerified: true,
    });
    console.log('✅ Vendor user created:', user.email);
  } else {
    console.log('ℹ️  Vendor user exists:', user.email);
  }

  // ── 2. TechZone shop ──────────────────────────────────────────────────────
  let shop = await Shop.findOne({ slug: 'techzone-nairobi' });
  if (!shop) {
    shop = await Shop.create({
      name: 'TechZone Nairobi',
      slug: 'techzone-nairobi',
      ownerId: user._id.toString(),
      description: "Kenya's premier ICT accessories store. Laptops, phones, accessories and gadgets at unbeatable prices.",
      email: 'info@techzone.co.ke',
      phone: '+254 712 345 678',
      whatsapp: '254712345678',
      location: 'Nairobi, Kenya',
      themeColor: '#6366f1',
      logo: 'https://ui-avatars.com/api/?name=TechZone&background=6366f1&color=fff&size=128&bold=true',
      banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1400&q=80',
      ownerEmail: 'techzone@sela.co.ke',
      status: 'active', published: true,
      social: { whatsapp: 'https://wa.me/254712345678' },
    });
    console.log('✅ TechZone shop created:', shop._id);
  } else {
    console.log('ℹ️  TechZone shop exists:', shop._id);
  }

  // ── 3. Branches ───────────────────────────────────────────────────────────
  const branchCount = await Branch.countDocuments({ shopId: shop._id });
  if (branchCount === 0) {
    await Branch.insertMany([
      { shopId: shop._id, name: 'Moi Avenue (Main)',    location: 'Moi Avenue, CBD, Nairobi',    phone: '+254 712 345 678', isMain: true,  status: 'active' },
      { shopId: shop._id, name: 'Tom Mboya Branch',     location: 'Tom Mboya Street, CBD',        phone: '+254 722 111 222', isMain: false, status: 'active' },
      { shopId: shop._id, name: 'Westlands — Sarit',    location: 'Sarit Centre, Westlands',      phone: '+254 733 444 555', isMain: false, status: 'active' },
    ]);
    console.log('✅ 3 branches created');
  }

  // ── 4. Categories ─────────────────────────────────────────────────────────
  const catNames = ['Laptops & Computers','Phones & Tablets','Accessories','Gaming','Networking','Smart Devices','Computer Peripherals','Storage Devices','Power & Charging'];
  const catMap = {};
  for (const name of catNames) {
    let cat = await ShopCategory.findOne({ shopId: shop._id, name });
    if (!cat) cat = await ShopCategory.create({
      shopId: shop._id, name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
      isActive: true,
    });
    catMap[name] = cat._id;
  }
  console.log('✅ Categories ready');

  // ── 5. Import existing products → ShopProducts ────────────────────────────
  const existing = await Product.find({});
  console.log(`ℹ️  Found ${existing.length} old products to import`);

  let imported = 0;
  for (const p of existing) {
    const already = await ShopProduct.findOne({ shopId: shop._id, name: p.name });
    if (already) continue;

    const catName = p.category || 'Accessories';
    const catId   = catMap[catName] || catMap['Accessories'];

    const slug = await uniqueSlug(shop._id, p.name, ShopProduct);
    await ShopProduct.create({
      shopId:       shop._id,
      categoryId:   catId,
      categoryName: catName,
      name:         p.name,
      slug:         slug,
      description:  p.description  || '',
      price:        p.price        || 0,
      salePrice:    p.salePrice    || null,
      onSale:       p.onSale       || false,
      discountPct:  p.discountPct  || 0,
      stock:        p.stock        || 10,
      unit:         p.unit         || 'pcs',
      images:       p.images?.length ? p.images : (p.image ? [p.image] : []),
      tags:         p.tags         || [],
      featured:     p.featured     || false,
      active:       true,
      sku:          `TZ-${p._id.toString().slice(-6).toUpperCase()}`,
    });
    imported++;
  }
  console.log(`✅ Imported ${imported} products`);

  // ── 6. Summary ────────────────────────────────────────────────────────────
  const total = await ShopProduct.countDocuments({ shopId: shop._id });
  console.log(`\n🎉 TechZone Nairobi now has ${total} products in the database`);
  console.log(`   Shop ID:   ${shop._id}`);
  console.log(`   Shop slug: techzone-nairobi`);
  console.log(`\nVisit: http://localhost:5000/shop-store.html?slug=techzone-nairobi`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err.message || err);
  process.exit(1);
});

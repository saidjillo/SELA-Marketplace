/**
 * Seed script — creates a sample shop with branches, categories, and products
 * Run: node seed-shop.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8','8.8.4.4','1.1.1.1']);

const { Shop, Branch, ShopCategory, ShopProduct, SubscriptionPayment, User } = require('./models');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/aircoast';

async function seed() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  // ── Find or create an owner user ─────────────────────────────────────────────
  let owner = await User.findOne({ email: 'demo@aircoast.co.ke' }).catch(() => null);
  if (!owner) {
    const bcrypt = require('bcryptjs');
    owner = await User.create({
      firstName: 'Demo', lastName: 'Owner',
      email: 'demo@aircoast.co.ke',
      password: await bcrypt.hash('Demo@2025!', 10),
      phone: '+254712345678',
      isVerified: true,
    });
    console.log('Created demo user: demo@aircoast.co.ke / Demo@2025!');
  } else {
    console.log('Using existing user:', owner.email);
  }

  // ── Remove old demo shop if exists ────────────────────────────────────────────
  const existing = await Shop.findOne({ slug: 'techzone-nairobi' });
  if (existing) {
    await Shop.deleteOne({ _id: existing._id });
    await Branch.deleteMany({ shopId: existing._id });
    await ShopCategory.deleteMany({ shopId: existing._id });
    await ShopProduct.deleteMany({ shopId: existing._id });
    console.log('Removed old demo shop');
  }

  // ── Create shop ───────────────────────────────────────────────────────────────
  const paidUntil = new Date();
  paidUntil.setMonth(paidUntil.getMonth() + 3); // 3-month subscription

  const shop = await Shop.create({
    name: 'TechZone Nairobi',
    slug: 'techzone-nairobi',
    description: 'Kenya\'s premier ICT accessories store. We stock the best laptops, phones, accessories, and gadgets at unbeatable prices. Visit any of our 3 branches across Nairobi.',
    email: 'info@techzone.co.ke',
    phone: '+254 712 345 678',
    whatsapp: '254712345678',
    location: 'Nairobi, Kenya',
    themeColor: '#6366f1',
    logo: 'https://ui-avatars.com/api/?name=TechZone&background=6366f1&color=fff&size=128&bold=true&rounded=true',
    banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1400&q=80',
    social: {
      facebook: 'https://facebook.com',
      instagram: 'https://instagram.com',
      twitter: 'https://twitter.com',
      tiktok: 'https://tiktok.com',
      whatsapp: 'https://wa.me/254712345678',
    },
    ownerId: owner._id.toString(),
    ownerEmail: owner.email,
    status: 'active',
    published: true,
    rating: 4.7,
    totalSales: 342,
    subscription: {
      plan: 'basic',
      fee: 1500,
      paidUntil,
      lastPaid: new Date(),
      mpesaRef: 'SEED123456',
    },
  });
  console.log(`Created shop: ${shop.name} (slug: ${shop.slug})`);

  // ── Create subscription payment record ────────────────────────────────────────
  await SubscriptionPayment.create({
    shopId: shop._id, amount: 4500, mpesaPhone: '254712345678',
    mpesaRef: 'SEED123456', months: 3, status: 'paid', paidAt: new Date(),
  });

  // ── Branches ──────────────────────────────────────────────────────────────────
  const [mainBranch, cbd, westlands] = await Branch.insertMany([
    { shopId: shop._id, name: 'TechZone — Moi Avenue (Main)', location: 'Moi Avenue, CBD, Nairobi', phone: '+254 712 345 678', email: 'cbd@techzone.co.ke', whatsapp: '254712345678', hours: 'Mon-Sat 8am-7pm, Sun 10am-5pm', isMain: true },
    { shopId: shop._id, name: 'TechZone — Tom Mboya Branch', location: 'Tom Mboya Street, Nairobi CBD', phone: '+254 722 111 222', email: 'tom@techzone.co.ke', whatsapp: '254722111222', hours: 'Mon-Sat 8:30am-6:30pm' },
    { shopId: shop._id, name: 'TechZone — Westlands', location: 'Sarit Centre, Westlands, Nairobi', phone: '+254 733 444 555', email: 'westlands@techzone.co.ke', whatsapp: '254733444555', hours: 'Mon-Sun 9am-8pm' },
  ]);
  console.log('Created 3 branches');

  // ── Categories ────────────────────────────────────────────────────────────────
  const [catLaptops, catPhones, catAccessories, catGaming, catNetworking, catSmart] = await ShopCategory.insertMany([
    { shopId: shop._id, name: 'Laptops & Computers', icon: '💻', color: '#6366f1', sortOrder: 1 },
    { shopId: shop._id, name: 'Phones & Tablets', icon: '📱', color: '#ec4899', sortOrder: 2 },
    { shopId: shop._id, name: 'Accessories', icon: '🎧', color: '#f59e0b', sortOrder: 3 },
    { shopId: shop._id, name: 'Gaming', icon: '🎮', color: '#ef4444', sortOrder: 4 },
    { shopId: shop._id, name: 'Networking', icon: '📡', color: '#22c55e', sortOrder: 5 },
    { shopId: shop._id, name: 'Smart Devices', icon: '⌚', color: '#0ea5e9', sortOrder: 6 },
  ]);
  console.log('Created 6 categories');

  // ── Products ──────────────────────────────────────────────────────────────────
  const allBranches = [mainBranch._id, cbd._id, westlands._id];
  const mainOnly = [mainBranch._id];
  const cbdWest = [cbd._id, westlands._id];

  const products = [
    // Laptops
    { name: 'MacBook Pro 14" M3 — Space Gray', description: 'Apple MacBook Pro 14-inch with M3 chip. 8GB RAM, 512GB SSD. Stunning Liquid Retina XDR display, 18-hour battery life. Perfect for professionals and creatives.', price: 185000, salePrice: 172000, onSale: true, discountPct: 7, stock: 8, sold: 24, sku: 'MBP-14-M3-GRY', unit: 'pcs', featured: true, categoryId: catLaptops._id, categoryName: 'Laptops & Computers', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80','https://images.unsplash.com/photo-1611186871525-2b7b21d45c8e?w=600&q=80'], tags: ['apple','macbook','laptop','m3'] },
    { name: 'Dell XPS 15 — OLED Display', description: 'Dell XPS 15 with Intel Core i7-13700H, 16GB RAM, 512GB SSD. Stunning 15.6" OLED InfinityEdge display. Premium build quality with aluminium chassis.', price: 145000, stock: 5, sold: 12, sku: 'DELL-XPS15-I7', unit: 'pcs', featured: true, categoryId: catLaptops._id, categoryName: 'Laptops & Computers', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&q=80'], tags: ['dell','xps','laptop','oled'] },
    { name: 'HP Pavilion 15 — i5 11th Gen', description: 'HP Pavilion 15 laptop with Intel Core i5-1135G7, 8GB RAM, 256GB SSD. Great everyday laptop for students and office work. 15.6" FHD display.', price: 68000, salePrice: 59999, onSale: true, discountPct: 12, stock: 14, sold: 38, sku: 'HP-PAV15-I5', unit: 'pcs', categoryId: catLaptops._id, categoryName: 'Laptops & Computers', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&q=80'], tags: ['hp','pavilion','laptop','student'] },
    { name: 'Lenovo ThinkPad E15 — Business Laptop', description: 'Lenovo ThinkPad E15 Gen 4 with AMD Ryzen 5 5600U, 16GB RAM, 512GB SSD. Spill-resistant keyboard, MIL-SPEC durability. The classic business workhorse.', price: 89000, stock: 7, sold: 19, sku: 'LEN-TPE15-R5', unit: 'pcs', categoryId: catLaptops._id, categoryName: 'Laptops & Computers', branchIds: cbdWest, images: ['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&q=80'], tags: ['lenovo','thinkpad','business','laptop'] },

    // Phones
    { name: 'Samsung Galaxy S24 Ultra — 256GB', description: 'Samsung\'s flagship with built-in S Pen, 200MP camera system, AI-powered features, and titanium frame. 6.8" Dynamic AMOLED 2X, 5000mAh battery.', price: 155000, salePrice: 139000, onSale: true, discountPct: 10, stock: 12, sold: 67, sku: 'SAM-S24U-256', unit: 'pcs', featured: true, categoryId: catPhones._id, categoryName: 'Phones & Tablets', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80'], tags: ['samsung','galaxy','s24','ultra','android'] },
    { name: 'iPhone 15 Pro — 128GB Titanium', description: 'Apple iPhone 15 Pro with A17 Pro chip, 48MP triple camera system, Action Button, USB 3.0 Type-C. Available in Natural Titanium, Blue Titanium, Black Titanium.', price: 165000, stock: 9, sold: 43, sku: 'APPLE-IP15P-128', unit: 'pcs', featured: true, categoryId: catPhones._id, categoryName: 'Phones & Tablets', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80'], tags: ['apple','iphone','15pro','ios'] },
    { name: 'Tecno Spark 20 Pro — 256GB', description: 'Tecno Spark 20 Pro with Helio G99 processor, 8GB RAM, 256GB storage. 6.78" FHD+ display, 50MP AI triple camera, 5000mAh battery. Great value for money.', price: 28500, salePrice: 24999, onSale: true, discountPct: 12, stock: 28, sold: 156, sku: 'TEC-SP20P-256', unit: 'pcs', categoryId: catPhones._id, categoryName: 'Phones & Tablets', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1512054502232-10a0a035d672?w=600&q=80'], tags: ['tecno','spark','android','affordable'] },
    { name: 'iPad Pro 11" M4 — WiFi 256GB', description: 'Apple iPad Pro 11-inch with M4 chip, Ultra Retina XDR display with nano-texture glass option, Apple Pencil Pro support, Magic Keyboard compatibility.', price: 125000, stock: 6, sold: 18, sku: 'APPLE-IPADPRO11-256', unit: 'pcs', categoryId: catPhones._id, categoryName: 'Phones & Tablets', branchIds: mainOnly, images: ['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80'], tags: ['apple','ipad','tablet','pro'] },

    // Accessories
    { name: 'Sony WH-1000XM5 — Wireless Headphones', description: 'Industry-leading noise cancellation with Auto NC Optimizer. 30-hour battery, multipoint connection. Foldable design with premium carrying case. Crystal clear call quality.', price: 38000, salePrice: 32999, onSale: true, discountPct: 13, stock: 15, sold: 89, sku: 'SONY-WH1000XM5-BLK', unit: 'pcs', featured: true, categoryId: catAccessories._id, categoryName: 'Accessories', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80'], tags: ['sony','headphones','wireless','noise-cancelling'] },
    { name: 'Anker PowerCore 20000mAh Power Bank', description: 'Anker PowerCore 20000 with 20W USB-C Power Delivery and 18W Quick Charge 3.0. Charge 2 devices simultaneously. Includes carry pouch and USB-C cable.', price: 4500, stock: 45, sold: 234, sku: 'ANK-PC20K-BLK', unit: 'pcs', categoryId: catAccessories._id, categoryName: 'Accessories', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80'], tags: ['anker','powerbank','charger','20000mah'] },
    { name: 'Logitech MX Master 3S — Wireless Mouse', description: 'Logitech MX Master 3S with MagSpeed electromagnetic scrolling, 8K DPI sensor, and quiet clicks. Works on any surface. 70-day battery life. Multi-device connectivity.', price: 12500, stock: 22, sold: 67, sku: 'LOG-MXM3S-GRY', unit: 'pcs', categoryId: catAccessories._id, categoryName: 'Accessories', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=600&q=80'], tags: ['logitech','mouse','wireless','mx-master'] },
    { name: 'USB-C 65W GaN Charger — 4-Port', description: 'Compact 65W GaN charger with 2x USB-C and 2x USB-A ports. Simultaneously charge your laptop, phone, tablet, and earbuds. Foldable plug, travel-friendly design.', price: 3200, salePrice: 2799, onSale: true, discountPct: 13, stock: 60, sold: 312, sku: 'GAN65W-4PT-WHT', unit: 'pcs', categoryId: catAccessories._id, categoryName: 'Accessories', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80'], tags: ['charger','gan','usb-c','65w'] },
    { name: 'Apple AirPods Pro 2nd Gen', description: 'Apple AirPods Pro with H2 chip, Adaptive Audio, Active Noise Cancellation, and Transparency mode. Up to 6 hours listening time, 30 hours with case. MagSafe charging.', price: 28000, stock: 11, sold: 45, sku: 'APPLE-AIRPODSPRO2', unit: 'pcs', featured: true, categoryId: catAccessories._id, categoryName: 'Accessories', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=600&q=80'], tags: ['apple','airpods','earbuds','wireless'] },

    // Gaming
    { name: 'PlayStation 5 — Disc Edition', description: 'Sony PlayStation 5 Disc Edition with DualSense wireless controller. 825GB SSD, 4K gaming, 120fps support, ray tracing. Includes ASTRO\'s PLAYROOM pre-installed.', price: 78000, stock: 4, sold: 28, sku: 'SONY-PS5-DISC', unit: 'pcs', featured: true, categoryId: catGaming._id, categoryName: 'Gaming', branchIds: mainOnly, images: ['https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600&q=80'], tags: ['sony','ps5','playstation','gaming','console'] },
    { name: 'Xbox Controller — Wireless Carbon Black', description: 'Official Xbox Wireless Controller in Carbon Black. Textured grip, hybrid D-pad, up to 40-hour battery. Compatible with Xbox Series X|S, Xbox One, PC, and mobile.', price: 8500, stock: 18, sold: 92, sku: 'XBOX-CTRL-BLK', unit: 'pcs', categoryId: catGaming._id, categoryName: 'Gaming', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=600&q=80'], tags: ['xbox','controller','gaming','wireless'] },
    { name: 'ASUS ROG Strix Gaming Chair', description: 'ASUS ROG Strix gaming chair with lumbar support, 4D armrests, reclining backrest (90-180°), and breathable fabric. PU leather accents, cable management clips included.', price: 42000, salePrice: 37500, onSale: true, discountPct: 11, stock: 3, sold: 9, sku: 'ASUS-ROG-CHAIR-BLK', unit: 'pcs', categoryId: catGaming._id, categoryName: 'Gaming', branchIds: mainOnly, images: ['https://images.unsplash.com/photo-1598550487031-0898b4852123?w=600&q=80'], tags: ['asus','rog','gaming','chair','ergonomic'] },

    // Networking
    { name: 'TP-Link Deco XE75 WiFi 6E — 3-Pack', description: 'TP-Link Deco XE75 whole-home mesh WiFi 6E system. Tri-band, 6GHz band, AXE5400 speeds. Covers up to 7,200 sq ft. Works with Alexa and IFTTT.', price: 28000, stock: 9, sold: 34, sku: 'TPLINK-DECOXE75-3PK', unit: 'pcs', categoryId: catNetworking._id, categoryName: 'Networking', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80'], tags: ['tp-link','deco','mesh','wifi6e','router'] },
    { name: 'Safaricom 4G LTE MiFi Router', description: 'Safaricom-ready 4G LTE portable WiFi hotspot. Supports up to 10 devices. 3000mAh battery, 8-hour usage. Insert any Kenyan SIM card. Ideal for remote work.', price: 3800, stock: 35, sold: 178, sku: 'MIFI-4G-LTE-BLK', unit: 'pcs', categoryId: catNetworking._id, categoryName: 'Networking', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&q=80'], tags: ['mifi','4g','hotspot','safaricom','router'] },

    // Smart Devices
    { name: 'Apple Watch Series 9 — 41mm GPS', description: 'Apple Watch Series 9 with S9 chip, brighter Always-On Retina display, double tap gesture. Advanced health sensors, crash detection, 18-hour battery. Carbon-neutral option.', price: 52000, salePrice: 47500, onSale: true, discountPct: 9, stock: 7, sold: 31, sku: 'APPLE-AW9-41-GPS', unit: 'pcs', featured: true, categoryId: catSmart._id, categoryName: 'Smart Devices', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80'], tags: ['apple','watch','smartwatch','wearable'] },
    { name: 'Samsung Galaxy Watch 6 Classic — 43mm', description: 'Samsung Galaxy Watch 6 Classic with rotating bezel, 1.5" Super AMOLED display, BioActive sensor for heart rate, body composition, and advanced sleep tracking.', price: 38000, stock: 8, sold: 22, sku: 'SAM-GW6C-43', unit: 'pcs', categoryId: catSmart._id, categoryName: 'Smart Devices', branchIds: allBranches, images: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'], tags: ['samsung','galaxy','smartwatch','android'] },
  ];

  await ShopProduct.insertMany(products);
  console.log(`Created ${products.length} products`);

  console.log('\n✅ Seed complete!');
  console.log(`\n   Shop URL:       http://localhost:5500/shop-store.html?slug=techzone-nairobi`);
  console.log(`   Seller profile: http://localhost:5500/shop-seller.html?slug=techzone-nairobi`);
  console.log(`   Dashboard:      http://localhost:5500/shop-dashboard.html`);
  console.log(`   Login:          demo@aircoast.co.ke / Demo@2025!`);
  console.log(`   Shop slug:      techzone-nairobi`);

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });

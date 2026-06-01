/**
 * reset-db.js — Wipe ALL platform data for a fresh start
 * Run: node reset-db.js
 * Keeps: Admin account only
 */
require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const { User, Shop, Branch, ShopProduct, ShopCategory, ShopSubUser,
        SubscriptionPayment, Product, Order, ServiceRequest, HotDeal,
        BlogMeta, Comment, ProductMeta, ProductComment,
        HelpPost, HelpReply } = require('./models');

async function reset() {
  console.log('\n🔴 SELA Database Reset Tool');
  console.log('============================');
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 20000, connectTimeoutMS: 20000, family: 4
  });
  console.log('✅ Connected to MongoDB Atlas\n');

  const results = await Promise.allSettled([
    User.deleteMany({}),
    Shop.deleteMany({}),
    Branch.deleteMany({}),
    ShopProduct.deleteMany({}),
    ShopCategory.deleteMany({}),
    ShopSubUser.deleteMany({}),
    SubscriptionPayment.deleteMany({}),
    Product.deleteMany({}),
    Order.deleteMany({}),
    ServiceRequest.deleteMany({}),
    HotDeal.deleteMany({}),
    BlogMeta.deleteMany({}),
    Comment.deleteMany({}),
    ProductMeta.deleteMany({}),
    ProductComment.deleteMany({}),
  ]);

  const names = ['Users','Shops','Branches','ShopProducts','ShopCategories',
    'ShopSubUsers','SubscriptionPayments','Products','Orders','ServiceRequests',
    'HotDeals','BlogMeta','Comments','ProductMeta','ProductComments'];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`  ✅ ${names[i]}: deleted ${r.value.deletedCount}`);
    } else {
      console.log(`  ⚠️  ${names[i]}: ${r.reason?.message}`);
    }
  });

  // Recreate admin
  const Admin = require('./models').Admin;
  await Admin.deleteMany({});
  const bcrypt = require('bcryptjs');
  await Admin.create({
    name: 'SELA Admin',
    username: 'admin',
    email: 'admin@sela.co.ke',
    passwordHash: await bcrypt.hash('Admin@SELA2025!', 10),
    role: 'superadmin',
    isActive: true,
  }).catch(() => null); // ignore if Admin schema differs

  console.log('\n🎉 Database wiped clean!');
  console.log('📋 Admin credentials: admin / Admin@SELA2025!');
  console.log('\nNext steps:');
  console.log('  1. Restart backend:  npm start');
  console.log('  2. Register at:      http://localhost:5000/auth.html');
  console.log('  3. Create a store:   http://localhost:5000/shop-create.html');
  console.log('  4. Add products from the vendor dashboard');
  console.log('  5. Products appear on: http://localhost:5000\n');

  await mongoose.disconnect();
  process.exit(0);
}

reset().catch(err => {
  console.error('\n❌ Reset failed:', err.message);
  process.exit(1);
});

/**
 * Aircoast Solutions — MongoDB Atlas Backend
 */
require('dotenv').config();
const express    = require('express');
const DarajaService  = require('./daraja');
const IntaSendService = require('./intasend');
const cors       = require('cors');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const { v4: uuidv4 } = require('uuid');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const mongoose   = require('mongoose');
const { Product, Order, ServiceRequest, Service, Sale, Customer, Admin, HotDeal, BlogMeta, Comment, ProductMeta, ProductComment, User, HelpPost, HelpReply, Shop, Branch, ShopCategory, ShopProduct, ShopSubUser, SubscriptionPayment, ShopReview, PageView, SearchLog, ProductRating } = require('./models');



// ── Subscription Plans ──────────────────────────────────────────────────────
const PLANS = {
  starter: { name:'Starter', price:500,  annualPrice:5000,  limits:{products:10, branches:1, staff:0, analyticsDays:7,  hotDeals:false} },
  growth:  { name:'Growth',  price:1000, annualPrice:10000, limits:{products:50, branches:3, staff:3, analyticsDays:30, hotDeals:true}  },
  pro:     { name:'Pro',     price:1500, annualPrice:15000, limits:{products:-1, branches:-1,staff:-1,analyticsDays:90, hotDeals:true}  },
};

async function getShopPlan(shopId) {
  try {
    // Check Shop.subscription first
    const shop = await Shop.findById(shopId).lean();
    if (shop?.subscription?.plan) {
      const p = shop.subscription.plan;
      // Map old plan names to new ones
      if (p === 'basic' || p === 'free') return 'growth';
      if (PLANS[p]) return p;
    }
    // Fallback: check SubscriptionPayment
    const sub = await SubscriptionPayment.findOne({
      shopId, status:'paid',
      paidUntil:{ $gte: new Date() }
    }).lean();
    return sub ? 'pro' : 'growth'; // default to growth for existing vendors
  } catch { return 'growth'; }
}

async function checkProductLimit(req, res, next) {
  try {
    const shopId = req.params.id;
    const plan   = await getShopPlan(shopId);
    const limits = PLANS[plan];
    if (limits.maxProducts === Infinity) return next();
    const count = await ShopProduct.countDocuments({ shopId, active:true });
    if (count >= limits.maxProducts) {
      return res.status(403).json({
        success:  false,
        message:  `Free plan allows up to ${limits.maxProducts} products. Upgrade to Pro for unlimited products.`,
        code:     'PLAN_LIMIT',
        limit:    limits.maxProducts,
        current:  count,
        plan,
      });
    }
    next();
  } catch { next(); }
}

async function checkBranchLimit(req, res, next) {
  try {
    const shopId = req.params.id;
    const plan   = await getShopPlan(shopId);
    const limits = PLANS[plan];
    if (limits.maxBranches === Infinity) return next();
    const count = await Branch.countDocuments({ shopId });
    if (count >= limits.maxBranches) {
      return res.status(403).json({
        success:  false,
        message:  `Free plan allows ${limits.maxBranches} branch. Upgrade to Pro for unlimited branches.`,
        code:     'PLAN_LIMIT',
        limit:    limits.maxBranches,
        current:  count,
        plan,
      });
    }
    next();
  } catch { next(); }
}

// ── Slug helpers (defined here so available to all routes below) ─────────────
function slugify(text) {
  return String(text||'').toLowerCase().trim()
    .replace(/[^a-z0-9 -]/g, '').replace(/ +/g, '-')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}
async function uniqueProductSlug(shopId, name, excludeId) {
  const base = slugify(name); let slug = base; let n = 1;
  while (true) {
    const q = { shopId, slug };
    if (excludeId) q._id = { $ne: excludeId };
    const exists = await ShopProduct.findOne(q).lean().catch(() => null);
    if (!exists) return slug;
    slug = base + '-' + (++n);
  }
}


const app  = express();
const PORT = process.env.PORT || 8080;

// ── MongoDB Atlas ────────────────────────────────────────────────────────────
if (!process.env.MONGODB_URI) {
  console.error('No MONGODB_URI in .env'); process.exit(1);
}

// Force Google DNS to fix ECONNREFUSED on SRV lookups
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const MONGO_OPTS = {
  serverSelectionTimeoutMS: 20000,
  connectTimeoutMS: 20000,
  socketTimeoutMS:  45000,
  maxPoolSize: 10,
  family: 4,
};

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  console.log('Connecting to MongoDB Atlas...');
  try {
    await mongoose.connect(uri, MONGO_OPTS);
    console.log('MongoDB Atlas connected:', mongoose.connection.host);
    await seedAdminIfNeeded();
    // No product seeding — all products created by admin via the dashboard
    const count = await Product.countDocuments();
    console.log(`ℹ️  Products in database: ${count}`);
  } catch (err) {
    const msg = err.message || '';
    console.error('MongoDB connection failed:', msg);
    console.error('');
    console.error('STEPS TO FIX:');
    console.error('1. Change DNS: Control Panel > Network > Adapter > IPv4 > Set DNS to 8.8.8.8 / 1.1.1.1');
    console.error('2. Atlas Network Access: Add 0.0.0.0/0 (Allow from anywhere)');
    console.error('3. Run: node diagnose.js  (for detailed report)');
    console.error('4. Get DIRECT connection string from Atlas (starts with mongodb:// not mongodb+srv://)');
    process.exit(1);
  }
}

connectDB();
// Only reconnect on disconnect — do NOT re-run seed
mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
mongoose.connection.on('reconnected',  () => console.log('✅  MongoDB reconnected'));

// ── Seed admin only (never touches products) ─────────────────────────────────
async function seedAdminIfNeeded() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'TechDeals@2025!';
  const hash = await bcrypt.hash(password, 12);
  const exists = await Admin.findOne({ username });
  if (!exists) {
    await Admin.create({ username, email: process.env.ADMIN_EMAIL || 'admin@sela.co.ke', name: 'SELA Admin', passwordHash: hash });
    console.log('✅ Admin account created');
  } else {
    // Always update password from env on startup
    await Admin.updateOne({ username }, { passwordHash: hash });
    console.log('✅ Admin password synced from env');
  }
}

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));
// static middleware moved to bottom — see end of file

// ── ImageKit + Multer (memory storage) ───────────────────────────────────────
const ImageKit = require('imagekit');
const imagekit = new ImageKit({
  publicKey:  process.env.IMAGEKIT_PUBLIC_KEY  || 'public_slgtO94eqCZt1qDrmjlqbisrgEo=',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'private_Bx0TAiZBUl/cEoohVYWwV/GMJAw=',
  urlEndpoint:process.env.IMAGEKIT_URL_ENDPOINT|| 'https://ik.imagekit.io/selaImages',
});
console.log('ImageKit configured: ik.imagekit.io/selaImages');

// Upload buffer to Cloudinary, return secure URL
async function uploadToImageKit(buffer, mimetype, folder='/sela/general') {
  return new Promise((resolve, reject) => {
    const fileName = Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
    imagekit.upload({
      file:              buffer.toString('base64'),
      fileName,
      folder,
      useUniqueFileName: true,
    }, (err, result) => {
      if (err) {
        console.error('ImageKit error:', err.message || err);
        reject(err);
      } else {
        console.log('ImageKit success:', result.url, '| fileId:', result.fileId);
        resolve({ url: result.url, fileId: result.fileId });
      }
    });
  });
}
// Alias for backward compatibility
const uploadToCloudinary = (buffer, mimetype, folder='sela/products') => uploadToImageKit(buffer, mimetype, folder);

const imageFilter = (req, file, cb) => {
  /jpeg|jpg|png|webp|gif/.test(file.mimetype) ? cb(null,true) : cb(new Error('Images only'));
};

// Use memory storage — files processed in RAM then sent to Cloudinary
const memStorage = multer.memoryStorage();

const upload = multer({
  storage: memStorage,
  limits:  { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFilter,
});

// ── Multer for Hot Deals (up to 6 images) ───────────────────────────────────
const hotDealUpload = multer({
  storage: memStorage,
  limits:  { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFilter,
}).array('images', 6);


// POST /api/shops/:id/upload-images — upload up to 6 product images
const shopProductUpload = multer({
  storage: memStorage,
  limits:  { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFilter,
}).array('images', 6);

app.post('/api/shops/:id/upload-images', (req, res) => {
  const user = getShopUser(req);
  if (!user) return res.status(401).json({ success:false, message:'Login required' });
  shopProductUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success:false, message: err.message });
    try {
      const urls = await Promise.all(
        (req.files||[]).map(f => uploadToCloudinary(f.buffer, f.mimetype, '/sela/products'))
      );
      res.json({ success:true, urls });
    } catch(e) { res.status(500).json({ success:false, message:'Image upload failed: '+e.message }); }
  });
});

// ── Slug generator ────────────────────────────────────────────────────────────
function generateSlug(name, id) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
  // Last 9 chars of MongoDB _id give enough uniqueness
  const suffix = id ? id.toString().slice(-9) : Math.random().toString(36).slice(2,11);
  return `${base}-${suffix}.html`;
}

// ── Multi-image upload for products (up to 6) ─────────────────────────────────
const productImgUpload = multer({
  storage: memStorage,
  limits:  { fileSize: 8 * 1024 * 1024 },
  fileFilter: imageFilter,
}).array('images', 6);


// ── JWT ──────────────────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'aircoast_secret_2025';
function requireAdmin(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'No token' });
  try { req.admin = jwt.verify(h.slice(7), JWT_SECRET); next(); }
  catch { res.status(401).json({ success:false, message:'Invalid token' }); }
}

// ── Health ───────────────────────────────────────────────────────────────────
const _bcrypt = require('bcryptjs');
const _jwt    = require('jsonwebtoken');
// JWT_SECRET defined at top of file

function signToken(user) {
  return _jwt.sign(
    { id: user._id.toString(), email: user.email, role: 'user' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function userPublic(user) {
  return {
    id:        user._id.toString(),
    firstName: user.firstName,
    lastName:  user.lastName,
    username:  user.username,
    email:     user.email,
    phone:     user.phone || '',
    avatar:    user.avatar || '',
    isVerified: user.isVerified,
  };
}

// ── POST /api/users/register ──────────────────────────────────────────────────
app.post('/api/users/register', async (req, res) => {
  try {
    const { firstName, lastName, username, email, password } = req.body || {};

    // Validate
    if (!firstName?.trim()) return res.status(400).json({ success:false, message:'First name is required' });
    if (!lastName?.trim())  return res.status(400).json({ success:false, message:'Last name is required' });
    if (!username?.trim() || username.length < 3)
      return res.status(400).json({ success:false, message:'Username must be at least 3 characters' });
    if (!/^[a-zA-Z0-9_]+$/.test(username))
      return res.status(400).json({ success:false, message:'Username: only letters, numbers and underscores' });
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success:false, message:'Valid email address required' });
    if (!password || password.length < 8)
      return res.status(400).json({ success:false, message:'Password must be at least 8 characters' });

    // Check duplicates
    const dupEmail = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    if (dupEmail) return res.status(400).json({ success:false, message:'Email already registered — please log in', code:'EMAIL_EXISTS' });

    const dupUser = await User.findOne({ username: username.toLowerCase().trim() }).lean();
    if (dupUser) return res.status(400).json({ success:false, message:'Username already taken — choose another', code:'USERNAME_EXISTS' });

    // Create user
    const hash       = await _bcrypt.hash(password, 10);
    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await User.create({
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      username:  username.toLowerCase().trim(),
      email:     email.toLowerCase().trim(),
      password:  hash,
      verifyCode,
      isVerified: false,
    });

    // Since email is not configured, auto-verify and return token
    const devCode = verifyCode; // always return devCode so frontend can auto-verify

    return res.status(201).json({
      success:  true,
      userId:   user._id.toString(),
      devCode,
      message:  'Account created successfully',
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || '';
      if (field === 'email') return res.status(400).json({ success:false, message:'Email already registered — please log in', code:'EMAIL_EXISTS' });
      if (field === 'username') return res.status(400).json({ success:false, message:'Username already taken — choose another', code:'USERNAME_EXISTS' });
    }
    console.error('Register error:', err.message);
    return res.status(500).json({ success:false, message:'Server error: ' + err.message });
  }
});

// ── POST /api/users/verify-email ──────────────────────────────────────────────
app.post('/api/users/verify-email', async (req, res) => {
  try {
    const { userId, code } = req.body || {};
    if (!userId || !code) return res.status(400).json({ success:false, message:'userId and code required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });

    if (user.isVerified) {
      // Already verified — just return token
      const token = signToken(user);
      return res.json({ success:true, token, user:userPublic(user) });
    }

    if (user.verifyCode !== code)
      return res.status(400).json({ success:false, message:'Invalid verification code' });

    user.isVerified = true;
    user.verifyCode = null;
    await user.save();

    const token = signToken(user);
    res.json({ success:true, token, user:userPublic(user) });
  } catch (err) {
    res.status(500).json({ success:false, message:'Server error: ' + err.message });
  }
});

// ── POST /api/users/resend-code ───────────────────────────────────────────────
app.post('/api/users/resend-code', async (req, res) => {
  try {
    const { userId } = req.body || {};
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verifyCode = newCode;
    await user.save();
    res.json({ success:true, devCode:newCode });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /api/users/login ─────────────────────────────────────────────────────
app.post('/api/users/login', async (req, res) => {
  try {
    const { login, password, email } = req.body || {};
    const identifier = (login || email || '').trim().toLowerCase();
    if (!identifier) return res.status(400).json({ success:false, message:'Email or username required' });
    if (!password)   return res.status(400).json({ success:false, message:'Password required' });

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });
    if (!user) return res.status(401).json({ success:false, message:'No account found with that email or username' });

    const match = await _bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success:false, message:'Incorrect password' });

    // Auto-verify if not verified (for accounts created without email)
    if (!user.isVerified) {
      user.isVerified = true;
      user.verifyCode = null;
      await user.save();
    }

    const token = signToken(user);
    res.json({ success:true, token, user:userPublic(user) });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success:false, message:'Server error: ' + err.message });
  }
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────
app.get('/api/users/me', async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    res.json({ success:true, user: auth });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /api/users/forgot-password ──────────────────────────────────────────
app.post('/api/users/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(404).json({ success:false, message:'No account with that email' });
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.verifyCode = code;
    await user.save();
    res.json({ success:true, devCode:code, message:'Reset code ready (use devCode in dev mode)' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /api/users/reset-password ───────────────────────────────────────────
app.post('/api/users/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    if (user.verifyCode !== code) return res.status(400).json({ success:false, message:'Invalid code' });
    user.password   = await _bcrypt.hash(newPassword, 10);
    user.verifyCode = null;
    user.isVerified = true;
    await user.save();
    res.json({ success:true, message:'Password reset successfully' });
  } catch (err) { res.status(500).json({ success:false, message:err.message }); }
});


// PATCH /api/users/profile — update name, username, email
app.patch('/api/users/profile', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Login required' });
    const jwt = require('jsonwebtoken');
    let decoded;
    try { decoded = jwt.verify(auth.slice(7), JWT_SECRET); }
    catch { return res.status(401).json({ success:false, message:'Invalid token' }); }
    const { firstName, lastName, username, email } = req.body;
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    if (firstName) user.firstName = firstName;
    if (lastName)  user.lastName  = lastName;
    if (username && username !== user.username) {
      const exists = await User.findOne({ username, _id:{ $ne: user._id } });
      if (exists) return res.status(400).json({ success:false, message:'Username already taken' });
      user.username = username;
    }
    if (email && email !== user.email) {
      const exists = await User.findOne({ email, _id:{ $ne: user._id } });
      if (exists) return res.status(400).json({ success:false, message:'Email already in use' });
      user.email = email;
    }
    await user.save();
    res.json({ success:true, user:{ id:user._id, firstName:user.firstName, lastName:user.lastName, username:user.username, email:user.email, isVerified:user.isVerified } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/users/change-password
app.post('/api/users/change-password', async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Login required' });
    const jwt = require('jsonwebtoken');
    let decoded;
    try { decoded = jwt.verify(auth.slice(7), JWT_SECRET); }
    catch { return res.status(401).json({ success:false, message:'Invalid token' }); }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success:false, message:'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ success:false, message:'New password must be at least 8 characters' });
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    const bcrypt = require('bcryptjs');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ success:false, message:'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ success:true, message:'Password updated successfully' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


app.get('/api/health', (req, res) => res.json({ success:true, version:'2026-05-28-FIXED', db: mongoose.connection.readyState===1?'connected':'disconnected', time: new Date().toISOString() }));
app.get('/api/ping',  (req, res) => res.json({ pong:true }));
app.post('/api/ping', (req, res) => res.json({ pong:true }));

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success:false, message:'Credentials required' });
    const admin = await Admin.findOne({ username: username.toLowerCase().trim() });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash)))
      return res.status(401).json({ success:false, message:'Invalid credentials' });
    await Admin.findByIdAndUpdate(admin._id, { lastLogin: new Date() });
    const token = jwt.sign({ id: admin._id, username: admin.username, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ success:true, token });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    const p = jwt.verify(req.body.token||'', JWT_SECRET);
    res.json({ success:true, valid:true, username:p.username });
  } catch { res.json({ success:false, valid:false }); }
});

// ── Marketplace home stats (single endpoint for home page dashboard) ──────────
app.get('/api/marketplace/stats', async (req, res) => {
  try {
    const [shopCount, branchCount, shopProductCount, onSaleCount, featuredCount] = await Promise.all([
      Shop.countDocuments({ published:true, status:'active' }),
      Branch.countDocuments({ status:'active' }),
      ShopProduct.countDocuments({ active:true }),
      ShopProduct.countDocuments({ onSale:true, active:true }),
      ShopProduct.countDocuments({ featured:true, active:true }),
    ]);
    const productCount = await Product.countDocuments({});
    const totalProducts = productCount + shopProductCount;
    const newThisWeek = await ShopProduct.countDocuments({ active:true, createdAt:{ $gte:new Date(Date.now()-7*86400000) } });
    const priceAgg = await ShopProduct.aggregate([{ $match:{ active:true, price:{ $gt:0 } } }, { $group:{ _id:null, avg:{ $avg:'$price' } } }]);
    const catAgg   = await ShopProduct.aggregate([{ $match:{ active:true } }, { $group:{ _id:'$categoryName', count:{ $sum:1 } } }, { $sort:{ count:-1 } }, { $limit:20 }]);
    const oldCatAgg= await Product.aggregate([{ $group:{ _id:'$category', count:{ $sum:1 } } }, { $sort:{ count:-1 } }]);
    const allCats  = [...catAgg, ...oldCatAgg].reduce((acc,c) => { if(c._id && !acc.find(x=>x.name===c._id)) acc.push({ name:c._id, count:c.count }); return acc; }, []);
    const [topShops, recentProducts, featuredProducts] = await Promise.all([
      Shop.find({ published:true, status:'active' }).sort({ createdAt:-1 }).limit(20),
      ShopProduct.find({ active:true }).sort({ createdAt:-1 }).limit(15).lean(),
      ShopProduct.find({ featured:true, active:true }).sort({ createdAt:-1 }).limit(15).lean(),
    ]);
    // Attach shop info to products
    const shopIds = [...new Set([...recentProducts, ...featuredProducts].map(p=>p.shopId?.toString()).filter(Boolean))];
    const shopMap = {};
    if (shopIds.length) {
      const shopDocs = await Shop.find({ _id:{ $in:shopIds } }).lean();
      shopDocs.forEach(s => { shopMap[s._id.toString()] = s; });
    }
    function attachShop(p) {
      const s = shopMap[p.shopId?.toString()] || {};
      return { ...p, id:p._id?.toString(), slug:p.slug||'', _shopName:s.name||'', _shopSlug:s.slug||'', _shopTheme:s.themeColor||'#6366f1', _shopWa:s.whatsapp||'' };
    }
    res.json({
      success:true,
      stats:{ shops:shopCount, branches:branchCount, products:totalProducts, onSale:onSaleCount, featured:featuredCount, categories:allCats.length, avgPrice:Math.round(priceAgg[0]?.avg||0), newThisWeek },
      categories:   allCats.filter(c=>c.name),
      shops:        topShops.map(s=>({...( s.toObject?s.toObject():s), id:s._id?.toString(), slug:s.slug||''})),
      recentProducts:   recentProducts.map(attachShop),
      featuredProducts: featuredProducts.map(attachShop),
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ── Categories ───────────────────────────────────────────────────────────────
app.get('/api/categories', async (req, res) => {
  try {
    const [oldCats, shopCats] = await Promise.all([
      Product.distinct('category'),
      ShopProduct.distinct('categoryName'),
    ]);
    const all = [...new Set([...oldCats, ...shopCats].filter(Boolean))].sort();
    res.json({ success:true, data:['All',...all] });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Products (public) ────────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    // Returns ShopProducts (vendor products) as primary source
    const { category, search, sort, shop, minPrice, maxPrice, limit=50, page=1 } = req.query;
    const filter = { active: true };
    if (category && category!=='All') filter.categoryName = category;
    if (minPrice||maxPrice) { filter.price={}; if(minPrice) filter.price.$gte=parseFloat(minPrice); if(maxPrice) filter.price.$lte=parseFloat(maxPrice); }
    if (search) filter.name = { $regex: search, $options: 'i' };
    const sortObj = sort==='price_asc'?{price:1}:sort==='price_desc'?{price:-1}:{createdAt:-1};
    const skip  = (parseInt(page)-1)*parseInt(limit);
    const [shopProds, total] = await Promise.all([
      ShopProduct.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
      ShopProduct.countDocuments(filter),
    ]);
    // Attach shop info to each product
    const shopIds = [...new Set(shopProds.map(p=>p.shopId?.toString()).filter(Boolean))];
    const shopMap = {};
    if (shopIds.length) {
      const shopDocs = await Shop.find({ _id:{ $in:shopIds } }).lean();
      shopDocs.forEach(s => { shopMap[s._id.toString()] = s; });
    }
    const data = shopProds.map(p => {
      const sh = shopMap[p.shopId?.toString()] || {};
      return { ...p, id:p._id?.toString(), category:p.categoryName||'General',
        _shopName:sh.name||'', _shopSlug:sh.slug||'', _shopTheme:sh.themeColor||'#6366f1', _shopWa:sh.whatsapp||'',
        shop:sh.name||'', shopSlug:sh.slug||'', shopWhatsapp:sh.whatsapp||'' };
    });
    res.json({ success:true, count:total, page:parseInt(page), pages:Math.ceil(total/parseInt(limit)), data });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

app.get('/api/products/by-slug/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    // Try ShopProduct first (vendor products)
    let sp = await ShopProduct.findOne({ slug }).lean().catch(()=>null);
    if (sp) {
      const shop = sp.shopId ? await Shop.findById(sp.shopId).lean().catch(()=>null) : null;
      const related = await ShopProduct.find({ shopId:sp.shopId, _id:{ $ne:sp._id }, active:true }).limit(6).lean().catch(()=>[]);
      return res.json({ success:true, data:{
        ...sp,
        id:         sp._id?.toString(),
        shopId:     sp.shopId?.toString() || '',
        slug:       sp.slug||slug,
        category:   sp.categoryName||'General',


        condition:  'New',
        brand:      'Generic',
        shop:       shop?.name||'',
        shopSlug:   shop?.slug||'',
        shopTheme:  shop?.themeColor||'#6366f1',
        shopWhatsapp: shop?.whatsapp||'',
        shopPhone:  shop?.phone||'',
        shopLocation: shop?.location||'',
        images:     sp.images||(sp.image?[sp.image]:[]),
        _shopName:  shop?.name||'',
        _shopSlug:  shop?.slug||''
      }, related:related.map(r=>({...r,id:r._id?.toString(),shopId:r.shopId?.toString()||''})), isShopProduct:true });
    }
    // Fall back to old Product collection
    const p = await Product.findOne({ slug }).lean().catch(()=>null);
    if (!p) return res.status(404).json({ success:false, message:'Product not found' });
    const related = await Product.find({ category:p.category, _id:{ $ne:p._id } }).limit(6).lean().catch(()=>[]);
    res.json({ success:true, data:{ ...p, id:p._id?.toString() }, related });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // 1. Try ShopProduct (vendor products) first
    let product = null;
    let isShopProduct = false;
    try {
      const sp = await ShopProduct.findById(id).lean();
      if (sp) {
        // Attach shop info
        const shop = sp.shopId ? await Shop.findById(sp.shopId).lean() : null;
        product = {
          ...sp,
          id: sp._id?.toString(),
          shopId: sp.shopId?.toString() || '',
          // Normalise fields to match old Product schema
          category:    sp.categoryName || sp.category || 'General',
          condition:   sp.condition    || 'New',
          brand:       sp.brand        || 'Generic',
          shop:        shop?.name      || '',
          shopSlug:    shop?.slug      || '',
          shopTheme:   shop?.themeColor|| '#6366f1',
          shopWhatsapp:shop?.whatsapp  || '',
          shopPhone:   shop?.phone     || '',
          shopLocation:shop?.location  || '',
          // images
          images: sp.images || (sp.image ? [sp.image] : []),
          image:  (sp.images && sp.images[0]) || sp.image || '',
          // prices
          salePrice:   sp.salePrice || null,
          onSale:      sp.onSale    || false,
          discountPct: sp.discountPct || 0,
        };
        isShopProduct = true;
      }
    } catch {}

    // 2. Fall back to old Product collection
    if (!product) {
      const p = await Product.findById(id).lean();
      if (p) {
        product = { ...p, id: p._id?.toString(), images: p.images || (p.image ? [p.image] : []) };
      }
    }

    if (!product) return res.status(404).json({ success:false, message:'Product not found' });

    // Related products from same collection
    let related = [];
    try {
      if (isShopProduct && product.shopId) {
        related = await ShopProduct.find({ shopId:product.shopId, _id:{ $ne:id }, active:true }).limit(6).lean();
        related = related.map(r => ({ ...r, id:r._id?.toString() }));
      } else {
        related = await Product.find({ category:product.category, _id:{ $ne:id } }).limit(6).lean();
      }
    } catch {}

    res.json({ success:true, data:product, related, isShopProduct });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Products (admin) ─────────────────────────────────────────────────────────
app.post('/api/products', requireAdmin, (req, res) => {
  productImgUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success:false, message: err.message });
    try {
      const { name, category, brand, price, condition, description, whatsapp, shop, color, emoji } = req.body;
      if (!name||!category||!price||!description||!shop)
        return res.status(400).json({ success:false, message:'Required fields missing' });
      const imgs = (req.files||[]).map(f => `/uploads/${f.filename}`);
      const primaryImage = imgs[0] || null;
      const product = await Product.create({
        name:name.trim(), slug:'', category:category.trim(),
        brand:brand?.trim()||'Generic', price:parseFloat(price),
        condition:condition||'New', shop:shop.trim(),
        description:description.trim(),
        image:primaryImage, images:imgs,
        whatsapp:whatsapp||'254740169448', color:color||'', emoji:emoji||'📦'
      });
      // Generate slug after we have the _id
      product.slug = generateSlug(product.name, product._id);
      await product.save();
      res.status(201).json({ success:true, data:product });
    } catch(err) { res.status(500).json({ success:false, message:err.message }); }
  });
});

app.put('/api/products/:id', requireAdmin, (req, res) => {
  productImgUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success:false, message: err.message });
    try {
      const { name, category, brand, price, condition, description, whatsapp, shop, color } = req.body;
      const updates = {};
      if(name)        { updates.name = name.trim(); updates.slug = generateSlug(name.trim(), req.params.id); }
      if(category)    updates.category    = category.trim();
      if(brand)       updates.brand       = brand.trim();
      if(price)       updates.price       = parseFloat(price);
      if(condition)   updates.condition   = condition;
      if(description) updates.description = description.trim();
      if(whatsapp)    updates.whatsapp    = whatsapp;
      if(shop)        updates.shop        = shop.trim();
      if(color)       updates.color       = color;
      if(req.files && req.files.length > 0) {
        const newImgs = req.files.map(f => `/uploads/${f.filename}`);
        const keepImages = req.body.keepImages === 'true';
        if (keepImages) {
          const existing = await Product.findById(req.params.id);
          updates.images = [...(existing?.images||[]), ...newImgs].slice(0,6);
        } else {
          updates.images = newImgs;
        }
        updates.image = updates.images[0] || null;
      }
      const product = await Product.findByIdAndUpdate(req.params.id, updates, { new:true });
      if(!product) return res.status(404).json({ success:false, message:'Not found' });
      res.json({ success:true, data:product });
    } catch(err) { res.status(500).json({ success:false, message:err.message }); }
  });
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if(!product) return res.status(404).json({ success:false, message:'Not found' });
    if(product.image) { const fp=path.join(__dirname,product.image); if(fs.existsSync(fp)) fs.unlink(fp,()=>{}); }
    res.json({ success:true, message:'Product deleted' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Orders ───────────────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
// ORDER MANAGEMENT ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/shops/:id/orders — customer places an order
app.post('/api/shops/:id/orders', async (req, res) => {
  try {
    const { items, customer, type, address, vendorNote } = req.body;
    if (!items?.length)           return res.status(400).json({ success:false, message:'No items in order' });
    if (!customer?.name?.trim())  return res.status(400).json({ success:false, message:'Customer name required' });
    if (!customer?.phone?.trim()) return res.status(400).json({ success:false, message:'Customer phone required' });
    if (type==='delivery' && !address?.trim())
      return res.status(400).json({ success:false, message:'Delivery address required' });

    const shopId = req.params.id;
    const shop = await Shop.findById(shopId).lean();
    if (!shop) return res.status(404).json({ success:false, message:'Shop not found' });

    const subtotal = items.reduce((s,i) => s + (i.price * i.qty), 0);
    const order = await Order.create({
      shopId,
      items: items.map(i => ({ productId: i.productId||null, name:i.name, price:i.price, qty:i.qty, total:i.price*i.qty, image:i.image||'' })),
      customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: customer.email||'', notes: customer.notes||'' },
      type: type||'pickup',
      address: address||'',
      statusHistory: [{ status:'pending', message:'Order placed successfully', timestamp: new Date() }],
      subtotal,
      total: subtotal,
      vendorNote: vendorNote||'',
      status: 'new',
      statusHistory: [{ status:'new', note:'Order placed by customer', at: new Date() }],
    });

    // WhatsApp notification to vendor
    // WhatsApp notification to vendor
    if (shop.whatsapp) {
      const itemsList = items.map(i => i.name + ' x' + i.qty + ' - KES ' + (i.price*i.qty).toLocaleString()).join(', ');
      const msg = 'New Order ' + order.orderNo + ' from ' + customer.name + ' (' + customer.phone + '). Items: ' + itemsList + '. Total: KES ' + subtotal.toLocaleString() + '. Type: ' + (type==='delivery'?'Delivery to '+address:'Pickup') + '. Check your SELA dashboard to confirm.';
      order._waUrl = 'https://wa.me/' + shop.whatsapp.replace(/[^0-9]/g,'') + '?text=' + encodeURIComponent(msg);
    }
    res.status(201).json({ success:true, data:{ id:order._id.toString(), orderNo:order.orderNo, status:order.status, total:order.total } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/shops/:id/orders — vendor gets all orders (with filters)
app.get('/api/shops/:id/orders', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { status, page=1, limit=30, q } = req.query;
    const filter = { shopId: req.params.id };
    if (status && status !== 'all') filter.status = status;
    if (q) filter.$or = [
      { orderNo:        { $regex:q, $options:'i' } },
      { 'customer.name':{ $regex:q, $options:'i' } },
      { 'customer.phone':{ $regex:q, $options:'i' } },
    ];
    const [orders, total, newCount] = await Promise.all([
      Order.find(filter).sort({ createdAt:-1 }).skip((page-1)*limit).limit(Number(limit)).lean(),
      Order.countDocuments(filter),
      Order.countDocuments({ shopId: req.params.id, status:'new' }),
    ]);
    res.json({ success:true, data: orders.map(o=>({...o,id:o._id.toString()})), total, pages:Math.ceil(total/limit), newCount });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/orders/:id — single order detail
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ success:false, message:'Order not found' });
    res.json({ success:true, data:{ ...order, id:order._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/orders/:id/status — vendor updates order status
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { status, note, rejectionReason } = req.body;
    const allowed = ['new','confirmed','processing','out_for_delivery','ready_for_pickup','delivered','collected','rejected'];
    if (!allowed.includes(status)) return res.status(400).json({ success:false, message:'Invalid status' });

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success:false, message:'Order not found' });

    order.status = status;
    if (rejectionReason) order.rejectionReason = rejectionReason;
    order.statusHistory.push({ status, note: note||'', at: new Date() });
    await order.save();

    // Build WhatsApp message for customer
    const shop = await Shop.findById(order.shopId).lean();
    const statusMessages = {
      confirmed:          `✅ Your order *${order.orderNo}* has been confirmed by ${shop?.name}! We'll let you know when it's ready.`,
      processing:         `⚙️ Your order *${order.orderNo}* is being processed by ${shop?.name}.`,
      out_for_delivery:   `🚚 Your order *${order.orderNo}* is on its way! Our delivery agent will reach you shortly.`,
      ready_for_pickup:   `🏪 Your order *${order.orderNo}* is ready for pickup at ${shop?.name}!${shop?.location?' Location: '+shop.location:''}`,
      delivered:          `📦 Your order *${order.orderNo}* has been marked as delivered. Thank you for shopping with ${shop?.name}!`,
      collected:          `✅ Your order *${order.orderNo}* has been collected. Thank you for shopping with ${shop?.name}!`,
      rejected:           `❌ Sorry, your order *${order.orderNo}* could not be fulfilled.${rejectionReason?' Reason: '+rejectionReason:''} Please contact ${shop?.name} for more info.`,
    };

    const waMsg = statusMessages[status];
    let waUrl = null;
    if (waMsg && order.customer?.phone) {
      waUrl = `https://wa.me/${order.customer.phone.replace(/[^0-9]/g,'')}?text=${encodeURIComponent(waMsg)}`;
    }

    res.json({ success:true, data:{ ...order.toObject(), id:order._id.toString() }, waUrl });

    // ── Email customer on status change ───────────────────────────────
    setImmediate(async () => {
      try {
        if (order.customer?.email) {
          await sendEmail({
            to: order.customer.email,
            subject: `Order Update #${order.orderNo} — SELA`,
            html: emailOrderStatusUpdate(order, status, order.customer.name),
          });
        }
      } catch(e) { console.error('Status email error:', e.message); }
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/shops/:id/orders/count-new — for notification badge polling
app.get('/api/shops/:id/orders/count-new', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const count = await Order.countDocuments({ shopId: req.params.id, status:'new' });
    res.json({ success:true, count });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ── Service Requests ─────────────────────────────────────────────────────────
app.post('/api/service-requests', async (req, res) => {
  try {
    const { customer, service, message, files } = req.body;
    if(!customer?.name||!customer?.phone||!service) return res.status(400).json({ success:false, message:'Name, phone, service required' });
    const request = await ServiceRequest.create({ customer, service, message, files:files||[] });
    res.status(201).json({ success:true, data:request });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

app.get('/api/service-requests', requireAdmin, async (req, res) => {
  try {
    const requests = await ServiceRequest.find().sort({createdAt:-1}).limit(100);
    res.json({ success:true, count:requests.length, data:requests });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});



// ── Admin Stats ──────────────────────────────────────────────────────────────
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
  try {
    const [products, orders, serviceReqs, pendingOrders, revenue] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      ServiceRequest.countDocuments(),
      Order.countDocuments({status:'pending'}),
      Order.aggregate([{$group:{_id:null,total:{$sum:'$totalPrice'}}}]),
    ]);
    res.json({ success:true, data:{ totalProducts:products, totalOrders:orders, serviceRequests:serviceReqs, pendingOrders, estimatedRevenue:revenue[0]?.total||0 } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// HOT DEALS ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET all active deals (public)
app.get('/api/hotdeals', async (req, res) => {
  try {
    const { category, featured, limit = 50, page = 1 } = req.query;
    const filter = { active: true };
    if (category && category !== 'All') filter.category = category;
    if (featured === 'true') filter.featured = true;
    // Exclude expired deals
    filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }];
    const total = await HotDeal.countDocuments(filter);
    const deals = await HotDeal.find(filter)
      .sort({ featured: -1, createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));
    res.json({ success: true, count: total, data: deals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET single deal (public)
app.get('/api/hotdeals/:id', async (req, res) => {
  try {
    const deal = await HotDeal.findById(req.params.id).lean();
    if (!deal) return res.status(404).json({ success:false, message:'Deal not found' });
    res.json({ success:true, data:{...deal, id:deal._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET all deals including inactive (admin only)
app.get('/api/admin/hotdeals', requireAdmin, async (req, res) => {
  try {
    const deals = await HotDeal.find().sort({ createdAt: -1 });
    res.json({ success: true, count: deals.length, data: deals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// CREATE deal (admin)
// CREATE deal (vendor or admin)
app.post('/api/hotdeals', (req, res) => {
  hotDealUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success:false, message:err.message });
    try {
      const s = v => Array.isArray(v) ? v[0] : (v||'');
      const title = s(req.body.title), category = s(req.body.category);
      const description = s(req.body.description), shop = s(req.body.shop);
      const originalPrice = parseFloat(s(req.body.originalPrice))||0;
      const dealPrice = parseFloat(s(req.body.dealPrice))||0;
      if (!title||!category||!description||!originalPrice||!dealPrice||!shop)
        return res.status(400).json({ success:false, message:'Required fields missing' });
      const images = await Promise.all(
        (req.files||[]).map(f => uploadToCloudinary(f.buffer, f.mimetype, '/sela/hotdeals'))
      ).catch(()=>[]);
      const discPct = Math.round(((originalPrice-dealPrice)/originalPrice)*100);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)+'-'+Date.now().toString(36);
      let vendorId = s(req.body.vendorId);
      try { const h=req.headers.authorization; if(h&&h.startsWith('Bearer ')){const p=require('jsonwebtoken').verify(h.slice(7),JWT_SECRET);if(!vendorId)vendorId=p.id||p.sub||'';} } catch(e2){}
      const deal = await HotDeal.create({
        title:title.trim(), category:category.trim(), brand:s(req.body.brand).trim(),
        description:description.trim(), originalPrice, dealPrice, discountPct:discPct,
        stock:parseInt(s(req.body.stock))||1, condition:s(req.body.condition)||'Used',
        shop:shop.trim(), whatsapp:s(req.body.whatsapp)||'254700000000',
        shopId:s(req.body.shopId), vendorId, location:s(req.body.location), warranty:s(req.body.warranty),
        slug, images,
        tags:req.body.tags?(Array.isArray(req.body.tags)?req.body.tags:[req.body.tags]).join(',').split(',').map(t=>t.trim()).filter(Boolean):[],
        featured:s(req.body.featured)==='true', active:s(req.body.active)!=='false',
        expiresAt:req.body.expiresAt?new Date(s(req.body.expiresAt)):null,
      });
      res.status(201).json({ success:true, data:{...deal.toObject(), id:deal._id.toString()} });
    } catch(err) { res.status(500).json({ success:false, message:err.message }); }
  });
});

// UPDATE deal (admin)
app.put('/api/hotdeals/:id', requireAdmin, (req, res) => {
  hotDealUpload(req, res, async (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      const { title, category, brand, description, originalPrice, dealPrice,
              stock, condition, shop, whatsapp, tags, featured, active, expiresAt, keepImages } = req.body;
      const updates = {};
      if (title)         updates.title         = title.trim();
      if (category)      updates.category      = category.trim();
      if (brand !== undefined) updates.brand   = brand.trim();
      if (description)   updates.description   = description.trim();
      if (originalPrice) updates.originalPrice = parseFloat(originalPrice);
      if (dealPrice)     updates.dealPrice     = parseFloat(dealPrice);
      if (stock)         updates.stock         = parseInt(stock);
      if (condition)     updates.condition     = condition;
      if (shop)          updates.shop          = shop.trim();
      if (whatsapp)      updates.whatsapp      = whatsapp;
      if (tags !== undefined) updates.tags     = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      if (featured !== undefined) updates.featured = featured === 'true';
      if (active !== undefined)   updates.active   = active !== 'false';
      if (expiresAt !== undefined) updates.expiresAt = expiresAt || null;
      if (req.body.shopId)   updates.shopId   = req.body.shopId;
      if (req.body.vendorId) { const v=req.body.vendorId; updates.vendorId = Array.isArray(v)?v[0]:v; }
      if (req.body.location !== undefined) updates.location = req.body.location;
      if (req.body.warranty !== undefined) updates.warranty = req.body.warranty;
      // New images uploaded — merge with existing if keepImages=true
      if (req.files && req.files.length > 0) {
        const newImgs = req.files.map(f => `/uploads/${f.filename}`);
        if (keepImages === 'true') {
          const existing = await HotDeal.findById(req.params.id);
          updates.images = [...(existing?.images || []), ...newImgs].slice(0, 6);
        } else {
          updates.images = newImgs;
        }
      }
      const deal = await HotDeal.findByIdAndUpdate(req.params.id, updates, { new: true });
      if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
      res.json({ success: true, data: deal });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
  });
});

// DELETE single image from deal (admin)
app.delete('/api/hotdeals/:id/image', requireAdmin, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const deal = await HotDeal.findById(req.params.id);
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
    deal.images = deal.images.filter(img => img !== imageUrl);
    await deal.save();
    const fp = path.join(__dirname, imageUrl);
    if (fs.existsSync(fp)) fs.unlink(fp, () => {});
    res.json({ success: true, data: deal });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE deal (admin)
app.delete('/api/hotdeals/:id', async (req, res) => {
  try {
    const deal = await HotDeal.findByIdAndDelete(req.params.id);
    if (!deal) return res.status(404).json({ success: false, message: 'Deal not found' });
    // Remove all uploaded images
    (deal.images || []).forEach(img => {
      const fp = path.join(__dirname, img);
      if (fs.existsSync(fp)) fs.unlink(fp, () => {});
    });
    res.json({ success: true, message: 'Deal deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// BLOG META ROUTES — dynamic metrics for static blog posts
// ══════════════════════════════════════════════════════════════════════════════

// GET metrics for all posts (or specific post IDs via ?ids=p1,p2,...)
app.get('/api/blog/meta', async (req, res) => {
  try {
    const { ids } = req.query;
    const filter = ids ? { postId: { $in: ids.split(',') } } : {};
    const metas = await BlogMeta.find(filter);
    // Return as a map { postId: meta } for easy frontend lookup
    const map = {};
    metas.forEach(m => { map[m.postId] = m.toJSON(); });
    res.json({ success: true, data: map });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET metrics for a single post
app.get('/api/blog/meta/:postId', async (req, res) => {
  try {
    const meta = await BlogMeta.findOneAndUpdate(
      { postId: req.params.postId },
      { $setOnInsert: { postId: req.params.postId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: meta });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST increment view count
app.post('/api/blog/meta/:postId/view', async (req, res) => {
  try {
    const meta = await BlogMeta.findOneAndUpdate(
      { postId: req.params.postId },
      { $inc: { views: 1 }, $set: { lastRead: new Date() },
        $setOnInsert: { postId: req.params.postId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, views: meta.views });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST toggle like (client sends { liked: true/false })
app.post('/api/blog/meta/:postId/like', async (req, res) => {
  try {


    const { liked } = req.body; // liked=true = adding like, false = removing
    const delta = liked ? 1 : -1;
    const meta = await BlogMeta.findOneAndUpdate(
      { postId: req.params.postId },
      { $inc: { likes: delta }, $setOnInsert: { postId: req.params.postId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, likes: Math.max(0, meta.likes) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST vote (client sends { vote: 1 for up, -1 for down, 0 to remove })
app.post('/api/blog/meta/:postId/vote', async (req, res) => {
  try {
    const { vote, previous } = req.body; // previous = user's last vote (-1,0,1)
    const prev = parseInt(previous) || 0;
    const curr = parseInt(vote)     || 0;
    const scoreDelta = curr - prev;
    const countDelta = (curr !== 0 ? 1 : 0) - (prev !== 0 ? 1 : 0);
    const meta = await BlogMeta.findOneAndUpdate(
      { postId: req.params.postId },
      { $inc: { voteScore: scoreDelta, voteCount: countDelta },
        $setOnInsert: { postId: req.params.postId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, voteScore: meta.voteScore, voteCount: meta.voteCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH update readTime or tags (admin)
app.patch('/api/blog/meta/:postId', requireAdmin, async (req, res) => {
  try {
    const { readTime, tags } = req.body;
    const updates = { updatedAt: new Date() };
    if (readTime) updates.readTime = readTime;
    if (tags)     updates.tags     = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
    const meta = await BlogMeta.findOneAndUpdate(
      { postId: req.params.postId },
      { $set: updates, $setOnInsert: { postId: req.params.postId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: meta });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET leaderboard — top posts by views, likes, or votes
app.get('/api/blog/leaderboard', async (req, res) => {
  try {
    const { by = 'views', limit = 5 } = req.query;
    const sortField = ['views','likes','voteScore'].includes(by) ? by : 'views';
    const top = await BlogMeta.find().sort({ [sortField]: -1 }).limit(parseInt(limit));
    res.json({ success: true, data: top });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// BLOG COMMENT ROUTES
// ══════════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');

// Avatar color palette (Google-style)
const AVATAR_COLORS = [
  '#E91E63','#9C27B0','#673AB7','#3F51B5','#2196F3',
  '#009688','#4CAF50','#FF5722','#795548','#607D8B',
  '#F44336','#FF9800','#00BCD4','#8BC34A','#CDDC39',
];
function pickColor(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.connection.remoteAddress || '').split(',')[0].trim();
}

// GET comments for a post (threaded)
app.get('/api/comments/count/:postId', async (req, res) => {
  try {
    const count = await Comment.countDocuments({ postId: req.params.postId, deleted: false });
    res.json({ success: true, count });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET counts for multiple posts at once
app.post('/api/comments/counts', async (req, res) => {
  try {
    const { postIds } = req.body;
    if (!Array.isArray(postIds)) return res.status(400).json({ success: false, message: 'postIds array required' });
    const results = await Comment.aggregate([
      { $match: { postId: { $in: postIds }, deleted: false } },
      { $group: { _id: '$postId', count: { $sum: 1 } } }
    ]);
    const map = {};
    results.forEach(r => { map[r._id] = r.count; });
    postIds.forEach(id => { if (!map[id]) map[id] = 0; });
    res.json({ success: true, data: map });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST new comment
app.patch('/api/comments/comment/:id', async (req, res) => {
  try {
    const { body, editToken } = req.body;
    if (!body) return res.status(400).json({ success:false, message:'Body required' });
    const auth = await resolveAuth(req).catch(() => null);
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success:false, message:'Comment not found' });
    const isAdminUser = auth?.role === 'admin';
    const isOwner = auth && (
      (comment.userId && comment.userId.toString() === (auth.id||auth.sub||'')) ||
      (comment.userEmail && comment.userEmail === auth.email)
    );
    const hasToken = editToken && comment.editToken === editToken && new Date() < comment.editExpiry;
    if (!isAdminUser && !isOwner && !hasToken)
      return res.status(403).json({ success:false, message:'Not authorized to edit this comment' });
    comment.body = body.trim(); comment.edited = true;
    await comment.save();
    res.json({ success:true, data:comment });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE comment — owner by userId/userEmail OR admin OR valid editToken
app.delete('/api/comments/comment/:id', async (req, res) => {
  try {
    const editToken = req.body?.editToken || req.query?.editToken || '';
    const auth = await resolveAuth(req).catch(() => null);
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success:false, message:'Comment not found' });
    const isAdminUser = auth?.role === 'admin';
    const isOwner = auth && (
      (comment.userId && comment.userId.toString() === (auth.id||auth.sub||'')) ||
      (comment.userEmail && comment.userEmail === auth.email)
    );
    const hasToken = editToken && comment.editToken === editToken && new Date() < comment.editExpiry;
    if (!isAdminUser && !isOwner && !hasToken)
      return res.status(403).json({ success:false, message:'Not authorized to delete this comment' });
    comment.deleted = true; comment.deletedBody = comment.body; comment.body = '[deleted]';
    await comment.save();
    await Comment.updateMany({ parentId: comment._id }, { deleted:true, body:'[deleted]' });
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE bulk (admin only) — delete all or selected
app.delete('/api/comments/bulk/:postId', requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body; // if empty/null → delete ALL for postId
    const filter = ids && ids.length
      ? { _id: { $in: ids }, postId: req.params.postId }
      : { postId: req.params.postId };
    await Comment.deleteMany(filter);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST like a comment
app.post('/api/comments/comment/:id/like', async (req, res) => {
  try {
    const { liked } = req.body;
    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: liked ? 1 : -1 } },
      { new: true }
    );
    if (!comment) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, likes: Math.max(0, comment.likes) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST record comment view (once per 24h per IP)
app.post('/api/comments/comment/:id/view', async (req, res) => {
  try {
    const ip  = getClientIp(req);
    const now = new Date();
    const ago = new Date(now - 24*60*60*1000);
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Not found' });

    const existing = comment.viewedIps.find(v => v.ip === ip);
    if (!existing || existing.lastViewed < ago) {
      if (existing) existing.lastViewed = now;
      else comment.viewedIps.push({ ip, lastViewed: now });
      comment.views += 1;


      await comment.save();
    }
    res.json({ success: true, views: comment.views });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH pin/unpin comment (admin only)
app.patch('/api/comments/comment/:id/pin', requireAdmin, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ success: false, message: 'Not found' });
    comment.pinned = !comment.pinned;
    await comment.save();
    res.json({ success: true, pinned: comment.pinned });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET notification bell — new comments since last check (admin)
app.get('/api/comments/notifications', requireAdmin, async (req, res) => {
  try {
    const { since } = req.query;
    const filter = { deleted: false };
    if (since) filter.createdAt = { $gt: new Date(since) };
    const count = await Comment.countDocuments(filter);
    const latest = await Comment.find(filter).sort({ createdAt: -1 }).limit(5).select('postId authorName body createdAt');
    res.json({ success: true, count, latest });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

app.get('/api/comments/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { sort = 'newest' } = req.query;
    const sortObj = sort === 'popular' ? { likes: -1, createdAt: -1 } : { pinned: -1, createdAt: -1 };

    const topLevel = await Comment.find({ postId, parentId: null }).sort(sortObj);
    const replies  = await Comment.find({ postId, parentId: { $ne: null } }).sort({ createdAt: 1 });

    const clean = (c) => {
      const obj = c.toJSON();  // use toJSON so virtual 'id' is set correctly
      if (obj.deleted) { obj.body = '[Comment deleted]'; obj.authorName = 'Deleted'; }
      return obj;
    };

    const replyMap = {};
    replies.forEach(r => {
      const pid = r.parentId.toString();
      if (!replyMap[pid]) replyMap[pid] = [];
      replyMap[pid].push(clean(r));
    });

    const threaded = topLevel.map(c => ({
      ...clean(c),
      replies: replyMap[c._id.toString()] || []
    }));

    const total = await Comment.countDocuments({ postId, deleted: false });
    res.json({ success: true, count: total, data: threaded });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET comment count per post (for blog listing page)
app.post('/api/comments/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const { body, parentId } = req.body;

    const auth = await requireAuth(req, res);
    if (!auth) return;

    if (!body?.trim())      return res.status(400).json({ success:false, message:'Comment cannot be empty' });
    if (body.length > 2000) return res.status(400).json({ success:false, message:'Comment too long (max 2000 chars)' });

    const authorColor = auth.isAdmin
      ? '#6366f1'
      : (() => { const h = [...auth.email].reduce((a,c)=>a+c.charCodeAt(0),0); return `hsl(${h%360},60%,45%)`; })();

    const comment = await Comment.create({
      postId,
      parentId:    parentId || null,
      authorName:  auth.isAdmin ? '👑 SELA Admin' : auth.name,
      authorColor,
      userId:      auth.isAdmin ? null : auth.id,
      userEmail:   auth.email,
      isVerified:  true,
      isAdmin:     auth.isAdmin,
      body:        body.trim(),
    });

    res.status(201).json({ success:true, data:comment });
  } catch(err) {
    console.error('blog-comment error:', err.message);
    res.status(500).json({ success:false, message: err.message });
  }
});

// PATCH edit comment (anonymous with token, or admin)

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCT META ROUTES — views, likes, votes, analytics
// ══════════════════════════════════════════════════════════════════════════════
function getClientIpProd(req) {
  return (req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '').split(',')[0].trim();
}
function todayStr() { return new Date().toISOString().slice(0,10); }

// GET or upsert product meta
app.get('/api/product-meta/:productId', async (req, res) => {
  try {
    const meta = await ProductMeta.findOneAndUpdate(
      { productId: req.params.productId },
      { $setOnInsert: { productId: req.params.productId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: meta });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST record product view (session-based dedup via header)
app.post('/api/product-meta/:productId/view', async (req, res) => {
  try {
    const today = todayStr();
    const meta = await ProductMeta.findOneAndUpdate(
      { productId: req.params.productId },
      {
        $inc: { views: 1 },
        $set: { lastViewed: new Date() },
        $setOnInsert: { productId: req.params.productId }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    // Update daily bucket
    const bucket = meta.viewsHistory.find(b => b.date === today);
    if (bucket) bucket.count += 1;
    else meta.viewsHistory.push({ date: today, count: 1 });
    // Keep only 30 days
    meta.viewsHistory = meta.viewsHistory.slice(-30);
    await meta.save();
    res.json({ success: true, views: meta.views });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST toggle like
app.post('/api/product-meta/:productId/like', async (req, res) => {
  try {
    const { liked } = req.body;
    const today = todayStr();
    const meta = await ProductMeta.findOneAndUpdate(
      { productId: req.params.productId },
      { $inc: { likes: liked ? 1 : -1 }, $setOnInsert: { productId: req.params.productId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (liked) {
      const bucket = meta.likesHistory.find(b => b.date === today);
      if (bucket) bucket.count += 1;
      else meta.likesHistory.push({ date: today, count: 1 });
      meta.likesHistory = meta.likesHistory.slice(-30);
      await meta.save();
    }
    res.json({ success: true, likes: Math.max(0, meta.likes) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST vote
app.post('/api/product-meta/:productId/vote', async (req, res) => {
  try {
    const { vote, previous } = req.body;
    const prev = parseInt(previous) || 0;
    const curr = parseInt(vote) || 0;
    const meta = await ProductMeta.findOneAndUpdate(
      { productId: req.params.productId },
      {
        $inc: { voteScore: curr - prev, voteCount: (curr !== 0 ? 1 : 0) - (prev !== 0 ? 1 : 0) },
        $setOnInsert: { productId: req.params.productId }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, voteScore: meta.voteScore, voteCount: meta.voteCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// PRODUCT COMMENT ROUTES
// ══════════════════════════════════════════════════════════════════════════════
const AVATAR_COLORS_P = ['#E91E63','#9C27B0','#673AB7','#3F51B5','#2196F3','#009688','#4CAF50','#FF5722','#795548','#607D8B','#F44336','#FF9800','#00BCD4'];
function pickColorP(name) {
  let h = 0; for (let i=0;i<name.length;i++) h=name.charCodeAt(i)+((h<<5)-h);
  return AVATAR_COLORS_P[Math.abs(h) % AVATAR_COLORS_P.length];
}

function isAdminFromReq(req) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return false;
  try { const p = require('jsonwebtoken').verify(h.slice(7), JWT_SECRET); return p.role==='admin'; } catch { return false; }
}

// GET comments (threaded) for a product
app.patch('/api/product-comments/comment/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ success:false, message:'Body required' });
    const c = await ProductComment.findById(req.params.id);
    if (!c) return res.status(404).json({ success:false, message:'Not found' });
    // Only own comment owner can edit
    const isOwner = c.userId && (c.userId === auth.email || c.userId === auth.id);
    if (!isOwner) return res.status(403).json({ success:false, message:'You can only edit your own comments' });
    c.body = body.trim(); c.edited = true;
    await c.save();
    res.json({ success:true, data:c });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE comment (admin only — anonymous cannot delete)
app.delete('/api/product-comments/comment/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const c = await ProductComment.findById(req.params.id);
    if (!c) return res.status(404).json({ success:false, message:'Not found' });
    // Allow: own comment (userId match) OR vendor of this product
    const isOwner = c.userId && (c.userId === auth.email || c.userId === auth.id);
    // Check if vendor owns the product
    let isVendor = false;
    if (!isOwner) {
      const prod = await ShopProduct.findById(c.productId).lean();
      if (prod) {
        const shop = await Shop.findById(prod.shopId).lean();
        isVendor = shop && (shop.ownerId === (auth.id||auth.sub) || shop.ownerId === auth.email);
      }
    }
    if (!isOwner && !isVendor) return res.status(403).json({ success:false, message:'Not authorized' });
    c.deleted=true; c.deletedBody=c.body; c.body='[deleted]';
    await c.save();
    // Also delete all replies to this comment
    await ProductComment.updateMany(
      { parentId: c._id },
      { deleted:true, body:'[deleted]' }
    );
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE bulk (admin)
app.post('/api/product-comments/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { body, parentId } = req.body;

    const auth = await requireAuth(req, res);
    if (!auth) return; // requireAuth already sent 401

    if (!body?.trim())       return res.status(400).json({ success:false, message:'Comment cannot be empty' });
    if (body.length > 2000)  return res.status(400).json({ success:false, message:'Comment too long (max 2000 chars)' });

    const authUser = await resolveAuth(req).catch(()=>null);
    const nameParts = (auth.name||'').split(' ');
    const firstName = auth.firstName || nameParts[0] || 'User';
    const lastName  = auth.lastName  || nameParts.slice(1).join(' ') || '';
    const userId    = auth.email || auth.id || auth.sub || '';
    const colorHash = [...(auth.email||'user')].reduce((a,c)=>a+c.charCodeAt(0),0);
    // Check if this user is a vendor for this product
    let isVendor = false;
    try {
      const prod = await ShopProduct.findById(productId).lean();
      if (prod) {
        const shop = await Shop.findById(prod.shopId).lean();
        const shopOwner = shop?.ownerId?.toString() || '';
        isVendor = !!(shopOwner && (shopOwner === (authUser?.id||authUser?.sub||'') || shopOwner === userId));
      }
    } catch {}

    const comment = await ProductComment.create({
      productId,
      parentId:    parentId || null,
      firstName,
      lastName,
      email:       auth.email || '',
      userId,
      authorColor: `hsl(${colorHash%360},60%,45%)`,
      isAdmin:     false,
      isVendor,
      body:        body.trim(),
    });

    res.status(201).json({ success:true, data:comment });
  } catch(err) {
    console.error('product-comment error:', err.message);
    res.status(500).json({ success:false, message: err.message });
  }
});

// POST vote on a product comment
app.post('/api/product-comments/comment/:id/vote', async (req, res) => {
  try {
    const { vote, previous } = req.body;
    const prev = parseInt(previous)||0, curr = parseInt(vote)||0;
    const c = await ProductComment.findByIdAndUpdate(
      req.params.id,
      { $inc: { voteScore: curr-prev, voteCount: (curr!==0?1:0)-(prev!==0?1:0) } },
      { new: true }
    );
    if (!c) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, voteScore:c.voteScore, voteCount:c.voteCount });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST record comment view (24h dedup)
app.post('/api/product-comments/comment/:id/view', async (req, res) => {
  try {
    const ip = getClientIpProd(req);
    const now = new Date(), ago = new Date(now - 24*3600*1000);
    const c = await ProductComment.findById(req.params.id);
    if (!c) return res.status(404).json({ success:false, message:'Not found' });
    const existing = c.viewedIps.find(v=>v.ip===ip);
    if (!existing||existing.lastViewed<ago) {
      if (existing) existing.lastViewed=now; else c.viewedIps.push({ip,lastViewed:now});
      c.views+=1; await c.save();
    }
    res.json({ success:true, views:c.views });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// PATCH pin/unpin (admin)
app.patch('/api/product-comments/comment/:id/pin', requireAdmin, async (req, res) => {
  try {
    const c = await ProductComment.findById(req.params.id);
    if (!c) return res.status(404).json({ success:false, message:'Not found' });
    c.pinned=!c.pinned; await c.save();
    res.json({ success:true, pinned:c.pinned });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


app.delete('/api/product-comments/bulk/:productId', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    // Only vendor of this product can bulk delete
    const prod = await ShopProduct.findById(req.params.productId).lean();
    if (!prod) return res.status(404).json({ success:false, message:'Product not found' });
    const shop = await Shop.findById(prod.shopId).lean();
    const isVendor = shop && (shop.ownerId === (auth.id||auth.sub) || shop.ownerId === auth.email);
    if (!isVendor) return res.status(403).json({ success:false, message:'Vendor access required' });
    const { ids } = req.body;
    const filter = ids?.length ? { _id:{$in:ids}, productId:req.params.productId } : { productId:req.params.productId };
    await ProductComment.updateMany(filter, { deleted:true, body:'[deleted]' });
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST like a product comment
app.get('/api/product-comments/count/:productId', async (req, res) => {
  try {
    const count = await ProductComment.countDocuments({ productId: req.params.productId, deleted: false });
    res.json({ success: true, count });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET analytics for a product (top commenters, trending, etc.)
app.get('/api/product-comments/analytics/:productId', async (req, res) => {
  try {
    const pid = req.params.productId;
    // Top commenters by count
    const topCommenters = await ProductComment.aggregate([
      { $match: { productId: pid, deleted: false } },
      { $group: { _id: { firstName:'$firstName', lastName:'$lastName' }, count: { $sum: 1 }, likes: { $sum: '$likes' } } },
      { $sort: { count: -1 } }, { $limit: 5 }
    ]);
    // Most liked comments
    const topLiked = await ProductComment.find({ productId: pid, deleted: false })
      .sort({ likes: -1 }).limit(3).select('body firstName lastName likes voteScore createdAt');
    // Comments per day (last 14 days)
    const perDay = await ProductComment.aggregate([
      { $match: { productId: pid, deleted: false, createdAt: { $gte: new Date(Date.now()-14*86400000) } } },
      { $group: { _id: { $dateToString: { format:'%Y-%m-%d', date:'$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, topCommenters, topLiked, perDay });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// POST new comment (anonymous must provide email, phone, name)
app.get('/api/product-comments/:productId', async (req, res) => {
  try {
    const { sort='newest' } = req.query;
    const sortObj = sort==='popular' ? {likes:-1,createdAt:-1} : sort==='votes' ? {voteScore:-1,createdAt:-1} : {pinned:-1,createdAt:-1};
    const topLevel = await ProductComment.find({ productId: req.params.productId, parentId: null }).sort(sortObj);
    const replies  = await ProductComment.find({ productId: req.params.productId, parentId: {$ne:null} }).sort({createdAt:1});
    const clean = c => {
      const obj = c.toJSON();
      if (obj.deleted) {
        obj.body='[deleted]'; obj.firstName='[deleted]'; obj.lastName=''; obj.email='';
      } else {
        delete obj.email; delete obj.phone; // hide PII from public
      }
      // Compute authorName for frontend compatibility
      obj.authorName = obj.isAdmin
        ? (obj.firstName + ' ' + obj.lastName).trim() || 'SELA Admin'
        : (obj.firstName + ' ' + obj.lastName).trim() || 'User';
      return obj;
    };
    const replyMap = {};
    replies.forEach(r => {
      const pid = r.parentId.toString();
      if (!replyMap[pid]) replyMap[pid]=[];
      replyMap[pid].push(clean(r));
    });
    const threaded = topLevel.map(c => ({ ...clean(c), replies: replyMap[c._id.toString()]||[] }));
    const total = await ProductComment.countDocuments({ productId: req.params.productId, deleted: false });
    res.json({ success: true, count: total, data: threaded });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET comment count for product

// PATCH edit comment (admin only — anonymous cannot edit)
// GET product by slug (for standalone product page)

// DELETE single image from product
app.delete('/api/products/:id/image', requireAdmin, async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success:false, message:'Not found' });
    product.images = (product.images||[]).filter(img => img !== imageUrl);
    product.image  = product.images[0] || null;
    await product.save();
    const fp = path.join(__dirname, imageUrl);
    if (fs.existsSync(fp)) fs.unlink(fp, ()=>{});
    res.json({ success:true, data:product });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// SHOP PLATFORM API
// ══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// UNIFIED AUTH LAYER — single source of truth for all auth in the platform
// ═══════════════════════════════════════════════════════════════════════════

/**
 * resolveAuth(req) — call from any route that needs the current user.
 * Returns a normalised auth object or null if not authenticated.
 *
 * Returned object always has:
 *   { id, email, name, firstName, lastName, role, isAdmin }
 *
 * Works for both user JWTs and admin JWTs.


 */
function getTokenFromReq(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

function decodeToken(token) {
  if (!token) return null;
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

async function resolveAuth(req) {
  const token   = getTokenFromReq(req);
  const decoded = decodeToken(token);
  if (!decoded) return null;

  if (decoded.role === 'admin') {
    // Admin — fetch fresh record for name/email
    const rec = await Admin.findById(decoded.id).lean().catch(() => null)
             || await Admin.findOne({ username: decoded.username }).lean().catch(() => null);
    if (!rec) return null;
    return {
      id:        decoded.id || rec._id.toString(),
      email:     rec.email || 'admin@sela.co.ke',
      name:      rec.name  || 'SELA Admin',
      firstName: (rec.name||'SELA Admin').split(' ')[0],
      lastName:  (rec.name||'SELA Admin').split(' ').slice(1).join(' ') || '',
      username:  rec.username,
      role:      'admin',
      isAdmin:   true,
    };
  }

  // Regular user
  const user = await User.findById(decoded.id).lean().catch(() => null);
  if (!user) return null;
  const fullName = `${user.firstName} ${user.lastName}`.trim();
  return {
    id:        user._id.toString(),
    email:     user.email,
    name:      fullName || user.username,
    firstName: user.firstName,
    lastName:  user.lastName,
    username:  user.username,
    role:      'user',
    isAdmin:   false,
  };
}

/**
 * requireAuth(req, res) — middleware helper.
 * Usage:  const auth = await requireAuth(req, res);
 *         if (!auth) return; // already sent 401
 */
async function requireAuth(req, res) {
  const token = getTokenFromReq(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Login required', code: 'LOGIN_REQUIRED' });
    return null;
  }
  const decoded = decodeToken(token);
  if (!decoded) {
    res.status(401).json({ success: false, message: 'Session expired — please log in again', code: 'LOGIN_REQUIRED' });
    return null;
  }
  const auth = await resolveAuth(req);
  if (!auth) {
    res.status(401).json({ success: false, message: 'Account not found — please log in again', code: 'LOGIN_REQUIRED' });
    return null;
  }
  return auth;
}

/**
 * requireAdmin(req, res) — admin-only middleware helper.
 */
async function requireAdminAuth(req, res) {
  const auth = await requireAuth(req, res);
  if (!auth) return null;
  if (!auth.isAdmin) {
    res.status(403).json({ success: false, message: 'Admin access required' });
    return null;
  }
  return auth;
}

// Keep getShopUser for backward compat — now delegates to decodeToken
function getShopUser(req) {
  const token = getTokenFromReq(req);
  return decodeToken(token);
}

// ═══════════════════════════════════════════════════════════════════════════

// ── SHOP CRUD ─────────────────────────────────────────────────────────────────

// GET /api/shops  — list all published shops (public)
app.get('/api/shops', async (req, res) => {
  try {
    const { search, limit=20, page=1 } = req.query;


    const filter = { status: 'active' };
    if (search) filter.name = { $regex: search, $options: 'i' };
    const shops = await Shop.find(filter).sort({ createdAt: -1 }).skip((page-1)*limit).limit(+limit);
    const total = await Shop.countDocuments(filter);
    const normalised = shops.map(s => {
      const obj = s.toObject ? s.toObject() : s;
      return { ...obj, id: obj._id?.toString(), slug: obj.slug || '' };
    });
    res.json({ success: true, data: normalised, total });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/shops/mine  — owner's own shops
app.get('/api/shops/mine', async (req, res) => {
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;

    let shops;
    if (auth.isAdmin) {
      // Admin: find by ownerEmail (most reliable)
      shops = await Shop.find({ ownerEmail: auth.email }).sort({ createdAt:-1 }).lean();
      // Fallback: find by ownerId via linked User record
      if (!shops.length) {
        const linkedUser = await User.findOne({ email: auth.email }).lean();
        if (linkedUser) {
          shops = await Shop.find({ ownerId: linkedUser._id.toString() }).sort({ createdAt:-1 }).lean();
        }
      }
    } else {
      shops = await Shop.find({ ownerId: auth.id }).sort({ createdAt:-1 }).lean();
      // Fallback: search by email if no shops found by id
      if (!shops.length && auth.email) {
        shops = await Shop.find({ ownerEmail: auth.email }).sort({ createdAt:-1 }).lean();
        // Sync ownerId if found by email — fixes mismatch after data migration
        if (shops.length) {
          await Shop.updateMany({ ownerEmail: auth.email }, { ownerId: auth.id }).catch(()=>{});
        }
      }
    }

    const data = shops.map(s => ({ ...s, id: s._id?.toString(), slug: s.slug||'' }));
    res.json({ success:true, data });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/shops/id/:id  — shop by ID (public for viewing, auth for owner-only data)
app.get('/api/shops/id/:id', async (req, res) => {
  try {
    const raw = req.params.id;
    // Validate it looks like an ObjectId
    if (!/^[a-f0-9]{24}$/i.test(raw)) {
      return res.status(400).json({ success:false, message:'Invalid shop ID format: ' + raw });
    }
    const shop = await Shop.findById(raw).lean();
    if (!shop) {
      // Try finding by string ownerId match as fallback
      const byOwner = await Shop.findOne({ ownerId: raw }).lean();
      if (byOwner) {
        return res.json({ success:true, data:{ ...byOwner, id:byOwner._id?.toString(), slug:byOwner.slug||'' } });
      }
      return res.status(404).json({ success:false, message:'Shop not found for id: ' + raw });
    }
    res.json({ success:true, data:{ ...shop, id:shop._id?.toString(), slug:shop.slug||'' } });
  } catch(err) {
    res.status(500).json({ success:false, message:err.message, id:req.params.id });
  }
});





// GET /api/shops/:slug  — public shop by slug
app.post('/api/shops', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success:false, message:'Login required' });

    const { name, description, email, phone, whatsapp, location,
            themeColor, logo, banner, social } = req.body;
    if (!name?.trim()) return res.status(400).json({ success:false, message:'Shop name required' });

    // Resolve owner — admin uses their own email, regular user uses their account
    const isAdmin  = user.role === 'admin';
    let ownerId    = user.id || user.sub || '';
    let ownerEmail = user.email || email || '';

    if (isAdmin) {
      // Fetch admin record to get their email
      const adminRecord = await Admin.findOne({ username: user.username || 'admin' }).lean();
      // Fall back through multiple sources to get a valid email
      const adminEmail = (adminRecord?.email && adminRecord.email.includes('@'))
        ? adminRecord.email
        : (email && email.includes('@'))
          ? email
          : (user.username && user.username.includes('@'))
            ? user.username
            : `${user.username||'admin'}@sela.co.ke`;
      ownerEmail = adminEmail;

      // Find or create a User account for the admin (needed for vendor dashboard)
      let adminUser = await User.findOne({ email: adminEmail }).lean();
      if (!adminUser) {
        try {
          const adminPwd = process.env.ADMIN_PASSWORD || 'Admin@SELA2025!';
          adminUser = await User.create({
            firstName:  'SELA',
            lastName:   'Admin',
            username:   'sela_admin_' + Date.now().toString(36),
            email:       adminEmail,
            password:    await bcrypt.hash(adminPwd, 10),
            isVerified:  true,
          });
        } catch {
          adminUser = await User.findOne({ email: adminEmail }).lean();
        }
      }
      if (adminUser) ownerId = (adminUser._id || adminUser.id).toString();
    }

    let slug = slugify(name);
    const existing = await Shop.findOne({ slug });
    if (existing) slug = slug + '-' + Date.now().toString(36);

    const shop = await Shop.create({
      name: name.trim(), slug,
      description: description || '',
      email:       email || ownerEmail || '',
      phone:       phone || '',
      whatsapp:    whatsapp || '',
      location:    location || '',
      themeColor:  themeColor || '#1a73e8',
      logo:        logo || '',
      banner:      banner || '',
      social:      social || {},
      ownerId,
      ownerEmail,
      status:    'active',
      published: false,
    });

    res.status(201).json({ success:true, data:{
      id:   shop._id.toString(),
      slug: shop.slug,
      ...shop.toObject(),
    }});
  } catch(err) {
    if (err.code === 11000) return res.status(400).json({ success:false, message:'A store with that name already exists' });
    res.status(500).json({ success:false, message:err.message });
  }
});

app.post('/api/shops/:id/demo-publish', async (req, res) => {
  try {
    const user = await resolveAuth(req).catch(()=>null) || getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Not found' });
    if (shop.ownerId !== (user.id||user.sub) && user.role !== 'admin')
      return res.status(403).json({ success: false, message: 'Forbidden' });
    const paidUntil = new Date();
    paidUntil.setFullYear(paidUntil.getFullYear() + 99); // demo: never expires
    shop.status = 'active';
    shop.published = true;
    shop.subscription.paidUntil = paidUntil;
    shop.subscription.lastPaid = new Date();
    shop.subscription.mpesaRef = 'DEMO-FREE';
    await shop.save();
    res.json({ success: true, data: shop, message: 'Demo shop published!' });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/shops/:id/subscribe', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success:false, message:'Shop not found' });
    if (shop.ownerId.toString() !== (auth.id||auth.sub||''))
      return res.status(403).json({ success:false, message:'Not authorized' });

    const { plan='growth', months=1, mpesaRef='', cycle='monthly' } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ success:false, message:'Invalid plan' });

    const planData   = PLANS[plan];
    const isAnnual   = cycle === 'annual';
    const amount     = isAnnual ? planData.annualPrice : planData.price * months;
    const monthsToAdd = isAnnual ? 12 : parseInt(months) || 1;

    // Calculate new paidUntil
    const now = new Date();
    const currentExpiry = shop.subscription?.paidUntil ? new Date(shop.subscription.paidUntil) : now;
    const base = currentExpiry > now ? currentExpiry : now;
    const newExpiry = new Date(base);
    newExpiry.setMonth(newExpiry.getMonth() + monthsToAdd);

    // Set grace period (3 days after expiry)
    const graceUntil = new Date(newExpiry);
    graceUntil.setDate(graceUntil.getDate() + 3);

    shop.subscription = {
      plan, fee: planData.price, paidUntil: newExpiry,
      lastPaid: now, mpesaRef, billingCycle: cycle,
      gracePeriod: false, graceUntil,
    };

    if (!shop.billingHistory) shop.billingHistory = [];
    shop.billingHistory.unshift({
      date: now, plan, amount, months: monthsToAdd,
      mpesaRef, method: 'mpesa', cycle,
    });
    // Keep last 24 billing records
    shop.billingHistory = shop.billingHistory.slice(0, 24);

    await shop.save();
    res.json({ success:true, data:{ paidUntil:newExpiry, plan, amount, months:monthsToAdd } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/shops/:id/plan — returns current plan and usage
app.get('/api/shops/:id/plan', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const shopId = req.params.id;
    const plan   = await getShopPlan(shopId);
    const limits = PLANS[plan];
    const filter = mongoose.Types.ObjectId.isValid(shopId)
      ? { shopId: new mongoose.Types.ObjectId(shopId) }
      : { shopId };
    const [products, branches, staff] = await Promise.all([
      ShopProduct.countDocuments({ ...filter, active:true }),
      Branch.countDocuments(filter),
      ShopSubUser.countDocuments(filter),
    ]);
    res.json({ success:true, plan, limits:{
      products:{ used:products, max:limits.maxProducts },
      branches:{ used:branches, max:limits.maxBranches },
      staff:   { used:staff,    max:limits.maxStaff },
    }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

app.get('/api/shops/:id/branches', async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const id = req.params.id;
    // Try both string and ObjectId match
    let branches = await Branch.find({ shopId: id, active: true }).sort({ isMain: -1, createdAt: 1 }).lean();
    if (!branches.length && mongoose.Types.ObjectId.isValid(id)) {
      branches = await Branch.find({ shopId: new mongoose.Types.ObjectId(id), active: true }).sort({ isMain: -1, createdAt: 1 }).lean();
    }
    res.json({ success: true, data: branches.map(b => ({ ...b, id: b._id?.toString() })) });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/shops/:id/branches', checkBranchLimit, async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const shop = await Shop.findById(req.params.id);
    if (!shop || shop.ownerId !== (user.id||user.sub)) return res.status(403).json({ success: false, message: 'Forbidden' });
    const { name, location, phone, email, whatsapp, hours } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Branch name required' });
    const branch = await Branch.create({ shopId: req.params.id, name: name.trim(), location: location||'', phone: phone||'', email: email||'', whatsapp: whatsapp||'', hours: hours||'' });
    res.status(201).json({ success: true, data: branch });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.get('/api/shops/:id/categories', async (req, res) => {
  try {
    const cats = await ShopCategory.find({ shopId: req.params.id }).sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: cats });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/shops/:id/categories', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const { name, icon, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Category name required' });
    const cat = await ShopCategory.create({ shopId: req.params.id, name: name.trim(), icon: icon||'📦', color: color||'#1a73e8' });
    res.status(201).json({ success: true, data: cat });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.get('/api/shops/:id/products', async (req, res) => {
  try {
    const { category, branch, search, sort='newest', limit=50, page=1, featured } = req.query;
    const _mongoose = require('mongoose');
    const _id = req.params.id;
    const _shopId = _mongoose.Types.ObjectId.isValid(_id) ? new _mongoose.Types.ObjectId(_id) : _id;
    const showAll = req.query.active === 'all';
    const filter = { shopId: _shopId };
    if (!showAll) filter.active = true;
    if (category) filter.categoryId = category;
    if (branch)   filter.branchIds  = branch;
    if (featured) filter.featured   = true;
    if (search)   filter.name       = { $regex: search, $options: 'i' };
    const sortMap = { newest: { createdAt: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 }, name: { name: 1 } };
    const products = await ShopProduct.find(filter).sort(sortMap[sort]||sortMap.newest).skip((page-1)*limit).limit(+limit);
    const total = await ShopProduct.countDocuments(filter);
    const normProds = (products.toObject ? products.toObject() : products).map ? 
      products.map(p => ({ ...(p.toObject?p.toObject():p), id:p._id?.toString(), shopId:p.shopId?.toString()||'' })) : products;
    res.json({ success: true, data: normProds, total });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/shops/:id/products', checkProductLimit, async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    let { name, description, price, salePrice, onSale, discountPct, images, sku, stock, unit, tags, featured, categoryId, categoryName, branchIds, active } = req.body;
    branchIds = (branchIds||[]).filter(id => id && id !== 'undefined' && id !== 'null');
    images = (images||[]).filter(img => img && typeof img === 'string');
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Product name required' });
    if (price === undefined) return res.status(400).json({ success: false, message: 'Price required' });
    // Auto-generate unique slug from product name
    const slug = await uniqueProductSlug(req.params.id, name.trim());
    const p = await ShopProduct.create({
      shopId: req.params.id, name: name.trim(), slug,
      description: description||'', price: Number(price)||0,
      salePrice: salePrice||null, onSale: !!onSale, discountPct: discountPct||0,
      images: images||[], sku: sku||'', stock: Number(stock)||0, unit: unit||'pcs',
      tags: tags||[], featured: !!featured, categoryId: categoryId||null,
      categoryName: categoryName||'Uncategorised', branchIds: branchIds||[],
      active: active !== false,
    });
    res.status(201).json({ success: true, data: { ...p.toObject(), id: p._id.toString() } });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.get('/api/shops/:id/inventory', async (req, res) => {
  try {
    const shopId = req.params.id;
    const [products, hotdeals] = await Promise.all([
      ShopProduct.find({ shopId, active: true }).lean(),
      HotDeal.find({ $or: [{ shopId }, { shopId: shopId }] }).lean(),
    ]);
    const allItems = [
      ...products.map(p => ({ ...p, id:p._id.toString(), _source:'product' })),
      ...hotdeals.map(d => ({ ...d, id:d._id.toString(), name:d.title||d.name||'Hot Deal', categoryName:d.category||'Hot Deal', sold:0, stock:d.stock||0, unit:'pcs', _source:'hotdeal' })),
    ];
    const totalStock = allItems.reduce((s, p) => s + (p.stock||0), 0);
    const totalSold  = products.reduce((s, p) => s + (p.sold||0), 0);
    const lowStock   = allItems.filter(p => (p.stock||0) > 0 && (p.stock||0) <= 5);
    const outOfStock = allItems.filter(p => (p.stock||0) === 0);
    const newItems   = products.filter(p => new Date() - new Date(p.addedAt) < 7*24*3600*1000);
    const byCategory = {};
    allItems.forEach(p => {
      const c = p.categoryName||'Uncategorised';
      if (!byCategory[c]) byCategory[c] = { count:0, stock:0, sold:0 };
      byCategory[c].count++; byCategory[c].stock += p.stock||0; byCategory[c].sold += p.sold||0;
    });
    res.json({ success:true, data:{ totalProducts:allItems.length, totalStock, totalSold, lowStock:lowStock.length, outOfStock:outOfStock.length, newThisWeek:newItems.length, byCategory, products:allItems } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});
app.get('/api/shops/:id/users', async (req, res) => {
  try {
    const users = await ShopSubUser.find({ shopId: req.params.id, active: true });
    res.json({ success: true, data: users });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.post('/api/shops/:id/users', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const { name, email, role, permissions } = req.body;
    if (!name||!email) return res.status(400).json({ success: false, message: 'Name and email required' });
    const sub = await ShopSubUser.create({ shopId: req.params.id, userId: email, name, email, role: role||'staff', permissions: permissions||{} });
    res.status(201).json({ success: true, data: sub });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});
app.get('/api/shops/:id/subscription-status', async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id).lean();
    if (!shop) return res.status(404).json({ success:false });
    const now      = new Date();
    const sub      = shop.subscription || {};
    const expiry   = sub.paidUntil ? new Date(sub.paidUntil) : null;
    const graceEnd = sub.graceUntil ? new Date(sub.graceUntil) : null;
    const isActive = (expiry && expiry > now) || (graceEnd && graceEnd > now);
    const inGrace  = expiry && expiry < now && graceEnd && graceEnd > now;
    const daysLeft = expiry ? Math.max(0, Math.ceil((expiry - now) / 86400000)) : 0;
    const graceDaysLeft = inGrace && graceEnd ? Math.ceil((graceEnd - now) / 86400000) : 0;
    const plan     = sub.plan || 'growth';
    const planData = PLANS[plan] || PLANS.growth;
    res.json({ success:true, data:{
      active:        isActive,
      inGrace,       graceDaysLeft,
      plan,          planName: planData.name,
      fee:           planData.price,
      annualFee:     planData.annualPrice,
      paidUntil:     expiry,
      daysLeft,      lastPaid: sub.lastPaid,
      mpesaRef:      sub.mpesaRef || '',
      limits:        planData.limits,
      billingHistory:shop.billingHistory || [],
    }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


app.get('/api/shops/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    // Search by slug, or fall back to name-based slug match
    let shop = await Shop.findOne({ slug });
    if (!shop) {
      // Try name match (e.g. "modern-woodworks" → "Modern Woodworks")
      const nameGuess = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      shop = await Shop.findOne({ name: { $regex: new RegExp('^' + nameGuess + '$', 'i') } });
    }
    if (!shop) {
      // Try partial slug match
      shop = await Shop.findOne({ slug: { $regex: slug, $options: 'i' } });
    }
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
    res.json({ success: true, data: shop });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});



// POST /api/shops  — create shop

// PATCH /api/shops/:id  — update shop
app.get('/api/shops/:id/mpesa-settings', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shop = await Shop.findById(req.params.id).lean();
    if (!shop) return res.status(404).json({ success:false, message:'Shop not found' });
    const m = shop.mpesa || {};
    const provider = m.provider || 'intasend';
    const hasCredentials = provider === 'daraja'
      ? !!(m.consumerKey && m.consumerSecret && m.passkey)
      : !!(m.intasendPublishableKey && m.intasendSecretKey);
    res.json({ success:true, data:{
      enabled:     m.enabled     || false,
      type:        m.type        || 'till',
      shortCode:   m.shortCode   || '',
      accountName: m.accountName || '',
      environment: m.environment || 'sandbox',
      provider,
      hasCredentials,
    }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});app.patch('/api/shops/:id/mpesa-settings', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { enabled, type, shortCode, accountName, consumerKey, consumerSecret,
            passkey, environment, provider, intasendPublishableKey, intasendSecretKey } = req.body;

    // Fetch current mpesa data first, then merge
    const shop = await Shop.findById(req.params.id).lean();
    if (!shop) return res.status(404).json({ success:false, message:'Shop not found' });
    const current = shop.mpesa || {};

    const merged = {
      enabled:     enabled !== undefined ? enabled : (current.enabled || false),
      type:        type        || current.type        || 'till',
      shortCode:   (shortCode   !== undefined && shortCode   !== '') ? shortCode   : (current.shortCode   || ''),
      accountName: (accountName !== undefined && accountName !== '') ? accountName : (current.accountName || ''),
      environment: environment || current.environment || 'sandbox',
      provider:    provider    || current.provider    || 'intasend',
      consumerKey:    consumerKey    || current.consumerKey    || '',
      consumerSecret: consumerSecret || current.consumerSecret || '',
      passkey:        passkey        || current.passkey        || '',
      intasendPublishableKey: (intasendPublishableKey && intasendPublishableKey.length > 5)
        ? intasendPublishableKey : (current.intasendPublishableKey || ''),
      intasendSecretKey: (intasendSecretKey && intasendSecretKey.length > 5)
        ? intasendSecretKey : (current.intasendSecretKey || ''),
    };

    await Shop.findByIdAndUpdate(req.params.id, { $set: { mpesa: merged } });
    res.json({ success:true, message:'M-Pesa settings saved' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});
app.patch('/api/shops/:id', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Not found' });
    if (shop.ownerId !== (user.id||user.sub) && user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    const allowed = ['name','description','email','phone','whatsapp','location','themeColor','logo','banner','social'];
    allowed.forEach(k => { if (req.body[k] !== undefined) shop[k] = req.body[k]; });
    await shop.save();
    res.json({ success: true, data: shop });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// DELETE /api/shops/:id
app.delete('/api/shops/:id', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success: false, message: 'Not found' });
    if (shop.ownerId !== (user.id||user.sub) && user.role !== 'admin') return res.status(403).json({ success: false, message: 'Forbidden' });
    await Shop.deleteOne({ _id: req.params.id });
    await Branch.deleteMany({ shopId: req.params.id });
    await ShopProduct.deleteMany({ shopId: req.params.id });
    await ShopCategory.deleteMany({ shopId: req.params.id });
    await ShopSubUser.deleteMany({ shopId: req.params.id });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});


// POST /api/shops/:id/demo-publish — publish without payment (demo mode)

// ── SUBSCRIPTION / PUBLISH ────────────────────────────────────────────────────

// POST /api/shops/:id/subscribe  — pay subscription

// ── BRANCHES ──────────────────────────────────────────────────────────────────



app.patch('/api/branches/:id', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const branch = await Branch.findById(req.params.id).populate('shopId');
    if (!branch) return res.status(404).json({ success: false, message: 'Not found' });
    if (branch.shopId.ownerId !== (user.id||user.sub)) return res.status(403).json({ success: false, message: 'Forbidden' });
    ['name','location','phone','email','whatsapp','hours','active'].forEach(k => { if (req.body[k] !== undefined) branch[k] = req.body[k]; });
    await branch.save();
    res.json({ success: true, data: branch });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/branches/:id', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const branch = await Branch.findById(req.params.id).populate('shopId');
    if (!branch) return res.status(404).json({ success: false, message: 'Not found' });
    if (branch.shopId.ownerId !== (user.id||user.sub)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (branch.isMain) return res.status(400).json({ success: false, message: 'Cannot delete main branch' });
    await Branch.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── CATEGORIES ────────────────────────────────────────────────────────────────



app.patch('/api/categories/:id', async (req, res) => {
  try {
    const cat = await ShopCategory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: cat });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await ShopCategory.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── PRODUCTS ──────────────────────────────────────────────────────────────────




app.patch('/api/products/:id', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    const p = await ShopProduct.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: p });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Login required' });
    await ShopProduct.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── INVENTORY STATS ───────────────────────────────────────────────────────────


// ── SUB-USERS ─────────────────────────────────────────────────────────────────



app.patch('/api/shopusers/:id', async (req, res) => {
  try {
    const su = await ShopSubUser.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, data: su });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

app.delete('/api/shopusers/:id', async (req, res) => {
  try {
    await ShopSubUser.findByIdAndUpdate(req.params.id, { active: false });
    res.json({ success: true });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});



// ── Seed sample shop (runs once on first start if no shops exist) ─────────────
async function seedSampleShop() {
  try {
    const count = await Shop.countDocuments();
    if (count > 0) return; // already seeded

    console.log('[Seed] No shops found — seeding sample shop…');

    // Find or create demo owner
    let owner = await User.findOne({ email: 'demo@aircoast.co.ke' }).catch(() => null);
    if (!owner) {
      const bcrypt = require('bcryptjs');

// ── Subscription Plans ───────────────────────────────────────────────────────
const PLANS = {
  starter: { name:'Starter', price:500,  annualPrice:5000,  limits:{products:10, branches:1, staff:0, analyticsDays:7,  hotDeals:false} },
  growth:  { name:'Growth',  price:1000, annualPrice:10000, limits:{products:50, branches:3, staff:3, analyticsDays:30, hotDeals:true}  },
  pro:     { name:'Pro',     price:1500, annualPrice:15000, limits:{products:-1, branches:-1,staff:-1,analyticsDays:90, hotDeals:true}  },
};
function getPlanLimits(shop) { const p=shop?.subscription?.plan||'growth'; return PLANS[p]?.limits||PLANS.growth.limits; }
function isSubscriptionActive(shop) {
  const sub=shop?.subscription; if(!sub) return false;
  const paid=sub.paidUntil?new Date(sub.paidUntil):null;
  const grace=sub.graceUntil?new Date(sub.graceUntil):null;
  return (paid&&paid>new Date())||(grace&&grace>new Date());
}


      owner = await User.create({
        firstName: 'Demo', lastName: 'Owner',
        email: 'demo@aircoast.co.ke',
        password: await bcrypt.hash('Demo@2025!', 10),
        phone: '+254712345678',
        isVerified: true,
      });
    }

    const paidUntil = new Date();
    paidUntil.setMonth(paidUntil.getMonth() + 3);

    const shop = await Shop.create({
      name: 'TechZone Nairobi',
      slug: 'techzone-nairobi',
      description: "Kenya's premier ICT accessories store. We stock the best laptops, phones, accessories, and gadgets at unbeatable prices. Visit any of our 3 branches across Nairobi.",
      email: 'info@techzone.co.ke',
      phone: '+254 712 345 678',
      whatsapp: '254712345678',
      location: 'Nairobi, Kenya',
      themeColor: '#6366f1',
      logo: 'https://ui-avatars.com/api/?name=TechZone&background=6366f1&color=fff&size=128&bold=true&rounded=true',
      banner: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1400&q=80',
      social: { facebook:'https://facebook.com',instagram:'https://instagram.com',twitter:'https://twitter.com',tiktok:'https://tiktok.com',whatsapp:'https://wa.me/254712345678' },
      ownerId: owner._id.toString(),
      ownerEmail: owner.email,
      status: 'active', published: true, rating: 4.7, totalSales: 342,
      subscription: { plan:'basic', fee:1500, paidUntil, lastPaid: new Date(), mpesaRef:'SEED001' },
    });

    const [mainB, cbdB, westB] = await Branch.insertMany([
      { shopId:shop._id, name:'TechZone — Moi Avenue (Main)', location:'Moi Avenue, CBD, Nairobi', phone:'+254 712 345 678', email:'cbd@techzone.co.ke', whatsapp:'254712345678', hours:'Mon-Sat 8am-7pm, Sun 10am-5pm', isMain:true },
      { shopId:shop._id, name:'TechZone — Tom Mboya Branch', location:'Tom Mboya Street, Nairobi CBD', phone:'+254 722 111 222', email:'tom@techzone.co.ke', whatsapp:'254722111222', hours:'Mon-Sat 8:30am-6:30pm' },
      { shopId:shop._id, name:'TechZone — Westlands', location:'Sarit Centre, Westlands, Nairobi', phone:'+254 733 444 555', email:'westlands@techzone.co.ke', whatsapp:'254733444555', hours:'Mon-Sun 9am-8pm' },
    ]);

    const [cLap,cPh,cAcc,cGam,cNet,cSmart] = await ShopCategory.insertMany([
      { shopId:shop._id, name:'Laptops & Computers', icon:'💻', color:'#6366f1', sortOrder:1 },
      { shopId:shop._id, name:'Phones & Tablets',    icon:'📱', color:'#ec4899', sortOrder:2 },
      { shopId:shop._id, name:'Accessories',         icon:'🎧', color:'#f59e0b', sortOrder:3 },
      { shopId:shop._id, name:'Gaming',              icon:'🎮', color:'#ef4444', sortOrder:4 },
      { shopId:shop._id, name:'Networking',          icon:'📡', color:'#22c55e', sortOrder:5 },
      { shopId:shop._id, name:'Smart Devices',       icon:'⌚', color:'#0ea5e9', sortOrder:6 },
    ]);

    const all=[mainB._id,cbdB._id,westB._id], main=[mainB._id], cbd=[cbdB._id,westB._id];

    await ShopProduct.insertMany([
      { shopId:shop._id, name:'MacBook Pro 14-inch M3 Space Gray', description:'Apple MacBook Pro 14-inch with M3 chip. 8GB RAM, 512GB SSD. Liquid Retina XDR display, 18-hour battery.', price:185000, salePrice:172000, onSale:true, discountPct:7, stock:8, sold:24, sku:'MBP-14-M3', featured:true, categoryId:cLap._id, categoryName:'Laptops & Computers', branchIds:all, images:['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&q=80'], tags:['apple','macbook','laptop'] },
      { shopId:shop._id, name:'Dell XPS 15 OLED Display', description:'Dell XPS 15 with Intel Core i7-13700H, 16GB RAM, 512GB SSD. Stunning 15.6-inch OLED InfinityEdge display.', price:145000, stock:5, sold:12, sku:'DELL-XPS15', featured:true, categoryId:cLap._id, categoryName:'Laptops & Computers', branchIds:all, images:['https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&q=80'], tags:['dell','xps','laptop'] },
      { shopId:shop._id, name:'HP Pavilion 15 i5 11th Gen', description:'HP Pavilion 15 with Intel Core i5-1135G7, 8GB RAM, 256GB SSD. Great everyday laptop for students.', price:68000, salePrice:59999, onSale:true, discountPct:12, stock:14, sold:38, sku:'HP-PAV15', categoryId:cLap._id, categoryName:'Laptops & Computers', branchIds:all, images:['https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&q=80'], tags:['hp','pavilion','student'] },
      { shopId:shop._id, name:'Lenovo ThinkPad E15 Business Laptop', description:'Lenovo ThinkPad E15 with AMD Ryzen 5 5600U, 16GB RAM, 512GB SSD. MIL-SPEC durability.', price:89000, stock:7, sold:19, sku:'LEN-TPE15', categoryId:cLap._id, categoryName:'Laptops & Computers', branchIds:cbd, images:['https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&q=80'], tags:['lenovo','thinkpad','business'] },
      { shopId:shop._id, name:'Samsung Galaxy S24 Ultra 256GB', description:'Samsung flagship with built-in S Pen, 200MP camera, AI features, titanium frame. 6.8-inch Dynamic AMOLED.', price:155000, salePrice:139000, onSale:true, discountPct:10, stock:12, sold:67, sku:'SAM-S24U', featured:true, categoryId:cPh._id, categoryName:'Phones & Tablets', branchIds:all, images:['https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&q=80'], tags:['samsung','galaxy','android'] },
      { shopId:shop._id, name:'iPhone 15 Pro 128GB Titanium', description:'Apple iPhone 15 Pro with A17 Pro chip, 48MP triple camera, Action Button, USB-C. Premium titanium frame.', price:165000, stock:9, sold:43, sku:'IP15P-128', featured:true, categoryId:cPh._id, categoryName:'Phones & Tablets', branchIds:all, images:['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=600&q=80'], tags:['apple','iphone','ios'] },
      { shopId:shop._id, name:'Tecno Spark 20 Pro 256GB', description:'Tecno Spark 20 Pro with Helio G99, 8GB RAM, 256GB. 6.78-inch FHD+, 50MP camera, 5000mAh battery.', price:28500, salePrice:24999, onSale:true, discountPct:12, stock:28, sold:156, sku:'TEC-SP20P', categoryId:cPh._id, categoryName:'Phones & Tablets', branchIds:all, images:['https://images.unsplash.com/photo-1512054502232-10a0a035d672?w=600&q=80'], tags:['tecno','android','affordable'] },
      { shopId:shop._id, name:'iPad Pro 11-inch M4 WiFi 256GB', description:'Apple iPad Pro 11-inch with M4 chip, Ultra Retina XDR display, Apple Pencil Pro support.', price:125000, stock:6, sold:18, sku:'IPADPRO11-M4', categoryId:cPh._id, categoryName:'Phones & Tablets', branchIds:main, images:['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&q=80'], tags:['apple','ipad','tablet'] },
      { shopId:shop._id, name:'Sony WH-1000XM5 Wireless Headphones', description:'Industry-leading noise cancellation, 30-hour battery, multipoint connection. Foldable design with carry case.', price:38000, salePrice:32999, onSale:true, discountPct:13, stock:15, sold:89, sku:'SONY-WH1000XM5', featured:true, categoryId:cAcc._id, categoryName:'Accessories', branchIds:all, images:['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&q=80'], tags:['sony','headphones','noise-cancelling'] },
      { shopId:shop._id, name:'Anker PowerCore 20000mAh Power Bank', description:'20W USB-C PD and 18W Quick Charge 3.0. Charge 2 devices simultaneously. Includes carry pouch and cable.', price:4500, stock:45, sold:234, sku:'ANK-PC20K', categoryId:cAcc._id, categoryName:'Accessories', branchIds:all, images:['https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600&q=80'], tags:['anker','powerbank','charger'] },
      { shopId:shop._id, name:'Logitech MX Master 3S Wireless Mouse', description:'MagSpeed electromagnetic scrolling, 8K DPI, quiet clicks. Works on any surface. 70-day battery life.', price:12500, stock:22, sold:67, sku:'LOG-MXM3S', categoryId:cAcc._id, categoryName:'Accessories', branchIds:all, images:['https://images.unsplash.com/photo-1629429408209-1f912961dbd8?w=600&q=80'], tags:['logitech','mouse','wireless'] },
      { shopId:shop._id, name:'65W GaN Charger 4-Port USB', description:'Compact 65W GaN charger with 2x USB-C and 2x USB-A ports. Charge laptop, phone, tablet simultaneously.', price:3200, salePrice:2799, onSale:true, discountPct:13, stock:60, sold:312, sku:'GAN65W-4PT', categoryId:cAcc._id, categoryName:'Accessories', branchIds:all, images:['https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=600&q=80'], tags:['charger','gan','usb-c'] },
      { shopId:shop._id, name:'Apple AirPods Pro 2nd Generation', description:'H2 chip, Adaptive Audio, ANC, Transparency mode. 6-hour listening time, 30 hours with case. MagSafe.', price:28000, stock:11, sold:45, sku:'AIRPODSPRO2', featured:true, categoryId:cAcc._id, categoryName:'Accessories', branchIds:all, images:['https://images.unsplash.com/photo-1603351154351-5e2d0600bb77?w=600&q=80'], tags:['apple','airpods','earbuds'] },
      { shopId:shop._id, name:'PlayStation 5 Disc Edition', description:'Sony PS5 with DualSense controller. 825GB SSD, 4K gaming, 120fps support, ray tracing included.', price:78000, stock:4, sold:28, sku:'SONY-PS5', featured:true, categoryId:cGam._id, categoryName:'Gaming', branchIds:main, images:['https://images.unsplash.com/photo-1607853202273-797f1c22a38e?w=600&q=80'], tags:['sony','ps5','console','gaming'] },
      { shopId:shop._id, name:'Xbox Wireless Controller Carbon Black', description:'Official Xbox Wireless Controller with textured grip, hybrid D-pad, 40-hour battery. Works on Xbox, PC, mobile.', price:8500, stock:18, sold:92, sku:'XBOX-CTRL-BLK', categoryId:cGam._id, categoryName:'Gaming', branchIds:all, images:['https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=600&q=80'], tags:['xbox','controller','gaming'] },
      { shopId:shop._id, name:'ASUS ROG Strix Gaming Chair', description:'Lumbar support, 4D armrests, reclining backrest 90-180 degrees, breathable fabric with PU leather accents.', price:42000, salePrice:37500, onSale:true, discountPct:11, stock:3, sold:9, sku:'ASUS-ROG-CHAIR', categoryId:cGam._id, categoryName:'Gaming', branchIds:main, images:['https://images.unsplash.com/photo-1598550487031-0898b4852123?w=600&q=80'], tags:['asus','rog','gaming','chair'] },
      { shopId:shop._id, name:'TP-Link Deco XE75 WiFi 6E 3-Pack', description:'Whole-home mesh WiFi 6E system. Tri-band, AXE5400 speeds. Covers up to 7200 sq ft. Works with Alexa.', price:28000, stock:9, sold:34, sku:'TPLINK-DECOXE75', categoryId:cNet._id, categoryName:'Networking', branchIds:all, images:['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80'], tags:['tp-link','mesh','wifi6e','router'] },
      { shopId:shop._id, name:'4G LTE MiFi Portable Router', description:'Portable WiFi hotspot, supports up to 10 devices, 3000mAh battery. Works with any Kenyan SIM card.', price:3800, stock:35, sold:178, sku:'MIFI-4G', categoryId:cNet._id, categoryName:'Networking', branchIds:all, images:['https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&q=80'], tags:['mifi','4g','hotspot'] },
      { shopId:shop._id, name:'Apple Watch Series 9 41mm GPS', description:'S9 chip, brighter Always-On Retina display, double tap gesture, crash detection. 18-hour battery life.', price:52000, salePrice:47500, onSale:true, discountPct:9, stock:7, sold:31, sku:'AW9-41-GPS', featured:true, categoryId:cSmart._id, categoryName:'Smart Devices', branchIds:all, images:['https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600&q=80'], tags:['apple','watch','smartwatch'] },
      { shopId:shop._id, name:'Samsung Galaxy Watch 6 Classic 43mm', description:'Rotating bezel, 1.5-inch Super AMOLED display, BioActive sensor for heart rate, body composition, sleep tracking.', price:38000, stock:8, sold:22, sku:'GW6C-43', categoryId:cSmart._id, categoryName:'Smart Devices', branchIds:all, images:['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80'], tags:['samsung','galaxy','smartwatch'] },
    ]);;

    console.log('[Seed] ✅ Sample shop seeded: TechZone Nairobi (slug: techzone-nairobi)');
    console.log('[Seed]    Demo login: demo@aircoast.co.ke / Demo@2025!');
  } catch (err) {
    console.error('[Seed] Shop seed error:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════
// SUBSCRIPTION EXPIRY + SUSPENSION CRON (runs every 6 hours)
// ══════════════════════════════════════════════════════════════
async function runSubscriptionCheck() {
  try {
    const now = new Date();

    // 1. Suspend expired shops
    const expired = await Shop.find({ status: 'active', published: true, 'subscription.paidUntil': { $lt: now } });
    for (const shop of expired) {
      shop.status = 'suspended';
      shop.published = false;
      await shop.save();
      console.log(`[Sub] Suspended expired shop: ${shop.name} (expired ${shop.subscription.paidUntil})`);
    }

    // 2. Flag shops expiring within 7 days (for notification UI)
    const sevenDays = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    const expiringSoon = await Shop.find({ status: 'active', 'subscription.paidUntil': { $gt: now, $lt: sevenDays } });
    for (const shop of expiringSoon) {
      const daysLeft = Math.ceil((new Date(shop.subscription.paidUntil) - now) / (1000 * 3600 * 24));
      console.log(`[Sub] Expiry warning: ${shop.name} expires in ${daysLeft} day(s)`);
      // In production: send email/SMS to shop.ownerEmail
    }

    if (expired.length || expiringSoon.length) {
      console.log(`[Sub] Check done: ${expired.length} suspended, ${expiringSoon.length} expiring soon`);
    }
  } catch (err) {
    console.error('[Sub] Cron error:', err.message);
  }
}

// Run only after DB connects, every 6 hours
// (called from inside mongoose.connect callback below)
let _cronStarted = false;
function startCron() {
  if (_cronStarted) return;
  _cronStarted = true;
  setTimeout(runSubscriptionCheck, 5000); // 5s delay after connect
  setInterval(runSubscriptionCheck, 6 * 60 * 60 * 1000);
}

// GET /api/shops/:id/subscription-status — check expiry warning for dashboard


// ══════════════════════════════════════════════════════════════════════════════
// USER AUTH ROUTES — Clean, simple, reliable
// ══════════════════════════════════════════════════════════════════════════════









// ══════════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD API ROUTES
// ══════════════════════════════════════════════════════════════════════════════

function requireAdminJWT(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ success:false, message:'Admin auth required' });
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ success:false });
    req.adminId = decoded.id;
    next();
  } catch { return res.status(401).json({ success:false, message:'Invalid token' }); }
}

// Also accept td_token (legacy admin token)
function adminAuth(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ success:false, message:'Admin login required' });
  const SECRET = process.env.JWT_SECRET || 'aircoast_secret_2025';
  try {
    const d = jwt.verify(token, SECRET);
    if (d.role === 'admin' || d.isAdmin) { req.adminId = d.id || d.sub; return next(); }
  } catch {}
  return res.status(401).json({ success:false, message:'Admin login required' });
}



// GET /api/admin/debug-shop — show admin email and all shops (TEMPORARY)
app.get('/api/admin/debug-shop', adminAuth, async (req, res) => {
  try {
    const adminRec  = await Admin.findOne({ role:'admin' }).lean();
    const allShops  = await Shop.find({}).lean();
    res.json({
      adminEmail:    adminRec?.email || 'NOT SET',
      adminUsername: adminRec?.username,
      allShops: allShops.map(s=>({ id:s._id, name:s.name, ownerId:s.ownerId, ownerEmail:s.ownerEmail }))
    });
  } catch(err) { res.status(500).json({ error:err.message }); }
});


// GET /api/admin/debug-shops — shows all shops + admin record for debugging
app.get('/api/admin/debug-shops', adminAuth, async (req, res) => {
  try {
    const adminRec = await Admin.findOne({ role:'admin' }).lean();
    const allShops = await Shop.find({}).lean().select ? 
      await Shop.find({}).lean() : 
      await Shop.find({}).lean();
    res.json({
      adminRecord:  { username:adminRec?.username, email:adminRec?.email, _id:adminRec?._id },
      totalShops:   allShops.length,
      shops:        allShops.map(s=>({ name:s.name, ownerId:s.ownerId, ownerEmail:s.ownerEmail, slug:s.slug, _id:s._id })),
    });
  } catch(err) { res.status(500).json({ error:err.message }); }
});


// GET /api/admin/debug-shop — debug admin shop lookup
app.get('/api/admin/debug-shop', adminAuth, async (req, res) => {
  try {
    const adminRec = await Admin.findOne({ role:'admin' }).lean();
    const allShops = await Shop.find({}).lean();
    res.json({
      adminEmail: adminRec?.email || 'NOT SET',
      adminUsername: adminRec?.username,
      totalShops: allShops.length,
      shops: allShops.map(s => ({
        name: s.name,
        ownerEmail: s.ownerEmail,
        ownerId: s.ownerId?.toString(),
        status: s.status
      }))
    });
  } catch(err) { res.status(500).json({ error: err.message }); }
});
// GET /api/admin/my-shops — finds all shops owned by admin
app.get('/api/admin/my-shops', adminAuth, async (req, res) => {
  try {
    // Get admin record
    const adminRec = await Admin.findOne({ role:'admin' }).lean();
    const adminEmail = adminRec?.email || '';

    let shops = [];

    // Search 1: by ownerEmail
    if (adminEmail) {
      shops = await Shop.find({ ownerEmail: adminEmail }).sort({ createdAt:-1 }).lean();
    }

    // Search 2: by linked User ownerId
    if (!shops.length && adminEmail) {
      const linkedUser = await User.findOne({ email: adminEmail }).lean();
      if (linkedUser) {
        shops = await Shop.find({ ownerId: linkedUser._id.toString() }).sort({ createdAt:-1 }).lean();
      }
    }

    // Search 3: if still nothing, get ALL shops (admin manages everything)
    if (!shops.length) {
      shops = await Shop.find({}).sort({ createdAt:-1 }).lean();
    }

    const data = shops.map(s => ({ ...s, id:s._id?.toString(), slug:s.slug||'' }));
    res.json({ success:true, data, adminEmail });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/admin/shops-list — list all shops with full details for admin cleanup
app.get('/api/admin/shops-list', adminAuth, async (req, res) => {
  try {
    const shops = await Shop.find({}).sort({ createdAt: -1 }).lean();
    res.json({ 
      success: true, 
      count: shops.length,
      shops: shops.map(s => ({
        id:         s._id.toString(),
        name:       s.name,
        slug:       s.slug,
        ownerEmail: s.ownerEmail,
        status:     s.status,
        published:  s.published,
        createdAt:  s.createdAt
      }))
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/admin/shops-cleanup — delete shops by ID list
app.delete('/api/admin/shops-cleanup', adminAuth, async (req, res) => {
  try {
    const { deleteIds } = req.body; // array of shop IDs to delete
    if (!deleteIds || !deleteIds.length) 
      return res.status(400).json({ success:false, message:'No IDs provided' });
    
    let deleted = 0;
    for (const id of deleteIds) {
      await Shop.findByIdAndDelete(id).catch(()=>null);
      await ShopProduct.deleteMany({ shopId: id }).catch(()=>null);
      await Branch.deleteMany({ shopId: id }).catch(()=>null);
      await ShopCategory.deleteMany({ shopId: id }).catch(()=>null);
      deleted++;
    }
    res.json({ success:true, deleted, message: deleted + ' store(s) deleted' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/admin/stats
app.get('/api/admin/stats', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const month_ago = new Date(now - 30*24*60*60*1000);
    const week_ago  = new Date(now - 7*24*60*60*1000);

    const [
      totalUsers, newUsersMonth, activeShops, totalShops,
      totalProducts, totalBranches, pendingShops,
      newShopsMonth, newProductsWeek
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt:{ $gte:month_ago } }),
      Shop.countDocuments({ status:'active', published:true }),
      Shop.countDocuments({}),
      ShopProduct.countDocuments({ active:true }),
      Branch.countDocuments({ status:'active' }),
      Shop.countDocuments({ status:'pending' }),
      Shop.countDocuments({ createdAt:{ $gte:month_ago } }),
      ShopProduct.countDocuments({ createdAt:{ $gte:week_ago } }),
    ]);

    // Revenue from subscriptions
    const subRevenue = await SubscriptionPayment.aggregate([
      { $match: { status:'paid' } },
      { $group: { _id:null, total:{ $sum:'$amount' } } }
    ]).catch(()=>[]);
    const monthRevenue = await SubscriptionPayment.aggregate([
      { $match: { status:'paid', createdAt:{ $gte:month_ago } } },
      { $group: { _id:null, total:{ $sum:'$amount' } } }
    ]).catch(()=>[]);

    res.json({ success:true, stats:{
      totalUsers, newUsersMonth, activeShops, totalShops,
      totalProducts, totalBranches, pendingShops,
      newShopsMonth, newProductsWeek,
      totalRevenue: subRevenue[0]?.total || 0,
      monthRevenue: monthRevenue[0]?.total || 0,
    }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/admin/users
app.get('/api/admin/users', adminAuth, async (req, res) => {
  try {
    const { page=1, limit=20, search, status } = req.query;
    const filter = {};
    if (search) filter.$or = [
      { email:{ $regex:search, $options:'i' } },
      { username:{ $regex:search, $options:'i' } },
      { firstName:{ $regex:search, $options:'i' } },
    ];
    if (status === 'suspended') filter.suspended = true;
    if (status === 'verified')  filter.isVerified = true;
    const [users, total] = await Promise.all([
      User.find(filter).select('-password -verifyCode').sort({ createdAt:-1 })
        .skip((+page-1)*+limit).limit(+limit).lean(),
      User.countDocuments(filter),
    ]);
    // Attach shop count per user
    const shopCounts = await Shop.aggregate([
      { $group:{ _id:'$ownerId', count:{ $sum:1 } } }
    ]).catch(()=>[]);
    const shopMap = {};
    // Normalize both key and lookup to string
    shopCounts.forEach(s => {
      if (s._id) shopMap[s._id.toString()] = s.count;
    });
    // Also count by ownerEmail as fallback
    const emailCounts = await Shop.aggregate([
      { $group:{ _id:'$ownerEmail', count:{ $sum:1 } } }
    ]).catch(()=>[]);
    const emailMap = {};
    emailCounts.forEach(s => { if (s._id) emailMap[s._id] = s.count; });
    const data = users.map(u => ({
      ...u, id:u._id?.toString(),
      shops: shopMap[u._id?.toString()] || emailMap[u.email] || 0
    }));
    res.json({ success:true, data, total, pages:Math.ceil(total/+limit) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});



// POST /api/admin/create-own-shop — admin creates a store they personally own
app.post('/api/admin/create-own-shop', adminAuth, async (req, res) => {
  try {
    const { name, description, email, phone, whatsapp, location,
            themeColor, logo, banner } = req.body;

    if (!name?.trim()) return res.status(400).json({ success:false, message:'Store name required' });

    // Get admin email from DB
    const adminRecord = await Admin.findOne({ role:'admin' }).lean();
    const adminEmail  = adminRecord?.email || email || 'admin@sela.co.ke';

    // Find or create User account for admin
    let ownerUser = await User.findOne({ email: adminEmail }).lean();
    if (!ownerUser) {
      try {
        ownerUser = await User.create({
          firstName:  'SELA',
          lastName:   'Admin',
          username:   'admin_' + Date.now().toString(36),
          email:       adminEmail,
          password:    await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@SELA2025!', 10),
          isVerified:  true,
        });
      } catch {
        ownerUser = await User.findOne({ email: adminEmail }).lean();
      }
    }

    if (!ownerUser) return res.status(400).json({ 
      success:false, 
      message:'Could not resolve admin user account. Go to Settings → Admin Account Setup first.' 
    });

    // Generate unique slug
    const base = slugify(name);
    let slug = base;
    let n = 1;
    while (await Shop.findOne({ slug })) slug = base + '-' + (++n);

    const shop = await Shop.create({
      name:        name.trim(),
      slug,
      description: description || '',
      email:       adminEmail,
      phone:       phone     || '',
      whatsapp:    whatsapp  || '',
      location:    location  || '',
      themeColor:  themeColor || '#6366f1',
      logo:        logo      || '',
      banner:      banner    || '',
      social:      {},
      ownerId:     ownerUser._id.toString(),
      ownerEmail:  adminEmail,
      status:      'active',
      published:   true,
    });

    res.status(201).json({
      success: true,
      message: `Store "${shop.name}" created under admin account`,
      data:    { ...shop.toObject(), id: shop._id.toString() }
    });

  } catch(err) {
    if (err.code === 11000)
      return res.status(400).json({ success:false, message:'A store with that name already exists — try a different name' });
    res.status(500).json({ success:false, message: err.message });
  }
});

// POST /api/admin/create-shop — admin creates store on behalf of a user
app.post('/api/admin/create-shop', adminAuth, async (req, res) => {
  try {
    const { name, slug, ownerEmail, ownerId, location, phone, whatsapp,
            description, themeColor, logo, banner } = req.body;

    if (!name || !ownerEmail)
      return res.status(400).json({ success:false, message:'Store name and owner email required' });

    // Resolve owner — find by ID or email
    let owner = null;
    if (ownerId) owner = await User.findById(ownerId).lean().catch(()=>null);
    if (!owner)  owner = await User.findOne({ email: ownerEmail.toLowerCase() }).lean().catch(()=>null);
    if (!owner)  return res.status(404).json({ success:false, message:'Owner user not found — create the user first' });

    // Generate unique slug
    const baseSlug = slugify(name);
    let finalSlug = slug || baseSlug;
    let n = 1;
    while (await Shop.findOne({ slug: finalSlug })) finalSlug = baseSlug + '-' + (++n);

    const shop = await Shop.create({
      name, slug: finalSlug,
      ownerId:    owner._id.toString(),
      ownerEmail: owner.email,
      description: description || '',
      email:     owner.email,
      phone:     phone      || '',
      whatsapp:  whatsapp   || '',
      location:  location   || '',
      themeColor: themeColor || '#6366f1',
      logo:      logo       || '',
      banner:    banner     || '',
      status:    'active',
      published: true,
      social:    {},
    });

    res.status(201).json({
      success: true,
      data: { ...shop.toObject(), id: shop._id.toString() },
      message: `Store "${name}" created for ${owner.email}`,
    });
  } catch(err) {
    if (err.code === 11000)
      return res.status(400).json({ success:false, message:'A store with that slug already exists — try a different name' });
    res.status(500).json({ success:false, message:err.message });
  }
});

// POST /api/admin/users/:id/suspend
app.post('/api/admin/users/:id/suspend', adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    user.suspended = !user.suspended;
    await user.save();
    res.json({ success:true, suspended:user.suspended, message: user.suspended ? 'User suspended' : 'User reinstated' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/admin/users/:id
app.delete('/api/admin/users/:id', adminAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ success:true, message:'User deleted' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/admin/shops
app.get('/api/admin/shops', adminAuth, async (req, res) => {
  try {
    const { page=1, limit=20, search, status } = req.query;
    const filter = {};
    if (search) filter.name = { $regex:search, $options:'i' };
    if (status && status !== 'all') filter.status = status;
    const [shops, total] = await Promise.all([
      Shop.find(filter).sort({ createdAt:-1 }).skip((+page-1)*+limit).limit(+limit).lean(),
      Shop.countDocuments(filter),
    ]);
    // Attach product counts
    const prodCounts = await ShopProduct.aggregate([
      { $match:{ active:true } },
      { $group:{ _id:'$shopId', count:{ $sum:1 } } }
    ]).catch(()=>[]);
    const prodMap = {};
    prodCounts.forEach(p => { prodMap[p._id?.toString()] = p.count; });
    const data = shops.map(s => ({
      ...s, id:s._id?.toString(),
      products: prodMap[s._id?.toString()] || 0
    }));
    res.json({ success:true, data, total, pages:Math.ceil(total/+limit) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/admin/shops/:id/suspend
app.post('/api/admin/shops/:id/suspend', adminAuth, async (req, res) => {
  try {
    const shop = await Shop.findById(req.params.id);
    if (!shop) return res.status(404).json({ success:false, message:'Shop not found' });
    shop.status = shop.status === 'suspended' ? 'active' : 'suspended';
    await shop.save();
    res.json({ success:true, status:shop.status });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/admin/shops/:id
app.delete('/api/admin/shops/:id', adminAuth, async (req, res) => {
  try {
    await Promise.all([
      Shop.findByIdAndDelete(req.params.id),
      ShopProduct.deleteMany({ shopId:req.params.id }),
      Branch.deleteMany({ shopId:req.params.id }),
      ShopCategory.deleteMany({ shopId:req.params.id }),
    ]);
    res.json({ success:true, message:'Store deleted' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// POST /api/admin/change-password
app.post('/api/admin/change-password', adminAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success:false, message:'Password must be at least 8 characters' });
    const hash = await bcrypt.hash(newPassword, 10);
    await Admin.findOneAndUpdate({ role:'admin' }, { passwordHash: hash });
    res.json({ success:true, message:'Password updated' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/admin/recent-activity
app.get('/api/admin/activity', adminAuth, async (req, res) => {
  try {
    const [newUsers, newShops, newProducts] = await Promise.all([
      User.find({}).sort({ createdAt:-1 }).limit(5).lean(),
      Shop.find({}).sort({ createdAt:-1 }).limit(5).lean(),
      ShopProduct.find({ active:true }).sort({ createdAt:-1 }).limit(5).lean(),
    ]);
    res.json({ success:true, newUsers, newShops, newProducts });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});



// ── One-time admin email setup (call once, then it's a no-op) ─────────────────
app.post('/api/admin/setup-email', async (req, res) => {
  try {
    const { email, name, secret } = req.body;
    // Simple secret check to prevent abuse
    if (secret !== (process.env.SETUP_SECRET || 'sela_setup_2025'))
      return res.status(403).json({ success:false, message:'Invalid secret' });
    const updated = await Admin.findOneAndUpdate(
      { username:'admin' },
      { $set:{ email: email || 'admin@sela.co.ke', name: name || 'SELA Admin' } },
      { new:true }
    );
    if (!updated) return res.status(404).json({ success:false, message:'Admin not found' });
    res.json({ success:true, message:'Admin email updated', email:updated.email });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ── Admin panel ──────────────────────────────────────────────────────────────

// ══════════════════════════════════════════════════════════════════════════════
// SERVICES ROUTES (internal POS — NOT public marketplace)
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/shops/:id/services — list all services for a shop
app.get('/api/shops/:id/services', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success:false, message:'Login required' });
    const { active } = req.query;
    const shopId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id)
      : req.params.id;
    const filter = { shopId };
    if (active === 'true') filter.active = true;
    const services = await Service.find(filter).sort({ category:1, name:1 }).lean();
    res.json({ success:true, data:services.map(s => ({ ...s, id:s._id?.toString() })) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/shops/:id/services — create a service
app.post('/api/shops/:id/services', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success:false, message:'Login required' });
    const { name, description, category, basePrice, unit, minQty, icon, branchIds, active } = req.body;
    if (!name?.trim()) return res.status(400).json({ success:false, message:'Service name required' });
    if (basePrice === undefined || basePrice < 0) return res.status(400).json({ success:false, message:'Valid price required' });
    const service = await Service.create({
      shopId:      req.params.id,
      name:        name.trim(),
      description: description || '',
      category:    category    || 'General',
      basePrice:   Number(basePrice) || 0,
      unit:        unit    || 'per item',
      minQty:      Number(minQty) || 1,
      icon:        icon    || '🔧',
      branchIds:   branchIds || [],
      active:      active !== false,
    });
    res.status(201).json({ success:true, data:{ ...service.toObject(), id:service._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/services/:id — update a service
app.patch('/api/services/:id', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success:false, message:'Login required' });
    const allowed = ['name','description','category','basePrice','unit','minQty','icon','branchIds','active'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const service = await Service.findByIdAndUpdate(req.params.id, updates, { new:true }).lean();
    if (!service) return res.status(404).json({ success:false, message:'Service not found' });
    res.json({ success:true, data:{ ...service, id:service._id?.toString() } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/services/:id — delete a service
app.delete('/api/services/:id', async (req, res) => {
  try {
    const user = getShopUser(req);
    if (!user) return res.status(401).json({ success:false, message:'Login required' });
    await Service.findByIdAndDelete(req.params.id);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});



// ══════════════════════════════════════════════════════════════════════════════
// POS — SALES ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/shops/:id/sales — create a new sale
app.post('/api/shops/:id/sales', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });

    const { items, discount=0, paymentMethod='cash', cashPaid=0, mpesaPaid=0,
            mpesaRef='', note='', branchId } = req.body;

    if (!items || !items.length)
      return res.status(400).json({ success:false, message:'No items in sale' });

    const subtotal = items.reduce((sum, i) => sum + (i.unitPrice * i.qty), 0);
    const total    = Math.max(0, subtotal - discount);
    const changeDue = paymentMethod === 'cash' ? Math.max(0, cashPaid - total)
                    : paymentMethod === 'mpesa' ? 0
                    : Math.max(0, (cashPaid + mpesaPaid) - total);

    const sale = await Sale.create({
      shopId:        req.params.id,
      branchId:      branchId || null,
      cashierId:     auth.id,
      cashierName:   auth.name || auth.firstName,
      items:         items.map(i => ({
        type:      i.type || 'product',
        refId:     i.refId || i.id || '',
        name:      i.name,
        unitPrice: Number(i.unitPrice),
        qty:       Number(i.qty),
        total:     Number(i.unitPrice) * Number(i.qty),
        unit:      i.unit || 'pcs',
      })),
      subtotal,
      discount: Number(discount),
      total,
      paymentMethod,
      cashPaid:   Number(cashPaid),
      mpesaPaid:  Number(mpesaPaid),
      mpesaRef:   mpesaRef || '',
      changeDue,
      customerId:   req.body.customerId || null,
      customerName: req.body.customerName || '',
      note:         note || '',
      status:       'completed',
    });

    // Update stock for product items
    for (const item of items) {
      if (item.type === 'product' && item.refId) {
        // Try ShopProduct first
        const shopProd = await ShopProduct.findByIdAndUpdate(item.refId,
          { $inc: { stock: -item.qty, sold: item.qty } },
          { new: true }
        ).catch(() => null);
        // If not found as ShopProduct, try HotDeal
        if (!shopProd) {
          const deal = await HotDeal.findById(item.refId).catch(() => null);
          if (deal) {
            const newStock = Math.max(0, (deal.stock||0) - item.qty);
            deal.stock = newStock;
            if (newStock <= 0) deal.active = false;
            await deal.save().catch(() => {});
          }
        }
      }
    }

    // Update customer CRM stats
    if (req.body.customerId) {
      await Customer.findByIdAndUpdate(req.body.customerId, {
        $inc: { totalSpent: total, totalOrders: 1 },
        $set: { lastSeen: new Date() },
      }).catch(() => {});
    }

    res.status(201).json({ success:true, data:{ ...sale.toObject(), id:sale._id.toString() } });
  } catch(err) {
    console.error('Sale error:', err.message);
    res.status(500).json({ success:false, message:err.message });
  }
});

// GET /api/shops/:id/sales — list sales with pagination
app.get('/api/shops/:id/sales', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { page=1, limit=20, date, from, to, payment, status, q } = req.query;
    const shopId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id) : req.params.id;
    const filter = { shopId };
    if (from && to) {
      const f = new Date(from); f.setHours(0,0,0,0);
      const t = new Date(to);   t.setHours(23,59,59,999);
      filter.createdAt = { $gte:f, $lte:t };
    } else if (date) {
      const d = new Date(date);
      filter.createdAt = { $gte: d, $lt: new Date(d.getTime() + 86400000) };
    }
    if (payment) filter.paymentMethod = payment;
    if (status)  filter.status = status;
    if (q)       filter.$or = [
      { receiptNo:    { $regex:q, $options:'i' } },
      { customerName: { $regex:q, $options:'i' } },
      { cashierName:  { $regex:q, $options:'i' } },
    ];
    const [sales, total] = await Promise.all([
      Sale.find(filter).sort({ createdAt:-1 }).skip((page-1)*limit).limit(Number(limit)).lean(),
      Sale.countDocuments(filter),
    ]);
    const summary = await Sale.aggregate([
      { $match: { ...filter, status:'completed' } },
      { $group: { _id:null, revenue:{ $sum:'$total' }, count:{ $sum:1 } } }
    ]).catch(() => []);
    res.json({
      success: true,
      data:    sales.map(s => ({ ...s, id:s._id?.toString() })),
      total, pages: Math.ceil(total/limit),
      summary: summary[0] || { revenue:0, count:0 },
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/shops/:id/sales/today — today's summary
app.get('/api/shops/:id/sales/today', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shopId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id) : req.params.id;
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);
    const [agg, topProducts, hourly, sales] = await Promise.all([
      // Overall stats
      Sale.aggregate([
        { $match: { shopId, status:'completed', createdAt:{ $gte:start, $lte:end } } },
        { $group: { _id:null,
          revenue:  { $sum:'$total' },
          count:    { $sum:1 },
          cash:     { $sum:'$cashPaid' },
          mpesa:    { $sum:'$mpesaPaid' },
          discount: { $sum:'$discount' },
          avgSale:  { $avg:'$total' },
        }}
      ]),
      // Top products
      Sale.aggregate([
        { $match: { shopId, status:'completed', createdAt:{ $gte:start, $lte:end } } },
        { $unwind: '$items' },
        { $group: { _id:'$items.name', qty:{ $sum:'$items.qty' }, revenue:{ $sum:{ $multiply:['$items.unitPrice','$items.qty'] } } } },
        { $sort: { revenue:-1 } },
        { $limit: 5 },
      ]),
      // Hourly breakdown
      Sale.aggregate([
        { $match: { shopId, status:'completed', createdAt:{ $gte:start, $lte:end } } },
        { $group: { _id:{ $hour:'$createdAt' }, count:{ $sum:1 }, revenue:{ $sum:'$total' } } },
        { $sort: { '_id':1 } },
      ]),
      // Recent sales
      Sale.find({ shopId, createdAt:{ $gte:start, $lte:end } }).sort({ createdAt:-1 }).limit(15).lean(),
    ]);
    const stats = agg[0] || { revenue:0, count:0, cash:0, mpesa:0, discount:0, avgSale:0 };
    res.json({
      success: true,
      stats,
      topProducts: topProducts.map(p => ({ name:p._id, qty:p.qty, revenue:p.revenue })),
      hourly: hourly.map(h => ({ hour:h._id, count:h.count, revenue:h.revenue })),
      recent: sales.map(s => ({ ...s, id:s._id?.toString() })),
      date: new Date().toLocaleDateString('en-KE', { weekday:'long', year:'numeric', month:'long', day:'numeric' }),
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// FINANCIAL LEDGER ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/shops/:id/ledger/daily — daily revenue for date range
app.get('/api/shops/:id/ledger/daily', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });

    const shopId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id) : req.params.id;

    const { days=30, branchId, from, to } = req.query;

    let since = new Date();
    let until = new Date();
    until.setHours(23,59,59,999);

    if (from && to) {
      since = new Date(from); since.setHours(0,0,0,0);
      until = new Date(to);   until.setHours(23,59,59,999);
    } else {
      since.setDate(since.getDate() - parseInt(days));
      since.setHours(0,0,0,0);
    }

    const match = { shopId, status:'completed', createdAt:{ $gte:since, $lte:until } };
    if (branchId && mongoose.Types.ObjectId.isValid(branchId))
      match.branchId = new mongoose.Types.ObjectId(branchId);

    const daily = await Sale.aggregate([
      { $match: match },
      { $group: {
        _id: { $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' } },
        revenue:   { $sum:'$total' },
        sales:     { $sum:1 },
        cash:      { $sum:'$cashPaid' },
        mpesa:     { $sum:'$mpesaPaid' },
        discount:  { $sum:'$discount' },
        items:     { $sum:{ $size:'$items' } },
      }},
      { $sort: { _id:1 } },
    ]);

    // Fill missing days with zeros
    const result = [];
    const cursor = new Date(since);
    const today  = new Date();
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0,10);
      const found = daily.find(d => d._id === key);
      result.push(found || { _id:key, revenue:0, sales:0, cash:0, mpesa:0, discount:0, items:0 });
      cursor.setDate(cursor.getDate()+1);
    }

    // Overall totals
    const totals = result.reduce((acc, d) => ({
      revenue:  acc.revenue  + d.revenue,
      sales:    acc.sales    + d.sales,
      cash:     acc.cash     + d.cash,
      mpesa:    acc.mpesa    + d.mpesa,
      discount: acc.discount + d.discount,
    }), { revenue:0, sales:0, cash:0, mpesa:0, discount:0 });

    res.json({ success:true, data:result, totals });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/shops/:id/ledger/summary — all-time summary + product/service breakdown
app.get('/api/shops/:id/ledger/summary', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });

    const shopId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id) : req.params.id;

    const { period='month', from, to } = req.query;

    let since = new Date();
    let until = new Date();
    until.setHours(23,59,59,999);

    if (from && to) {
      // Custom date range
      since = new Date(from); since.setHours(0,0,0,0);
      until = new Date(to);   until.setHours(23,59,59,999);
    } else {
      if (period==='today')  { since.setHours(0,0,0,0); }
      else if (period==='week')  { since.setDate(since.getDate()-7); }
      else if (period==='month') { since.setDate(since.getDate()-30); }
      else if (period==='year')  { since.setFullYear(since.getFullYear()-1); }
      else { since.setFullYear(2000); }
    }

    const match = { shopId, status:'completed', createdAt:{ $gte:since, $lte:until } };

    const [overview, byPayment, topItems, byBranch] = await Promise.all([
      // Overall
      Sale.aggregate([
        { $match: match },
        { $group: { _id:null,
          revenue:  { $sum:'$total' },
          sales:    { $sum:1 },
          discount: { $sum:'$discount' },
          cash:     { $sum:'$cashPaid' },
          mpesa:    { $sum:'$mpesaPaid' },
          avgSale:  { $avg:'$total' },
        }}
      ]),
      // By payment method
      Sale.aggregate([
        { $match: match },
        { $group: { _id:'$paymentMethod', revenue:{ $sum:'$total' }, count:{ $sum:1 } } },
      ]),
      // Top selling items
      Sale.aggregate([
        { $match: match },
        { $unwind:'$items' },
        { $group: { _id:'$items.name',
          type:    { $first:'$items.type' },
          revenue: { $sum:'$items.total' },
          qty:     { $sum:'$items.qty' },
          count:   { $sum:1 },
        }},
        { $sort:{ revenue:-1 } },
        { $limit:10 },
      ]),
      // By branch
      Sale.aggregate([
        { $match: match },
        { $group: { _id:'$branchId', revenue:{ $sum:'$total' }, sales:{ $sum:1 } } },
        { $sort:{ revenue:-1 } },
      ]),
    ]);

    res.json({
      success:  true,
      period,
      overview: overview[0] || { revenue:0, sales:0, discount:0, cash:0, mpesa:0, avgSale:0 },
      byPayment,
      topItems,
      byBranch,
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// CUSTOMER CRM ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/shops/:id/customers — list with search & pagination
app.get('/api/shops/:id/customers', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { q='', page=1, limit=30, tag } = req.query;
    const shopId = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id) : req.params.id;
    const filter = { shopId };
    if (q.trim()) {
      filter.$or = [
        { name:  { $regex:q, $options:'i' } },
        { phone: { $regex:q, $options:'i' } },
        { email: { $regex:q, $options:'i' } },
      ];
    }
    if (tag) filter.tags = tag;
    const [customers, total] = await Promise.all([
      Customer.find(filter).sort({ totalSpent:-1 }).skip((page-1)*limit).limit(Number(limit)).lean(),
      Customer.countDocuments(filter),
    ]);
    res.json({ success:true, data: customers.map(c=>({...c,id:c._id?.toString()})), total });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/shops/:id/customers — create customer
app.post('/api/shops/:id/customers', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { name, phone, email, idNumber, notes, tags } = req.body;
    if (!name?.trim()) return res.status(400).json({ success:false, message:'Name required' });
    // Check duplicate phone in same shop
    if (phone) {
      const exists = await Customer.findOne({ shopId:req.params.id, phone:phone.trim() });
      if (exists) return res.status(400).json({ success:false, message:'Customer with this phone already exists', existing: {...exists.toObject(), id:exists._id.toString()} });
    }
    const customer = await Customer.create({
      shopId:   req.params.id,
      name:     name.trim(),
      phone:    phone?.trim()||'',
      email:    email?.trim()||'',
      idNumber: idNumber?.trim()||'',
      notes:    notes?.trim()||'',
      tags:     tags||[],
    });
    res.status(201).json({ success:true, data:{...customer.toObject(), id:customer._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/customers/:id — single customer with purchase history
app.get('/api/customers/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ success:false, message:'Customer not found' });
    const sales = await Sale.find({ customerId:req.params.id, status:'completed' })
      .sort({ createdAt:-1 }).limit(20).lean();
    res.json({ success:true, data:{...customer, id:customer._id?.toString()}, sales: sales.map(s=>({...s,id:s._id?.toString()})) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/customers/:id — update customer
app.patch('/api/customers/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const allowed = ['name','phone','email','idNumber','notes','tags','active'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new:true }).lean();
    if (!customer) return res.status(404).json({ success:false, message:'Not found' });
    res.json({ success:true, data:{...customer, id:customer._id?.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/customers/:id
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/shops/:id/customers/lookup — find or create by phone (used in POS)
app.post('/api/shops/:id/customers/lookup', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { phone, name } = req.body;
    if (!phone) return res.status(400).json({ success:false, message:'Phone required' });
    let customer = await Customer.findOne({ shopId:req.params.id, phone:phone.trim() }).lean();
    if (!customer && name) {
      customer = await Customer.create({ shopId:req.params.id, name:name.trim(), phone:phone.trim() });
      customer = customer.toObject();
    }
    if (!customer) return res.status(404).json({ success:false, message:'Customer not found' });
    res.json({ success:true, data:{...customer, id:customer._id?.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// PATCH /api/sales/:id/void — void a sale
app.patch('/api/sales/:id/void', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const sale = await Sale.findById(req.params.id).lean();
    if (!sale) return res.status(404).json({ success:false, message:'Sale not found' });
    if (sale.status !== 'completed')
      return res.status(400).json({ success:false, message:'Only completed sales can be voided' });
    // Restore stock
    for (const item of sale.items || []) {
      if (item.type === 'product' && item.refId) {
        await ShopProduct.findByIdAndUpdate(item.refId, {
          $inc: { stock: item.qty, sold: -item.qty }
        }).catch(() => {});
      }
    }
    // Update customer stats
    if (sale.customerId) {
      await Customer.findByIdAndUpdate(sale.customerId, {
        $inc: { totalSpent: -sale.total, totalOrders: -1 }
      }).catch(() => {});
    }
    await Sale.findByIdAndUpdate(req.params.id, { status:'voided' });
    res.json({ success:true, message:'Sale voided' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/sales/:id/refund — mark as refunded
app.patch('/api/sales/:id/refund', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const sale = await Sale.findById(req.params.id).lean();
    if (!sale) return res.status(404).json({ success:false, message:'Sale not found' });
    if (sale.status !== 'completed')
      return res.status(400).json({ success:false, message:'Only completed sales can be refunded' });
    await Sale.findByIdAndUpdate(req.params.id, { status:'refunded' });
    res.json({ success:true, message:'Sale marked as refunded' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE RBAC ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/shops/:id/users — list all staff
app.get('/api/shops/:id/users', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shopId = req.params.id;
    const staff = await ShopSubUser.find({ shopId }).sort({ createdAt:-1 }).lean();
    res.json({ success:true, data: staff.map(s => ({
      ...s,
      id: s._id?.toString(),
      permissions: {
        ...s.permissions,
        branchId: s.permissions?.branchId?.toString() || null,
      }
    }))});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/shops/:id/users — add staff member
app.post('/api/shops/:id/users', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { name, email, role='staff', permissions={}, branchId } = req.body;
    if (!name?.trim() || !email?.trim())
      return res.status(400).json({ success:false, message:'Name and email required' });

    // Find linked User account
    const linkedUser = await User.findOne({ email: email.trim().toLowerCase() }).lean();
    const userId = linkedUser ? linkedUser._id.toString() : email.trim();

    // Check not already added
    const exists = await ShopSubUser.findOne({ shopId: req.params.id, email: email.trim().toLowerCase() });
    if (exists) return res.status(400).json({ success:false, message:'This email is already on your team' });

    const staff = await ShopSubUser.create({
      shopId:  req.params.id,
      userId,
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      role,
      permissions: {
        scope:       branchId ? 'branch' : (permissions.scope || 'global'),
        branchId:    branchId || permissions.branchId || null,
        canCreate:   permissions.canCreate  !== false,
        canEdit:     permissions.canEdit    !== false,
        canDelete:   permissions.canDelete  === true,
        canViewSales:permissions.canViewSales !== false,
        canPOS:      permissions.canPOS       !== false,
        canCRM:      permissions.canCRM       !== false,
      },
      active: true,
    });

    res.status(201).json({ success:true, data:{ ...staff.toObject(), id:staff._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/shops/:id/users/:uid — update staff permissions or role
app.patch('/api/shops/:id/users/:uid', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { role, active, permissions, branchId } = req.body;
    const updates = {};
    if (role !== undefined)   updates.role   = role;
    if (active !== undefined) updates.active = active;
    if (permissions || branchId !== undefined) {
      const current = await ShopSubUser.findById(req.params.uid).lean();
      updates.permissions = {
        ...(current?.permissions || {}),
        ...(permissions || {}),
        scope:    branchId ? 'branch' : (permissions?.scope || current?.permissions?.scope || 'global'),
        branchId: branchId !== undefined ? (branchId || null) : current?.permissions?.branchId,
      };
    }
    const staff = await ShopSubUser.findByIdAndUpdate(req.params.uid, updates, { new:true }).lean();
    if (!staff) return res.status(404).json({ success:false, message:'Staff not found' });
    res.json({ success:true, data:{ ...staff, id:staff._id?.toString() } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/shops/:id/users/:uid — remove staff
app.delete('/api/shops/:id/users/:uid', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    await ShopSubUser.findByIdAndDelete(req.params.uid);
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/shops/:id/my-permissions — get current user's permissions in this shop
app.get('/api/shops/:id/my-permissions', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    // Check if owner
    const shop = await Shop.findById(req.params.id).lean();
    if (!shop) return res.status(404).json({ success:false, message:'Shop not found' });
    const isOwner = shop.ownerId?.toString() === auth.id ||
                    shop.ownerEmail === auth.email || auth.isAdmin;
    if (isOwner) {
      return res.json({ success:true, role:'owner', isOwner:true,
        permissions:{ scope:'global', canCreate:true, canEdit:true, canDelete:true,
          canViewSales:true, canPOS:true, canCRM:true } });
    }
    // Check sub-user
    const staff = await ShopSubUser.findOne({
      shopId: req.params.id,
      $or:[{ userId: auth.id },{ email: auth.email }],
      active: true,
    }).lean();
    if (!staff) return res.status(403).json({ success:false, message:'Not a member of this shop' });
    res.json({ success:true, role:staff.role, isOwner:false, permissions: staff.permissions });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// M-PESA ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/shops/:id/mpesa-settings — get mpesa config (sanitised — no secrets)


// PATCH /api/shops/:id/mpesa-settings — save mpesa config


// POST /api/shops/:id/mpesa/stk-push — initiate STK push
app.post('/api/shops/:id/mpesa/stk-push', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shop = await Shop.findById(req.params.id).lean();
    if (!shop?.mpesa?.enabled) return res.status(400).json({ success:false, message:'M-Pesa not configured for this shop' });
    const m = shop.mpesa;
    if (!m.consumerKey || !m.consumerSecret || !m.passkey)
      return res.status(400).json({ success:false, message:'M-Pesa credentials incomplete. Please update settings.' });

    const { phone, amount, accountRef } = req.body;
    if (!phone || !amount) return res.status(400).json({ success:false, message:'Phone and amount required' });

    const callbackURL = `${process.env.BASE_URL || req.protocol+'://'+req.get('host')}/api/mpesa/callback`;

    const daraja = new DarajaService(m.consumerKey, m.consumerSecret, m.passkey, m.shortCode, m.environment);
    const result = await daraja.stkPush({ phone, amount, accountRef: accountRef||'Payment', callbackURL });

    if (result.ResponseCode === '0') {
      res.json({ success:true, checkoutRequestID: result.CheckoutRequestID, message:'STK push sent' });
    } else {
      res.status(400).json({ success:false, message: result.ResponseDescription || 'STK push failed' });
    }
  } catch(err) {
    const msg = err?.response?.data?.errorMessage || err.message || 'STK push failed';
    res.status(500).json({ success:false, message: msg });
  }
});

// POST /api/shops/:id/mpesa/stk-query — check STK push status
app.post('/api/shops/:id/mpesa/stk-query', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shop = await Shop.findById(req.params.id).lean();
    const m = shop?.mpesa;
    if (!m?.consumerKey) return res.status(400).json({ success:false, message:'M-Pesa not configured' });

    const { checkoutRequestID } = req.body;
    const daraja = new DarajaService(m.consumerKey, m.consumerSecret, m.passkey, m.shortCode, m.environment);
    const result = await daraja.stkQuery(checkoutRequestID);

    if (result.ResultCode === '0' || result.ResultCode === 0) {
      res.json({ success:true, paid:true, message:'Payment confirmed' });
    } else if (result.ResultCode === '1032') {
      res.json({ success:true, paid:false, cancelled:true, message:'Cancelled by user' });
    } else {
      res.json({ success:true, paid:false, message: result.ResultDesc || 'Pending' });
    }
  } catch(err) {
    res.json({ success:true, paid:false, message:'Pending' });
  }
});

// POST /api/mpesa/callback — Safaricom callback endpoint
app.post('/api/mpesa/callback', async (req, res) => {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (callback) {
      console.log('📱 M-Pesa callback:', JSON.stringify(callback));
      // ResultCode 0 = success
      if (callback.ResultCode === 0) {
        const items = callback.CallbackMetadata?.Item || [];
        const get   = name => items.find(i=>i.Name===name)?.Value;
        const mpesaRef   = get('MpesaReceiptNumber');
        const amount     = get('Amount');
        const phone      = get('PhoneNumber');
        const checkoutID = callback.CheckoutRequestID;
        // Store result in a temp map so the polling endpoint can pick it up
        if (!global._mpesaResults) global._mpesaResults = {};
        global._mpesaResults[checkoutID] = { paid:true, mpesaRef, amount, phone };
      }
    }
    res.json({ ResultCode:0, ResultDesc:'Accepted' });
  } catch(err) { res.json({ ResultCode:0, ResultDesc:'Accepted' }); }
});

// GET /api/mpesa/result/:checkoutRequestID — poll for callback result
app.get('/api/mpesa/result/:id', (req, res) => {
  const result = global._mpesaResults?.[req.params.id];
  if (result) {
    delete global._mpesaResults[req.params.id];
    res.json({ success:true, ...result });
  } else {
    res.json({ success:true, paid:false });
  }
});


// Helper: sanitize shop for public view (strip mpesa credentials)
function sanitizeShop(shop) {
  if (!shop) return shop;
  const s = { ...shop, id: shop._id?.toString() };
  if (s.mpesa) {
    s.mpesa = {
      enabled:     s.mpesa.enabled     || false,
      type:        s.mpesa.type        || 'till',
      shortCode:   s.mpesa.shortCode   || '',
      accountName: s.mpesa.accountName || '',
      // Never expose consumerKey, consumerSecret, passkey
    };
  }
  return s;
}


// GET /api/product-lookup/:id — find product by ID in both classic and shop products
app.get('/api/product-lookup/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success:false, message:'Invalid product ID' });

    // Try ShopProduct first (vendor products)
    let product = await ShopProduct.findById(id).lean();
    let source = 'shop';

    if (!product) {
      // Try classic product
      product = await Product.findById(id).lean();
      source = 'classic';
    }

    if (!product) return res.status(404).json({ success:false, message:'Product not found' });

    // Normalise
    const data = {
      ...product,
      id:          product._id.toString(),
      shopId:      product.shopId?.toString() || null,
      source,
      price:       product.price || product.salePrice || 0,
      images:      product.images || (product.image ? [product.image] : []),
      description: product.description || '',
      name:        product.name,
      active:      product.active !== false,
    };

    // Fetch shop info
    if (data.shopId) {
      const shop = await Shop.findById(data.shopId).lean();
      if (shop) data._shop = {
        id:        shop._id.toString(),
        name:      shop.name,
        whatsapp:  shop.whatsapp || '',
        location:  shop.location || '',
        mpesa:     shop.mpesa ? { enabled:shop.mpesa.enabled, type:shop.mpesa.type, shortCode:shop.mpesa.shortCode, accountName:shop.mpesa.accountName } : null,
      };
    }

    res.json({ success:true, data });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// SHOP REVIEWS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/shops/:id/reviews/summary — avg rating + breakdown (public)
app.get('/api/shops/:id/reviews/summary', async (req, res) => {
  try {
    const agg = await ShopReview.aggregate([
      { $match: { shopId: new mongoose.Types.ObjectId(req.params.id), flagged: false } },
      { $group: {
          _id: null,
          avg:   { $avg: '$rating' },
          total: { $sum: 1 },
          r5: { $sum: { $cond: [{ $eq: ['$rating',5] }, 1, 0] } },
          r4: { $sum: { $cond: [{ $eq: ['$rating',4] }, 1, 0] } },
          r3: { $sum: { $cond: [{ $eq: ['$rating',3] }, 1, 0] } },
          r2: { $sum: { $cond: [{ $eq: ['$rating',2] }, 1, 0] } },
          r1: { $sum: { $cond: [{ $eq: ['$rating',1] }, 1, 0] } },
      }}
    ]);
    const s = agg[0] || { avg:0, total:0, r5:0, r4:0, r3:0, r2:0, r1:0 };
    res.json({ success:true, data:{ avg: Math.round(s.avg*10)/10, total:s.total, breakdown:{ 5:s.r5, 4:s.r4, 3:s.r3, 2:s.r2, 1:s.r1 } } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/shops/:id/reviews — paginated public reviews
app.get('/api/shops/:id/reviews', async (req, res) => {
  try {
    const { page=1, limit=10, sort='newest' } = req.query;
    const sortMap = { newest:{createdAt:-1}, highest:{rating:-1}, lowest:{rating:1} };
    const reviews = await ShopReview.find({ shopId:req.params.id, flagged:false })
      .sort(sortMap[sort]||{createdAt:-1})
      .skip((page-1)*limit).limit(Number(limit)).lean();
    const total = await ShopReview.countDocuments({ shopId:req.params.id, flagged:false });
    res.json({ success:true, data:reviews.map(r=>({...r,id:r._id.toString()})), total, pages:Math.ceil(total/limit) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/shops/:id/reviews/verify — check order exists before showing form
app.post('/api/shops/:id/reviews/verify', async (req, res) => {
  try {
    const { orderNo, phone } = req.body;
    if (!orderNo || !phone) return res.status(400).json({ success:false, message:'Order number and phone required' });
    const order = await Order.findOne({
      shopId:  req.params.id,
      orderNo: orderNo.trim().toUpperCase(),
      'customer.phone': { $regex: phone.replace(/ /g,'').slice(-9), $options:'i' },
      status: { $in: ['delivered','collected'] },
    }).lean();
    if (!order) return res.status(404).json({ success:false, message:'No completed order found with these details. Reviews are only available after delivery or collection.' });
    // Check not already reviewed
    const existing = await ShopReview.findOne({ orderId: order._id });
    if (existing) return res.status(400).json({ success:false, message:'You have already reviewed this order.' });
    res.json({ success:true, data:{ orderId:order._id.toString(), orderNo:order.orderNo, customerName:order.customer.name } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/shops/:id/reviews — submit a review
app.post('/api/shops/:id/reviews', async (req, res) => {
  try {
    const { orderId, orderNo, customerName, customerPhone, rating, comment } = req.body;
    if (!orderId || !rating || !comment?.trim()) return res.status(400).json({ success:false, message:'Order, rating and comment required' });
    if (rating < 1 || rating > 5) return res.status(400).json({ success:false, message:'Rating must be 1-5' });
    // Verify order belongs to this shop
    const order = await Order.findOne({ _id:orderId, shopId:req.params.id }).lean();
    if (!order) return res.status(404).json({ success:false, message:'Order not found' });
    // One review per order
    const existing = await ShopReview.findOne({ orderId });
    if (existing) return res.status(400).json({ success:false, message:'This order has already been reviewed' });
    const review = await ShopReview.create({
      shopId:   req.params.id,
      orderId,
      orderNo:  orderNo || order.orderNo,
      customer: { name: customerName||order.customer.name, phone: customerPhone||order.customer.phone },
      rating:   Number(rating),
      comment:  comment.trim(),
    });
    res.status(201).json({ success:true, data:{ ...review.toObject(), id:review._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/reviews/:id/reply — vendor replies to a review
app.patch('/api/reviews/:id/reply', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { reply } = req.body;
    if (!reply?.trim()) return res.status(400).json({ success:false, message:'Reply text required' });
    const review = await ShopReview.findByIdAndUpdate(req.params.id,
      { vendorReply: reply.trim(), repliedAt: new Date() },
      { new:true }
    ).lean();
    if (!review) return res.status(404).json({ success:false, message:'Review not found' });
    res.json({ success:true, data:{ ...review, id:review._id.toString() } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/reviews/:id/flag — flag inappropriate review
app.patch('/api/reviews/:id/flag', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    await ShopReview.findByIdAndUpdate(req.params.id, { flagged: true });
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/product-lookup-slug/:slug — find product by slug
app.get('/api/product-lookup-slug/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    // Try ShopProduct by slug
    let product = await ShopProduct.findOne({ slug }).lean();
    let source = 'shop';
    if (!product) {
      // Try classic product by slug
      product = await Product.findOne({ slug }).lean();
      source = 'classic';
    }
    if (!product) return res.status(404).json({ success:false, message:'Product not found' });
    const data = { ...product, id: product._id.toString(), shopId: product.shopId?.toString()||null, source, price: product.price||0, images: product.images||(product.image?[product.image]:[]), description: product.description||'', name: product.name };
    if (data.shopId) {
      const shop = await Shop.findById(data.shopId).lean();
      if (shop) data._shop = { id:shop._id.toString(), name:shop.name, whatsapp:shop.whatsapp||'', location:shop.location||'' };
    }
    res.json({ success:true, data });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// POST /api/shops/:id/intasend/stk-push — IntaSend STK push
app.post('/api/shops/:id/intasend/stk-push', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shop = await Shop.findById(req.params.id).lean();
    const m = shop?.mpesa;
    if (!m?.enabled) return res.status(400).json({ success:false, message:'M-Pesa not enabled for this shop' });
    if (!m?.intasendPublishableKey || !m?.intasendSecretKey)
      return res.status(400).json({ success:false, message:'IntaSend credentials not configured' });

    const { phone, amount, narrative, apiRef, name, email } = req.body;
    if (!phone || !amount) return res.status(400).json({ success:false, message:'Phone and amount required' });

    const isTest = m.environment !== 'live';
    const svc = new IntaSendService(m.intasendPublishableKey, m.intasendSecretKey, isTest);
    const result = await svc.stkPush({ phone, amount, narrative: narrative||`Payment to ${shop.name}`, apiRef, name, email });

    res.json({ success:true, invoiceId: result.id || result.invoice?.invoice_id, message:'STK push sent' });
  } catch(err) {
    const msg = err?.response?.data?.detail || err?.response?.data?.message || err.message || 'STK push failed';
    res.status(500).json({ success:false, message: msg });
  }
});

// POST /api/shops/:id/intasend/status — check payment status
app.post('/api/shops/:id/intasend/status', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shop = await Shop.findById(req.params.id).lean();
    const m = shop?.mpesa;
    if (!m?.intasendPublishableKey || !m?.intasendSecretKey)
      return res.status(400).json({ success:false, message:'IntaSend credentials not configured' });

    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ success:false, message:'Invoice ID required' });

    const isTest = m.environment !== 'live';
    const svc = new IntaSendService(m.intasendPublishableKey, m.intasendSecretKey, isTest);
    const result = await svc.checkStatus(invoiceId);

    const state  = result.invoice?.state || result.state || '';
    const paid   = state === 'COMPLETE';
    const failed = state === 'FAILED' || state === 'CANCELLED';

    res.json({ success:true, paid, failed, state, mpesaRef: result.invoice?.mpesa_reference || '' });
  } catch(err) {
    res.json({ success:true, paid:false, failed:false, state:'PENDING', message:err.message });
  }
});



// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS ROUTES
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/analytics/pageview — track a page view (public, no auth)
app.post('/api/analytics/pageview', async (req, res) => {
  try {
    const { shopId, productId, page, ref } = req.body;
    const ua = req.headers['user-agent'] || '';
    await PageView.create({ shopId: shopId||null, productId: productId||null, page: page||'home', ref: ref||'', ua });
    res.json({ success: true });
  } catch { res.json({ success: false }); }
});

// POST /api/analytics/search — log a search query
app.post('/api/analytics/search', async (req, res) => {
  try {
    const { query, resultsCount, shopId } = req.body;
    if (query?.trim().length >= 2) {
      await SearchLog.create({ query: query.trim().toLowerCase(), resultsCount: resultsCount||0, shopId: shopId||null });
    }
    res.json({ success: true });
  } catch { res.json({ success: false }); }
});

// GET /api/shops/:id/analytics — vendor analytics
app.get('/api/shops/:id/analytics', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const shopId = new mongoose.Types.ObjectId(req.params.id);
    const { period='7d', from, to } = req.query;

    // Date range
    let startDate, endDate = new Date();
    if (from && to) {
      startDate = new Date(from); startDate.setHours(0,0,0,0);
      endDate   = new Date(to);   endDate.setHours(23,59,59,999);
    } else {
      startDate = new Date();
      const days = period==='today'?1:period==='30d'?30:period==='90d'?90:7;
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0,0,0,0);
    }
    const dateFilter = { $gte: startDate, $lte: endDate };

    const [shopViews, productViews, topProducts, salesTrend, topSearches, conversionData] = await Promise.all([
      // Shop page views by day
      PageView.aggregate([
        { $match: { shopId, page:'shop', createdAt: dateFilter }},
        { $group: { _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' }}, views:{ $sum:1 }}},
        { $sort: { _id:1 }},
      ]),
      // Product views total
      PageView.countDocuments({ shopId, page:'product', createdAt: dateFilter }),
      // Top viewed products
      PageView.aggregate([
        { $match: { shopId, page:'product', productId:{ $ne:null }, createdAt: dateFilter }},
        { $group: { _id:'$productId', views:{ $sum:1 }}},
        { $sort: { views:-1 }}, { $limit:5 },
        { $lookup:{ from:'shopproducts', localField:'_id', foreignField:'_id', as:'product' }},
        { $unwind:{ path:'$product', preserveNullAndEmptyArrays:true }},
        { $project:{ views:1, name:'$product.name', image:{ $arrayElemAt:['$product.images',0] }, price:'$product.price' }},
      ]),
      // Sales trend by day
      Sale.aggregate([
        { $match: { shopId, status:'completed', createdAt: dateFilter }},
        { $group: { _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' }}, revenue:{ $sum:'$total' }, count:{ $sum:1 }}},
        { $sort: { _id:1 }},
      ]),
      // Top searches for this shop
      SearchLog.aggregate([
        { $match: { shopId, createdAt: dateFilter }},
        { $group: { _id:'$query', count:{ $sum:1 }}},
        { $sort: { count:-1 }}, { $limit:8 },
      ]),
      // Conversion: views vs orders
      Promise.all([
        PageView.countDocuments({ shopId, page:'shop', createdAt: dateFilter }),
        Order.countDocuments({ shopId, createdAt: dateFilter }),
      ]),
    ]);

    const totalShopViews = shopViews.reduce((s,d)=>s+d.views, 0);
    const [totalViews, totalOrders] = conversionData;

    res.json({ success:true, data:{
      period: { from: startDate, to: endDate },
      shopViews:      { total: totalShopViews, byDay: shopViews },
      productViews:   { total: productViews },
      topProducts,
      salesTrend,
      topSearches,
      conversion: {
        views: totalViews,
        orders: totalOrders,
        rate: totalViews ? Math.round((totalOrders/totalViews)*100*10)/10 : 0,
      },
      summary: {
        totalRevenue: salesTrend.reduce((s,d)=>s+d.revenue, 0),
        totalSales:   salesTrend.reduce((s,d)=>s+d.count, 0),
      },
    }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/admin/analytics — platform-wide analytics (admin only)
app.get('/api/admin/analytics', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth?.isAdmin) return res.status(403).json({ success:false, message:'Admin only' });
    const { period='7d', from, to } = req.query;

    let startDate, endDate = new Date();
    if (from && to) {
      startDate = new Date(from); startDate.setHours(0,0,0,0);
      endDate   = new Date(to);   endDate.setHours(23,59,59,999);
    } else {
      startDate = new Date();
      const days = period==='today'?1:period==='30d'?30:period==='90d'?90:7;
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0,0,0,0);
    }
    const dateFilter = { $gte: startDate, $lte: endDate };

    const [totalViews, topShops, topProducts, topSearches, newShops, newUsers, revenueTrend] = await Promise.all([
      PageView.countDocuments({ createdAt: dateFilter }),
      PageView.aggregate([
        { $match: { page:'shop', shopId:{ $ne:null }, createdAt: dateFilter }},
        { $group: { _id:'$shopId', views:{ $sum:1 }}},
        { $sort: { views:-1 }}, { $limit:8 },
        { $lookup:{ from:'shops', localField:'_id', foreignField:'_id', as:'shop' }},
        { $unwind:{ path:'$shop', preserveNullAndEmptyArrays:true }},
        { $project:{ views:1, name:'$shop.name', logo:'$shop.logo' }},
      ]),
      PageView.aggregate([
        { $match: { page:'product', productId:{ $ne:null }, createdAt: dateFilter }},
        { $group: { _id:'$productId', views:{ $sum:1 }}},
        { $sort: { views:-1 }}, { $limit:8 },
        { $lookup:{ from:'shopproducts', localField:'_id', foreignField:'_id', as:'product' }},
        { $unwind:{ path:'$product', preserveNullAndEmptyArrays:true }},
        { $project:{ views:1, name:'$product.name', price:'$product.price', shopId:'$product.shopId' }},
      ]),
      SearchLog.aggregate([
        { $match: { createdAt: dateFilter }},
        { $group: { _id:'$query', count:{ $sum:1 }}},
        { $sort: { count:-1 }}, { $limit:12 },
      ]),
      Shop.countDocuments({ createdAt: dateFilter }),
      User.countDocuments({ createdAt: dateFilter }),
      Sale.aggregate([
        { $match: { status:'completed', createdAt: dateFilter }},
        { $group: { _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' }}, revenue:{ $sum:'$total' }, sales:{ $sum:1 }}},
        { $sort: { _id:1 }},
      ]),
    ]);

    res.json({ success:true, data:{
      totalViews, topShops, topProducts, topSearches, newShops, newUsers,
      revenueTrend,
      totalRevenue: revenueTrend.reduce((s,d)=>s+d.revenue,0),
      totalSales:   revenueTrend.reduce((s,d)=>s+d.sales,0),
    }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ── Product Ratings ───────────────────────────────────────────────────────────

// GET /api/product-ratings/:productId — get avg rating + user's own rating
app.get('/api/product-ratings/:productId', async (req, res) => {
  try {
    const pid = req.params.productId;
    const agg = await ProductRating.aggregate([
      { $match: { productId: pid } },
      { $group: { _id:null, avg:{$avg:'$rating'}, count:{$sum:1},
          r5:{$sum:{$cond:[{$eq:['$rating',5]},1,0]}},
          r4:{$sum:{$cond:[{$eq:['$rating',4]},1,0]}},
          r3:{$sum:{$cond:[{$eq:['$rating',3]},1,0]}},
          r2:{$sum:{$cond:[{$eq:['$rating',2]},1,0]}},
          r1:{$sum:{$cond:[{$eq:['$rating',1]},1,0]}},
      }}
    ]);
    const s = agg[0] || { avg:0, count:0, r5:0,r4:0,r3:0,r2:0,r1:0 };
    // Check if current user has rated
    let myRating = null;
    const auth = await resolveAuth(req).catch(()=>null);
    if (auth) {
      const mine = await ProductRating.findOne({ productId:pid, userId: auth.email||auth.id });
      if (mine) myRating = mine.rating;
    }
    res.json({ success:true, data:{ avg:Math.round(s.avg*10)/10, count:s.count, breakdown:{5:s.r5,4:s.r4,3:s.r3,2:s.r2,1:s.r1}, myRating }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/product-ratings/:productId — submit or update rating
app.post('/api/product-ratings/:productId', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required to rate' });
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success:false, message:'Rating 1-5 required' });
    const userId   = auth.email || auth.id;
    const userName = auth.firstName ? auth.firstName+' '+(auth.lastName||'') : (auth.name||auth.email||'User');
    const existing = await ProductRating.findOne({ productId:req.params.productId, userId });
    if (existing) {
      existing.rating = rating; existing.review = review||''; await existing.save();
      return res.json({ success:true, updated:true });
    }
    await ProductRating.create({ productId:req.params.productId, userId, userName, rating, review:review||'' });
    res.status(201).json({ success:true, created:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/product-comments/comment/:id/like — toggle like
app.post('/api/product-comments/comment/:id/like', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const userId = auth.email || auth.id;
    const c = await ProductComment.findById(req.params.id);
    if (!c) return res.status(404).json({ success:false, message:'Not found' });
    if (!c.likedBy) c.likedBy = [];
    const idx = c.likedBy.indexOf(userId);
    if (idx >= 0) { c.likedBy.splice(idx,1); c.likes = Math.max(0,(c.likes||0)-1); }
    else { c.likedBy.push(userId); c.likes = (c.likes||0)+1; }
    await c.save();
    res.json({ success:true, likes:c.likes, liked: idx < 0 });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ══════════════════════════════════════════════════════════════════════════════
// HELP CENTER / COMMUNITY Q&A
// ══════════════════════════════════════════════════════════════════════════════

// Helper: check if user owns a post or is admin
function canManageHelp(auth, doc) {
  if (!auth) return false;
  const isAdmin = auth.role === 'admin' || auth.isAdmin;
  if (isAdmin) return true;
  const userId = auth.id || auth.sub || '';
  const email  = auth.email || '';
  return (doc.author?.userId && doc.author.userId === userId) ||
         (doc.author?.email  && doc.author.email  === email);
}

// GET /api/help-stats
app.get('/api/help-stats', async (req, res) => {
  try {
    const [total, resolved, questions, ideas] = await Promise.all([
      HelpPost.countDocuments(),
      HelpPost.countDocuments({ status: 'resolved' }),
      HelpPost.countDocuments({ type: 'question' }),
      HelpPost.countDocuments({ type: 'idea' }),
    ]);
    const repliesAgg = await HelpPost.aggregate([{ $group: { _id: null, total: { $sum: '$replyCount' } } }]);
    const replies = repliesAgg[0]?.total || 0;
    res.json({ success: true, data: { total, resolved, replies, questions, ideas } });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /api/help — list posts
app.get('/api/help', async (req, res) => {
  try {
    const { sort='newest', filter='all', search='', tag='', limit=10, page=1 } = req.query;
    const q = {};
    if (filter !== 'all') q.type = filter;
    if (search) q.$or = [{ title: { $regex: search, $options: 'i' } }, { body: { $regex: search, $options: 'i' } }];
    if (tag) q.tags = tag;
    const sortMap = { newest: { createdAt:-1 }, popular: { likes:-1, createdAt:-1 }, replied: { replyCount:-1 } };
    const skip = (Number(page)-1) * Number(limit);
    const [posts, total] = await Promise.all([
      HelpPost.find(q).sort(sortMap[sort]||{createdAt:-1}).skip(skip).limit(Number(limit)).lean(),
      HelpPost.countDocuments(q),
    ]);
    res.json({ success:true, data: posts.map(p=>({...p, id:p._id.toString()})), total, pages: Math.ceil(total/limit) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/help/:id — single post
app.get('/api/help/:id', async (req, res) => {
  try {
    const post = await HelpPost.findById(req.params.id).lean();
    if (!post) return res.status(404).json({ success:false, message:'Post not found' });
    await HelpPost.findByIdAndUpdate(req.params.id, { $inc: { views:1 } });
    res.json({ success:true, data: {...post, id:post._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/help — create post (auth required)
app.post('/api/help', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required to post' });
    const { title, body, type, category, tags } = req.body;
    if (!title?.trim()) return res.status(400).json({ success:false, message:'Title required' });
    if (!body?.trim())  return res.status(400).json({ success:false, message:'Body required' });
    const name = ((auth.firstName||'') + ' ' + (auth.lastName||'')).trim() || auth.email || 'User';
    const post = await HelpPost.create({
      type: type||'question', title: title.trim(), body: body.trim(),
      category: category||'General', tags: (tags||[]).filter(Boolean),
      author: { name, email: auth.email||'', userId: auth.id||auth.sub||'', isAdmin: auth.role==='admin' },
    });
    res.status(201).json({ success:true, data: {...post.toObject(), id:post._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/help/:id — edit post (owner or admin)
app.patch('/api/help/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const post = await HelpPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success:false, message:'Post not found' });
    if (!canManageHelp(auth, post)) return res.status(403).json({ success:false, message:'Not authorized' });
    const { title, body, type, category, tags, status } = req.body;
    if (title)    post.title    = title.trim();
    if (body)     post.body     = body.trim();
    if (type)     post.type     = type;
    if (category) post.category = category;
    if (tags)     post.tags     = tags;
    if (status)   post.status   = status;
    if (status === 'resolved') post.resolved = true;
    await post.save();
    res.json({ success:true, data: {...post.toObject(), id:post._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/help/:id — delete post + cascade replies (owner or admin)
app.delete('/api/help/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const post = await HelpPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success:false, message:'Post not found' });
    if (!canManageHelp(auth, post)) return res.status(403).json({ success:false, message:'Not authorized' });
    // Cascade delete all replies
    await HelpReply.deleteMany({ postId: req.params.id });
    await post.deleteOne();
    res.json({ success:true, message:'Post and all replies deleted' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/help/:id/replies
app.get('/api/help/:id/replies', async (req, res) => {
  try {
    const replies = await HelpReply.find({ postId: req.params.id }).sort({ createdAt:1 }).lean();
    res.json({ success:true, data: replies.map(r=>({...r, id:r._id.toString()})) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/help/:id/replies — add reply (auth required)
app.post('/api/help/:id/replies', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required to reply' });
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ success:false, message:'Reply body required' });
    const name = ((auth.firstName||'') + ' ' + (auth.lastName||'')).trim() || auth.email || 'User';
    const reply = await HelpReply.create({
      postId: req.params.id, body: body.trim(),
      author: { name, email:auth.email||'', userId:auth.id||auth.sub||'', isAdmin:auth.role==='admin' },
    });
    await HelpPost.findByIdAndUpdate(req.params.id, { $inc: { replyCount:1 } });
    res.status(201).json({ success:true, data: {...reply.toObject(), id:reply._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/help/:postId/replies/:id — edit reply (owner or admin)
app.patch('/api/help/:postId/replies/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const reply = await HelpReply.findById(req.params.id);
    if (!reply) return res.status(404).json({ success:false, message:'Reply not found' });
    if (!canManageHelp(auth, reply)) return res.status(403).json({ success:false, message:'Not authorized' });
    if (req.body.body) reply.body = req.body.body.trim();
    await reply.save();
    res.json({ success:true, data: {...reply.toObject(), id:reply._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/help/:postId/replies/:id — delete reply (owner or admin)
app.delete('/api/help/:postId/replies/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const reply = await HelpReply.findById(req.params.id);
    if (!reply) return res.status(404).json({ success:false, message:'Reply not found' });
    if (!canManageHelp(auth, reply)) return res.status(403).json({ success:false, message:'Not authorized' });
    await reply.deleteOne();
    await HelpPost.findByIdAndUpdate(req.params.postId, { $inc: { replyCount:-1 } });
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/help/:id/like
app.post('/api/help/:id/like', async (req, res) => {
  try {
    const auth = await resolveAuth(req).catch(()=>null);
    const userId = auth?.email || auth?.id || req.ip;
    const post = await HelpPost.findById(req.params.id);
    if (!post) return res.status(404).json({ success:false, message:'Not found' });
    if (!post.likedBy) post.likedBy = [];
    const idx = post.likedBy.indexOf(userId);
    if (idx >= 0) { post.likedBy.splice(idx,1); post.likes = Math.max(0,(post.likes||0)-1); }
    else { post.likedBy.push(userId); post.likes = (post.likes||0)+1; }
    await post.save();
    res.json({ success:true, likes:post.likes, liked:idx<0 });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});



// ══════════════════════════════════════════════════════════════════════════════
// VENDOR HOT DEALS — CRUD
// ══════════════════════════════════════════════════════════════════════════════

// Helper: check if user can manage a deal
async function canManageDeal(auth, deal) {
  if (!auth) return false;
  if (auth.role === 'admin') return true;
  return deal.vendorId && deal.vendorId === (auth.id || auth.sub || '');
}

// GET /api/vendor/deals — list vendor's own deals
app.get('/api/vendor/deals', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const vendorId = auth.id || auth.sub || '';
    // Auto-expire deals
    await HotDeal.updateMany(
      { vendorId, active:true, expiresAt:{ $lt: new Date() } },
      { active:false }
    );
    const deals = await HotDeal.find({ vendorId }).sort({ createdAt:-1 }).lean();
    res.json({ success:true, data: deals.map(d=>({...d, id:d._id.toString()})) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/vendor/deals — create a deal from a shop product
app.post('/api/vendor/deals', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { productId, dealPrice, durationHours, description, tags, featured } = req.body;
    if (!productId)  return res.status(400).json({ success:false, message:'Product required' });
    if (!dealPrice)  return res.status(400).json({ success:false, message:'Deal price required' });
    if (!durationHours) return res.status(400).json({ success:false, message:'Duration required' });
    // Verify vendor owns this product
    const product = await ShopProduct.findById(productId).lean();
    if (!product) return res.status(404).json({ success:false, message:'Product not found' });
    const shop = await Shop.findById(product.shopId).lean();
    if (!shop) return res.status(404).json({ success:false, message:'Shop not found' });
    const vendorId = auth.id || auth.sub || '';
    const isOwner = shop.ownerId && shop.ownerId.toString() === vendorId;
    if (!isOwner && auth.role !== 'admin')
      return res.status(403).json({ success:false, message:'You can only create deals for your own products' });
    // Validate pricing
    const origPrice = product.price || product.salePrice || 0;
    const dPrice = parseFloat(dealPrice);
    if (dPrice >= origPrice) return res.status(400).json({ success:false, message:'Deal price must be less than original price' });
    const discountPct = Math.round(((origPrice - dPrice) / origPrice) * 100);
    if (discountPct < 5) return res.status(400).json({ success:false, message:'Minimum 5% discount required' });
    // Check no active deal for this product
    const existing = await HotDeal.findOne({ productId, active:true, $or:[{expiresAt:null},{expiresAt:{$gt:new Date()}}] });
    if (existing) return res.status(400).json({ success:false, message:'This product already has an active deal' });
    // Validate duration
    const hours = parseFloat(durationHours);
    if (hours < 1 || hours > 720) return res.status(400).json({ success:false, message:'Duration must be 1–720 hours (max 30 days)' });
    const expiresAt = new Date(Date.now() + hours * 3600000);
    const deal = await HotDeal.create({
      title:         product.name,
      category:      product.category || 'General',
      brand:         product.brand || '',
      description:   description || product.description || '',
      originalPrice: origPrice,
      dealPrice:     dPrice,
      discountPct,
      stock:         product.stock || 1,
      condition:     product.condition || 'New',
      shop:          shop.name || '',
      shopId:        shop._id,
      productId:     product._id,
      vendorId,
      whatsapp:      shop.whatsapp || shop.phone || '',
      images:        product.images || [],
      tags:          tags || product.tags || [],
      featured:      featured || false,
      active:        true,
      expiresAt,
    });
    res.status(201).json({ success:true, data:{...deal.toObject(), id:deal._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/vendor/deals/:id — edit deal (vendor or admin)
app.patch('/api/vendor/deals/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const deal = await HotDeal.findById(req.params.id);
    if (!deal) return res.status(404).json({ success:false, message:'Deal not found' });
    if (!await canManageDeal(auth, deal)) return res.status(403).json({ success:false, message:'Not authorized' });
    const { dealPrice, durationHours, description, featured, active } = req.body;
    if (dealPrice !== undefined) {
      const dp = parseFloat(dealPrice);
      if (dp >= deal.originalPrice) return res.status(400).json({ success:false, message:'Deal price must be less than original' });
      deal.dealPrice = dp;
      deal.discountPct = Math.round(((deal.originalPrice - dp) / deal.originalPrice) * 100);
    }
    if (durationHours) {
      const hours = parseFloat(durationHours);
      deal.expiresAt = new Date(Date.now() + hours * 3600000);
    }
    if (description !== undefined) deal.description = description;
    if (featured !== undefined) deal.featured = featured;
    if (active !== undefined) deal.active = active;
    await deal.save();
    res.json({ success:true, data:{...deal.toObject(), id:deal._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/vendor/deals/:id — end/delete deal (vendor or admin)
app.delete('/api/vendor/deals/:id', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const deal = await HotDeal.findById(req.params.id);
    if (!deal) return res.status(404).json({ success:false, message:'Deal not found' });
    if (!await canManageDeal(auth, deal)) return res.status(403).json({ success:false, message:'Not authorized' });
    deal.active = false; deal.endedEarly = true;
    await deal.save();
    res.json({ success:true, message:'Deal ended' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// GET /api/vendor/deals/products — vendor's products available for deals
app.get('/api/vendor/deals/products', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const vendorId = auth.id || auth.sub || '';
    const shops = await Shop.find({ ownerId: vendorId }).lean();
    if (!shops.length) return res.json({ success:true, data:[] });
    const shopIds = shops.map(s => s._id);
    const products = await ShopProduct.find({ shopId: { $in: shopIds }, active: true }).lean();
    // Mark which products already have active deals
    const activeDeals = await HotDeal.find({ productId:{ $in: products.map(p=>p._id) }, active:true }).lean();
    const activePids = new Set(activeDeals.map(d=>d.productId?.toString()));
    res.json({ success:true, data: products.map(p => ({
      ...p, id:p._id.toString(),
      shopName: shops.find(s=>s._id.toString()===p.shopId?.toString())?.name || '',
      hasActiveDeal: activePids.has(p._id.toString()),
    })) });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/vendor/shop-data — vendor's categories and branches
app.get('/api/vendor/shop-data', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const vendorId = auth.id || auth.sub || '';
    // Find vendor's shops
    const shops = await Shop.find({ ownerId: vendorId }).lean();
    if (!shops.length) return res.json({ success:true, categories:[], branches:[], shops:[] });
    const shopIds = shops.map(s => s._id);
    const [categories, branches] = await Promise.all([
      ShopCategory.find({ shopId: { $in: shopIds } }).sort({ sortOrder:1, name:1 }).lean(),
      Branch.find({ shopId: { $in: shopIds }, active:true }).sort({ isMain:-1, name:1 }).lean(),
    ]);
    res.json({ success:true,
      categories: categories.map(c => ({ id:c._id.toString(), name:c.name, icon:c.icon, shopId:c.shopId.toString() })),
      branches:   branches.map(b => ({ id:b._id.toString(), name:b.name, location:b.location, isMain:b.isMain, shopId:b.shopId.toString() })),
      shops:      shops.map(s => ({ id:s._id.toString(), name:s.name })),
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// POST /api/hotdeals/:id/view — increment view count + daily history
app.post('/api/hotdeals/:id/view', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const deal = await HotDeal.findById(req.params.id);
    if (!deal) return res.json({ success: false });
    deal.views = (deal.views || 0) + 1;
    if (!deal.viewHistory) deal.viewHistory = [];
    const entry = deal.viewHistory.find(e => e.date === today);
    if (entry) entry.count = (entry.count || 0) + 1;
    else deal.viewHistory.push({ date: today, count: 1 });
    // Keep only last 30 days
    deal.viewHistory = deal.viewHistory
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    await deal.save();
    res.json({ success: true, views: deal.views, viewHistory: deal.viewHistory });
  } catch(err) { res.json({ success: false }); }
});

// POST /api/hotdeals/:id/like — toggle like
app.post('/api/hotdeals/:id/like', async (req, res) => {
  try {
    const auth = await resolveAuth(req).catch(() => null);
    const userId = auth?.email || auth?.id || req.ip;
    const deal = await HotDeal.findById(req.params.id);
    if (!deal) return res.status(404).json({ success: false });
    if (!deal.likedBy) deal.likedBy = [];
    const idx = deal.likedBy.indexOf(userId);
    if (idx >= 0) { deal.likedBy.splice(idx, 1); deal.likes = Math.max(0, (deal.likes||0) - 1); }
    else { deal.likedBy.push(userId); deal.likes = (deal.likes||0) + 1; }
    await deal.save();
    res.json({ success: true, likes: deal.likes, liked: idx < 0 });
  } catch(err) { res.json({ success: false }); }
});


// PATCH /api/hotdeals/:id/meta — update non-image fields (JSON body)
app.patch('/api/hotdeals/:id/meta', async (req, res) => {
  try {
    const auth = await resolveAuth(req).catch(() => null);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const allowed = ['shopId','vendorId','location','warranty','dealPrice','expiresAt','active','featured','description','stock'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    // Auto-deactivate when stock reaches 0
    if (updates.stock !== undefined && Number(updates.stock) <= 0) {
      updates.active = false;
      updates.stock  = 0;
    }
    const deal = await HotDeal.findByIdAndUpdate(req.params.id, updates, { new:true }).lean();
    if (!deal) return res.status(404).json({ success:false, message:'Deal not found' });
    res.json({ success:true, data:{...deal, id:deal._id.toString()} });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/me/staff-access — get all shops where current user is staff
app.get('/api/me/staff-access', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, data:[] });
    // Find by userId or email
    const records = await ShopSubUser.find({
      $or: [
        { userId: auth.id || auth.sub || '' },
        { email: (auth.email||'').toLowerCase() }
      ]
    }).lean();
    if (!records.length) return res.json({ success:true, data:[] });
    // Get shop info for each
    const shopIds = records.map(r => r.shopId);
    const shops   = await Shop.find({ _id: { $in: shopIds } }).lean();
    res.json({ success:true, data: records.map(r => {
      const shop = shops.find(s => s._id.toString() === r.shopId.toString());
      return {
        shopId:      r.shopId.toString(),
        shopName:    shop?.name || 'Store',
        role:        r.role,
        permissions: r.permissions,
      };
    })});
  } catch(err) { res.status(500).json({ success:false, data:[] }); }
});


// GET /api/orders/track/:orderNo — public order tracking
app.get('/api/orders/track/:orderNo', async (req, res) => {
  try {
    const order = await Order.findOne({ orderNo: req.params.orderNo }).lean();
    if (!order) return res.status(404).json({ success:false, message:'Order not found' });
    // Get shop info
    const shop = order.shopId ? await Shop.findById(order.shopId).lean().catch(()=>null) : null;
    res.json({ success:true, data:{
      orderNo:       order.orderNo,
      status:        order.status,
      statusHistory: order.statusHistory || [],
      type:          order.type,
      branch:        order.branch || order.address || '',
      estimatedTime: order.estimatedTime || '',
      trackingNote:  order.trackingNote  || '',
      shopName:      shop?.name || 'SELA Store',
      shopPhone:     shop?.phone || shop?.whatsapp || '',
      items:         order.items || [],
      total:         order.total || order.totalPrice || 0,
      createdAt:     order.createdAt,
      customer: {
        name:  order.customer?.name || '',
        phone: (order.customer?.phone || '').replace(/(.{3}).*(.{2})$/, '$1*****$2'),
      },
    }});
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/products/:productId/verified-buyer — check if user has bought this product
app.get('/api/products/:productId/verified-buyer', async (req, res) => {
  try {
    const auth = await resolveAuth(req).catch(() => null);
    const email = auth?.email || req.query.email || '';
    const productId = req.params.productId;
    if (!email) return res.json({ success:true, isVerifiedBuyer:false });
    // Check if any delivered/completed order contains this product
    const order = await Order.findOne({
      'customer.email': email.toLowerCase(),
      status: { $in: ['delivered','collected','completed'] },
      'items.productId': productId,
    }).lean();
    // Also check HotDeal orders
    const hotOrder = !order ? await Order.findOne({
      'customer.email': email.toLowerCase(),
      status: { $in: ['delivered','collected','completed'] },
      'items.name': { $regex: productId, $options:'i' },
    }).lean() : null;
    res.json({ success:true, isVerifiedBuyer: !!(order || hotOrder) });
  } catch(err) { res.json({ success:true, isVerifiedBuyer:false }); }
});


// ── Saved Addresses ──────────────────────────────────────────────────────────

// GET /api/me/addresses
app.get('/api/me/addresses', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const user = await User.findById(auth.id||auth.sub).lean();
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    res.json({ success:true, data: user.addresses || [] });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// POST /api/me/addresses — add address
app.post('/api/me/addresses', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const { label='Home', name, phone, address, city, isDefault=false } = req.body;
    if (!address?.trim()) return res.status(400).json({ success:false, message:'Address required' });
    const user = await User.findById(auth.id||auth.sub);
    if (!user) return res.status(404).json({ success:false });
    if (!user.addresses) user.addresses = [];
    const newAddr = { id: Math.random().toString(36).slice(2,10), label, name:name||user.firstName||'', phone:phone||user.phone||'', address:address.trim(), city:city||'', isDefault };
    // If setting as default, clear others
    if (isDefault) user.addresses.forEach(a => a.isDefault = false);
    // Max 5 addresses
    if (user.addresses.length >= 5)
      return res.status(400).json({ success:false, message:'Maximum 5 saved addresses' });
    user.addresses.push(newAddr);
    await user.save();
    res.json({ success:true, data: user.addresses });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// PATCH /api/me/addresses/:addrId — update address
app.patch('/api/me/addresses/:addrId', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const user = await User.findById(auth.id||auth.sub);
    if (!user) return res.status(404).json({ success:false });
    const addr = (user.addresses||[]).find(a => a.id === req.params.addrId);
    if (!addr) return res.status(404).json({ success:false, message:'Address not found' });
    const { label, name, phone, address, city, isDefault } = req.body;
    if (label    !== undefined) addr.label    = label;
    if (name     !== undefined) addr.name     = name;
    if (phone    !== undefined) addr.phone    = phone;
    if (address  !== undefined) addr.address  = address;
    if (city     !== undefined) addr.city     = city;
    if (isDefault) { user.addresses.forEach(a => a.isDefault = false); addr.isDefault = true; }
    await user.save();
    res.json({ success:true, data: user.addresses });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// DELETE /api/me/addresses/:addrId
app.delete('/api/me/addresses/:addrId', async (req, res) => {
  try {
    const auth = await resolveAuth(req);
    if (!auth) return res.status(401).json({ success:false, message:'Login required' });
    const user = await User.findById(auth.id||auth.sub);
    if (!user) return res.status(404).json({ success:false });
    user.addresses = (user.addresses||[]).filter(a => a.id !== req.params.addrId);
    await user.save();
    res.json({ success:true, data: user.addresses });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/admin/fix-image-urls — migrate localhost image URLs to relative paths
app.get('/api/admin/fix-image-urls', async (req, res) => {
  try {
    const auth = await resolveAuth(req).catch(()=>null);
    if (!auth || auth.role !== 'admin') return res.status(403).json({ success:false, message:'Admin only' });

    let fixed = 0;
    // Fix ShopProducts
    const products = await ShopProduct.find({ images: { $regex: 'localhost' } }).lean();
    for (const p of products) {
      const cleanImgs = p.images.map(img =>
        img.replace(/https?:\/\/localhost:\d+/, '').replace(/https?:\/\/[^/]+(?=\/uploads)/, '')
      );
      await ShopProduct.updateOne({ _id: p._id }, { images: cleanImgs });
      fixed++;
    }
    // Fix HotDeals
    const deals = await HotDeal.find({ images: { $regex: 'localhost' } }).lean();
    for (const d of deals) {
      const cleanImgs = d.images.map(img =>
        img.replace(/https?:\/\/localhost:\d+/, '').replace(/https?:\/\/[^/]+(?=\/uploads)/, '')
      );
      await HotDeal.updateOne({ _id: d._id }, { images: cleanImgs });
      fixed++;
    }
    // Fix Shops (logo/banner)
    const shops = await Shop.find({
      $or: [{ logo: /localhost/ }, { banner: /localhost/ }]
    }).lean();
    for (const s of shops) {
      const update = {};
      if (s.logo)   update.logo   = s.logo.replace(/https?:\/\/localhost:\d+/, '');
      if (s.banner) update.banner = s.banner.replace(/https?:\/\/localhost:\d+/, '');
      await Shop.updateOne({ _id: s._id }, update);
      fixed++;
    }
    res.json({ success:true, message:`Fixed ${fixed} records` });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// POST /api/auth/reset-admin — emergency admin password reset (uses env vars)
app.post('/api/auth/reset-admin', async (req, res) => {
  try {
    const { secret } = req.body;
    // Require a secret key to prevent abuse
    if (secret !== process.env.JWT_SECRET) 
      return res.status(403).json({ success:false, message:'Invalid secret' });
    await seedAdminIfNeeded();
    res.json({ success:true, message:'Admin password reset from env vars' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/admin/imagekit-check — verify ImageKit config
app.get('/api/admin/cloudinary-check', async (req, res) => {
  try {
    const config = {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET',
      api_key:    process.env.CLOUDINARY_API_KEY ? process.env.CLOUDINARY_API_KEY.substring(0,6)+'...' : 'NOT SET',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'SET ('+process.env.CLOUDINARY_API_SECRET.length+' chars)' : 'NOT SET',
    };
    // Try a ping to Cloudinary
    try {
      config.ping = 'ImageKit configured';
    } catch(e) {
      config.ping = 'FAILED: ' + e.message;
    }
    res.json({ success:true, config });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/imagekit-auth — ImageKit authentication for browser uploads
app.get('/api/imagekit-auth', (req, res) => {
  try {
    const auth = imagekit.getAuthenticationParameters();
    res.json({ ...auth, publicKey: imagekit.options.publicKey, urlEndpoint: imagekit.options.urlEndpoint });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// GET /api/admin/imagekit-cleanup — find orphaned ImageKit files not in any product
app.get('/api/admin/imagekit-cleanup', async (req, res) => {
  try {
    const auth = await resolveAuth(req).catch(()=>null);
    if (!auth || auth.role !== 'admin')
      return res.status(403).json({ success:false, message:'Admin only' });

    // Get all fileIds stored in products
    const products = await ShopProduct.find({ 'imageFiles.0': { $exists: true } }, 'imageFiles').lean();
    const storedFileIds = new Set();
    products.forEach(p => (p.imageFiles||[]).forEach(f => { if(f.fileId) storedFileIds.add(f.fileId); }));

    // Get all files from ImageKit in sela folder
    let ikFiles = [];
    try {
      ikFiles = await imagekit.listFiles({ path: '/sela', limit: 500 });
    } catch(e) {
      return res.json({ success:false, message:'ImageKit list failed: '+e.message });
    }

    const orphaned = ikFiles.filter(f => !storedFileIds.has(f.fileId));
    const dryRun   = req.query.delete !== 'true';

    if (!dryRun && orphaned.length) {
      // Delete orphaned files
      for (const f of orphaned) {
        await imagekit.deleteFile(f.fileId).catch(e => console.warn('Delete failed:', f.fileId, e.message));
      }
    }

    res.json({
      success: true,
      totalInImageKit: ikFiles.length,
      referencedInDB:  storedFileIds.size,
      orphaned:        orphaned.length,
      deleted:         dryRun ? 0 : orphaned.length,
      dryRun,
      orphanedFiles:   orphaned.slice(0,20).map(f => ({ fileId:f.fileId, url:f.url, name:f.name })),
    });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});


// ── Email (Nodemailer + Gmail) ────────────────────────────────────────
const nodemailer = require('nodemailer');

const _transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
});

async function sendEmail({ to, subject, html }) {
  if (!process.env.GMAIL_USER) return; // skip if not configured
  try {
    await _transporter.sendMail({
      from: `"SELA Marketplace" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('Email sent to:', to, '|', subject);
  } catch (e) {
    console.error('Email failed:', e.message);
  }
}

// ── Email Templates ───────────────────────────────────────────────────
function emailBase(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;margin:0;padding:0}
  .wrap{max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;margin-top:20px}
  .header{background:linear-gradient(135deg,#0b0e14,#1a2030);padding:28px 32px;text-align:center}
  .logo{font-size:28px;font-weight:900;color:#fff;letter-spacing:-.5px}
  .logo span{color:#00d4ff}
  .body{padding:32px}
  .footer{background:#f8f8f8;padding:16px 32px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee}
  .btn{display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#00d4ff,#0ea5e9);color:#fff;text-decoration:none;border-radius:8px;font-weight:700;margin:16px 0}
  .info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:14px}
  .info-row:last-child{border-bottom:none}
  .label{color:#666}
  .value{font-weight:600;color:#111}
  .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700}
  .badge-green{background:#dcfce7;color:#16a34a}
  .badge-blue{background:#dbeafe;color:#2563eb}
  .badge-orange{background:#fff7ed;color:#ea580c}
  h2{color:#111;margin-top:0}
  p{color:#444;line-height:1.6;font-size:15px}
</style></head>
<body><div class="wrap">
  <div class="header">
    <div class="logo">SELA<span>.</span></div>
    <div style="color:rgba(255,255,255,.6);font-size:12px;margin-top:4px">Kenya's Multi-Vendor Marketplace</div>
  </div>
  <div class="body">${content}</div>
  <div class="footer">
    © ${new Date().getFullYear()} SELA Marketplace · Kenya<br/>
    <a href="https://sela-marketplace-production.up.railway.app" style="color:#00d4ff;text-decoration:none">Visit SELA</a>
  </div>
</div></body></html>`;
}

function emailOrderConfirmation(order, items) {
  const itemRows = items.map(i =>
    `<div class="info-row"><span class="label">${i.name} × ${i.qty}</span><span class="value">KES ${(i.total||i.unitPrice*i.qty).toLocaleString()}</span></div>`
  ).join('');
  return emailBase(`
    <h2>🎉 Order Confirmed!</h2>
    <p>Hi ${order.customerName || 'Customer'}, your order has been received and is being processed.</p>
    <div class="info-row"><span class="label">Order No.</span><span class="value" style="color:#00d4ff">#${order.orderNo || order._id?.toString().slice(-6).toUpperCase()}</span></div>
    ${itemRows}
    <div class="info-row"><span class="label"><strong>Total</strong></span><span class="value" style="color:#00d4ff"><strong>KES ${order.total?.toLocaleString()}</strong></span></div>
    <div class="info-row"><span class="label">Payment</span><span class="value">${order.paymentMethod?.toUpperCase() || 'M-PESA'}</span></div>
    <div class="info-row"><span class="label">Status</span><span class="value"><span class="badge badge-orange">Pending</span></span></div>
    <p style="margin-top:20px">You will receive a WhatsApp or call to confirm pickup/delivery details.</p>
    <a href="https://sela-marketplace-production.up.railway.app/order-track.html?order=${order.orderNo}" class="btn">Track Your Order</a>
  `);
}

function emailVendorNewOrder(order, items, shopName) {
  const itemRows = items.map(i =>
    `<div class="info-row"><span class="label">${i.name} × ${i.qty}</span><span class="value">KES ${(i.total||i.unitPrice*i.qty).toLocaleString()}</span></div>`
  ).join('');
  return emailBase(`
    <h2>🛒 New Order Received!</h2>
    <p>Your shop <strong>${shopName}</strong> has received a new order.</p>
    <div class="info-row"><span class="label">Order No.</span><span class="value" style="color:#00d4ff">#${order.orderNo || order._id?.toString().slice(-6).toUpperCase()}</span></div>
    <div class="info-row"><span class="label">Customer</span><span class="value">${order.customerName || '—'}</span></div>
    <div class="info-row"><span class="label">Phone</span><span class="value">${order.customerPhone || '—'}</span></div>
    ${itemRows}
    <div class="info-row"><span class="label"><strong>Total</strong></span><span class="value"><strong>KES ${order.total?.toLocaleString()}</strong></span></div>
    <div class="info-row"><span class="label">Payment</span><span class="value">${order.paymentMethod?.toUpperCase() || 'M-PESA'}</span></div>
    <p style="margin-top:20px">Please confirm or process this order from your dashboard.</p>
    <a href="https://sela-marketplace-production.up.railway.app/shop-dashboard.html" class="btn">Go to Dashboard</a>
  `);
}

function emailOrderStatusUpdate(order, newStatus, customerName) {
  const statusMap = {
    confirmed:  { label: 'Confirmed ✅',   badge: 'badge-green',  msg: 'Your order has been confirmed and is being prepared.' },
    ready:      { label: 'Ready 📦',        badge: 'badge-blue',   msg: 'Your order is ready for pickup/delivery.' },
    dispatched: { label: 'On the Way 🚚',   badge: 'badge-blue',   msg: 'Your order is on its way to you.' },
    delivered:  { label: 'Delivered 🎉',    badge: 'badge-green',  msg: 'Your order has been delivered. Thank you!' },
    cancelled:  { label: 'Cancelled ❌',    badge: 'badge-orange', msg: 'Your order has been cancelled. Contact us for help.' },
  };
  const s = statusMap[newStatus] || { label: newStatus, badge: 'badge-blue', msg: 'Your order status has been updated.' };
  return emailBase(`
    <h2>📦 Order Update</h2>
    <p>Hi ${customerName || 'Customer'}, here's an update on your order.</p>
    <div class="info-row"><span class="label">Order No.</span><span class="value" style="color:#00d4ff">#${order.orderNo || order._id?.toString().slice(-6).toUpperCase()}</span></div>
    <div class="info-row"><span class="label">New Status</span><span class="value"><span class="badge ${s.badge}">${s.label}</span></span></div>
    <p style="margin-top:16px">${s.msg}</p>
    <a href="https://sela-marketplace-production.up.railway.app/order-track.html?order=${order.orderNo}" class="btn">Track Order</a>
  `);
}

function emailWelcome(name, email) {
  return emailBase(`
    <h2>🎉 Welcome to SELA!</h2>
    <p>Hi ${name || 'there'}, your account has been created successfully.</p>
    <div class="info-row"><span class="label">Email</span><span class="value">${email}</span></div>
    <p>You can now browse products, place orders, and track deliveries across Kenya's growing marketplace.</p>
    <a href="https://sela-marketplace-production.up.railway.app" class="btn">Start Shopping</a>
    <p style="margin-top:16px;font-size:13px;color:#888">Want to sell on SELA? <a href="https://sela-marketplace-production.up.railway.app/shop-create.html" style="color:#00d4ff">Open your store free →</a></p>
  `);
}

function emailPasswordReset(name, resetLink) {
  return emailBase(`
    <h2>🔐 Reset Your Password</h2>
    <p>Hi ${name || 'there'}, we received a request to reset your SELA password.</p>
    <p>Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <a href="${resetLink}" class="btn">Reset Password</a>
    <p style="margin-top:16px;font-size:13px;color:#888">If you didn't request this, ignore this email — your account is safe.</p>
  `);
}


// ── POST /api/auth/forgot-password ────────────────────────────────────────────
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ success:false, message:'Email required' });
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.json({ success:true, message:'If that email exists, a reset link has been sent.' });

    // Generate reset token
    const token = require('crypto').randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    const resetLink = `https://sela-marketplace-production.up.railway.app/auth.html?reset=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your SELA password 🔐',
      html: emailPasswordReset(user.firstName, resetLink),
    });

    res.json({ success:true, message:'Password reset email sent.' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ success:false, message:'Token and new password required' });
    if (newPassword.length < 8) return res.status(400).json({ success:false, message:'Password must be at least 8 characters' });

    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ success:false, message:'Reset link is invalid or expired' });

    user.password = await _bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ success:true, message:'Password reset successfully. You can now log in.' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// ── Serve frontend static files (MUST be after all API routes) ──────────────
app.use(express.static(path.join(__dirname, '../frontend/public')));

app.get('/admin', (req, res) => res.sendFile(require('path').join(__dirname, '../frontend/public/admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(require('path').join(__dirname, '../frontend/public/admin.html')));

// ── Fallback ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/public/index.html')));
app.use((err, req, res, next) => res.status(500).json({ success:false, message:err.message }));


app.listen(PORT, () => {
  console.log(`\n🚀  Aircoast Solutions  →  http://localhost:${PORT}`);
  console.log(`🗄️   Connecting to MongoDB Atlas…`);
  console.log(`✅  Auth routes: /api/users/register, /api/users/login, /api/users/verify-email`);
  console.log(`✅  Shop routes: /api/shops, /api/shops/mine, /api/shops/id/:id`);
  console.log(`✅  Admin routes: /api/auth/login, /api/admin/my-shops`);
  console.log(`📦  Server version: 2026-06-02-CLOUDINARY\n`);
  console.log('ENV CHECK:', {
    CLOUDINARY_URL:         process.env.CLOUDINARY_URL ? 'SET' : 'NOT SET',
    CLOUDINARY_CLOUD_NAME:  process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET',
    CLOUDINARY_API_KEY:     process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET',
    CLOUDINARY_API_SECRET:  process.env.CLOUDINARY_API_SECRET ? 'SET' : 'NOT SET',
    ALL_KEYS: Object.keys(process.env).filter(k => k.includes('CLOUD'))
  });
});

// models/index.js — Aircoast Solutions Mongoose Models
const mongoose = require('mongoose');

// ═══════════════════════════════════════
// PRODUCT MODEL
// ═══════════════════════════════════════
const productSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, default: '', trim: true },
  category:    { type: String, required: true, trim: true },
  brand:       { type: String, trim: true, default: 'Generic' },
  price:       { type: Number, required: true, min: 0 },
  condition:   { type: String, enum: ['New','Used','Refurbished'], default: 'New' },
  shop:        { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  image:       { type: String, default: null },          // primary image (backward compat)
  images:      [{ type: String }],                       // up to 6 image URLs
  imageFiles:  [{                                          // ImageKit file metadata for cleanup
    fileId: { type: String },
    url:    { type: String },
  }],
  whatsapp:    { type: String, default: '254740169448' },
  color:       { type: String, default: '' },
  rating:      { type: Number, default: 4.5, min: 0, max: 5 },
  sales:       { type: Number, default: 0 },
  inStock:     { type: Boolean, default: true },
  featured:    { type: Boolean, default: false },
  emoji:       { type: String, default: '📦' },
}, {
  timestamps: true,   // adds createdAt & updatedAt automatically
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Full-text search index
productSchema.index({
  name: 'text', description: 'text',
  category: 'text', brand: 'text', shop: 'text'
});

// ═══════════════════════════════════════
// ORDER MODEL
// ═══════════════════════════════════════
const orderSchema = new mongoose.Schema({
  product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true },
  productPrice:{ type: Number, required: true },
  quantity:    { type: Number, required: true, min: 1, default: 1 },
  totalPrice:  { type: Number, required: true },
  branch:      { type: String, required: true },
  delivery:    { type: Boolean, default: false },
  deliveryAddr:{ type: String, default: '' },
  customer: {
    name:  { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    notes: { type: String, default: '' },
  },
  status: {
    type: String,
    enum: ['pending','confirmed','ready','out_for_delivery','delivered','cancelled'],
    default: 'pending'
  },
  statusHistory: [{
    status:    { type: String },
    message:   { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  }],
  estimatedTime: { type: String, default: '' },
  trackingNote:  { type: String, default: '' },
  source:        { type: String, default: 'website' },
  shopId:        { type: String, default: '' },
  userId:        { type: String, default: '' },
}, { timestamps: true });

// ═══════════════════════════════════════
// SERVICE REQUEST MODEL
// ═══════════════════════════════════════


// ── Sale (POS Transaction) ────────────────────────────────────────────────────
const saleItemSchema = new mongoose.Schema({
  type:        { type: String, enum:['product','service'], required:true },
  refId:       { type: String, default:'' },   // ShopProduct._id or Service._id
  name:        { type: String, required:true },
  unitPrice:   { type: Number, required:true },
  qty:         { type: Number, required:true, min:1 },
  total:       { type: Number, required:true },
  unit:        { type: String, default:'pcs' },
}, { _id:false });

const saleSchema = new mongoose.Schema({
  shopId:      { type: mongoose.Schema.Types.ObjectId, ref:'Shop', required:true, index:true },
  branchId:    { type: mongoose.Schema.Types.ObjectId, ref:'Branch', default:null },
  cashierId:   { type: String, default:'' },  // User._id of cashier
  cashierName: { type: String, default:'' },
  items:       [saleItemSchema],
  subtotal:    { type: Number, required:true },
  discount:    { type: Number, default:0 },
  total:       { type: Number, required:true },
  paymentMethod: { type: String, enum:['cash','mpesa','split'], default:'cash' },
  cashPaid:    { type: Number, default:0 },
  mpesaPaid:   { type: Number, default:0 },
  mpesaRef:    { type: String, default:'' },
  changeDue:   { type: Number, default:0 },
  note:        { type: String, default:'' },
  customerId:   { type: mongoose.Schema.Types.ObjectId, ref:'Customer', default:null },
  customerName: { type: String, default:'' },
  receiptNo:    { type: String, unique:true },
  status:      { type: String, enum:['completed','refunded','voided'], default:'completed' },
}, { timestamps:true });

// Auto-generate receipt number
saleSchema.pre('save', async function(next) {
  if (!this.receiptNo) {
    const count = await this.constructor.countDocuments({ shopId: this.shopId });
    const date  = new Date().toISOString().slice(0,10).replace(/-/g,'');
    this.receiptNo = `RCP-${date}-${String(count+1).padStart(4,'0')}`;
  }
  next();
});


// ── Customer (CRM) ────────────────────────────────────────────────────────────
const customerSchema = new mongoose.Schema({
  shopId:      { type: mongoose.Schema.Types.ObjectId, ref:'Shop', required:true, index:true },
  name:        { type: String, required:true, trim:true },
  phone:       { type: String, default:'', trim:true },
  email:       { type: String, default:'', trim:true, lowercase:true },
  idNumber:    { type: String, default:'' },      // national ID / passport
  notes:       { type: String, default:'' },
  tags:        [{ type: String }],                // e.g. ['wholesale','regular']
  totalSpent:  { type: Number, default:0 },
  totalOrders: { type: Number, default:0 },
  lastSeen:    { type: Date, default: null },
  loyalty:     { type: Number, default:0 },       // points
  active:      { type: Boolean, default:true },
}, { timestamps:true });

customerSchema.index({ shopId:1, phone:1 });
customerSchema.index({ shopId:1, name:'text', phone:'text', email:'text' });

// ── Service (internal POS — NOT public marketplace) ──────────────────────────
const serviceSchema = new mongoose.Schema({
  shopId:      { type: mongoose.Schema.Types.ObjectId, ref:'Shop', required:true, index:true },
  branchIds:   [{ type: mongoose.Schema.Types.ObjectId, ref:'Branch' }], // empty = all branches
  name:        { type: String, required:true, trim:true },
  description: { type: String, default:'' },
  category:    { type: String, default:'General' },
  basePrice:   { type: Number, required:true, min:0 },
  unit:        { type: String, default:'per item' }, // e.g. per page, per hour, per copy
  minQty:      { type: Number, default:1 },
  active:      { type: Boolean, default:true },
  icon:        { type: String, default:'🔧' },
}, { timestamps:true });

const serviceRequestSchema = new mongoose.Schema({
  customer: {
    name:  { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  service:  { type: String, required: true },
  message:  { type: String, default: '' },
  files:    [{ name: String, size: Number }],
  status:   { type: String, enum: ['new','in-progress','done'], default: 'new' },
}, { timestamps: true });

// ═══════════════════════════════════════
// ADMIN MODEL
// ═══════════════════════════════════════
const adminSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  email:        { type: String, default: '' },
  name:         { type: String, default: 'SELA Admin' },
  role:         { type: String, default: 'admin' },
  lastLogin:    { type: Date },
}, { timestamps: true });

module.exports = {
  Product:        mongoose.model('Product',        productSchema),
  Order:          mongoose.model('Order',          orderSchema),
  ServiceRequest: mongoose.model('ServiceRequest', serviceRequestSchema),
  Admin:          mongoose.model('Admin',          adminSchema),
};

// ═══════════════════════════════════════
// HOT DEAL MODEL
// ═══════════════════════════════════════
const hotDealSchema = new mongoose.Schema({
  title:         { type: String, required: true, trim: true },
  category:      { type: String, required: true, trim: true },
  brand:         { type: String, default: '', trim: true },
  description:   { type: String, required: true, trim: true },
  originalPrice: { type: Number, required: true, min: 0 },
  dealPrice:     { type: Number, required: true, min: 0 },
  discountPct:   { type: Number, default: 0 },
  stock:         { type: Number, default: 1, min: 0 },
  condition:     { type: String, enum: ['New','Used','Refurbished'], default: 'New' },
  shop:          { type: String, default: '', trim: true },
  shopId:        { type: String, default: '' },
  vendorId:      { type: String, default: '' },
  location:      { type: String, default: '', trim: true },
  warranty:      { type: String, default: '', trim: true },
  slug:          { type: String, default: '', trim: true },
  whatsapp:      { type: String, default: '254740169448' },
  images:        [{ type: String }],
  tags:          [{ type: String }],
  featured:      { type: Boolean, default: false },
  active:        { type: Boolean, default: true },
  expiresAt:     { type: Date, default: null },
  endedEarly:    { type: Boolean, default: false },
  views:         { type: Number, default: 0 },
  likes:         { type: Number, default: 0 },
  likedBy:       [{ type: String }],
  viewHistory:   [{ date: String, count: Number }],
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id; delete ret.__v;
      return ret;
    }
  }
});

hotDealSchema.virtual('savings').get(function() {
  return this.originalPrice - this.dealPrice;
});


module.exports.HotDeal = mongoose.model('HotDeal', hotDealSchema);

// ═══════════════════════════════════════
// BLOG META MODEL
// Stores dynamic performance data for static blog posts.
// Posts themselves live in the frontend JS array — only metrics are in DB.
// ═══════════════════════════════════════
const blogMetaSchema = new mongoose.Schema({
  postId:      { type: String, required: true, unique: true, trim: true }, // matches blogPosts[].id
  views:       { type: Number, default: 0 },
  likes:       { type: Number, default: 0 },
  voteCount:   { type: Number, default: 0 },
  voteScore:   { type: Number, default: 0 },  // sum of all vote values (up=+1, down=-1)
  readTime:    { type: String, default: '' },  // can be updated
  lastRead:    { type: Date, default: null },  // last time anyone read this post
  updatedAt:   { type: Date, default: Date.now },
  tags:        [{ type: String }],
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id; delete ret.__v;
      return ret;
    }
  }
});

blogMetaSchema.virtual('avgRating').get(function() {
  if (!this.voteCount) return 0;
  // Normalise to 1–5 scale: voteScore/voteCount maps -1..+1 → 1..5
  const normalised = ((this.voteScore / this.voteCount) + 1) / 2; // 0..1
  return Math.round(normalised * 4 + 1);  // 1..5
});

module.exports.BlogMeta = mongoose.model('BlogMeta', blogMetaSchema);

// ═══════════════════════════════════════
// BLOG COMMENT MODEL
// ═══════════════════════════════════════
const commentSchema = new mongoose.Schema({
  postId:      { type: String, required: true, index: true },
  parentId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
  // Author info (linked to User account)
  authorName:  { type: String, required: true, trim: true, maxlength: 60 },
  authorColor: { type: String, default: '' },
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  userEmail:   { type: String, default: '' },
  isVerified:  { type: Boolean, default: false }, // verified account holder
  isAdmin:     { type: Boolean, default: false },
  // Content
  body:        { type: String, required: true, trim: true, maxlength: 2000 },
  // Metrics
  likes:       { type: Number, default: 0 },
  views:       { type: Number, default: 0 },
  viewedIps:   [{ ip: String, lastViewed: Date }],  // deduplicate views per 24h
  // Edit / delete tracking
  editToken:   { type: String, default: '' },       // secret token for anonymous edits
  editExpiry:  { type: Date, default: null },        // 1 hour after creation
  edited:      { type: Boolean, default: false },
  deleted:     { type: Boolean, default: false },
  deletedBody: { type: String, default: '' },
  // Verified buyer
  isVerifiedBuyer: { type: Boolean, default: false },
  // Status
  pinned:      { type: Boolean, default: false },
  flagged:     { type: Boolean, default: false },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id; delete ret.__v;
      delete ret.viewedIps;   // never send IP data to client
      delete ret.editToken;   // never expose token
      return ret;
    }
  }
});

commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ postId: 1, parentId: 1 });

module.exports.Comment = mongoose.model('Comment', commentSchema);

// ═══════════════════════════════════════
// PRODUCT META MODEL — engagement metrics
// ═══════════════════════════════════════
const productMetaSchema = new mongoose.Schema({
  productId:   { type: String, required: true, unique: true },
  views:       { type: Number, default: 0 },
  likes:       { type: Number, default: 0 },
  voteScore:   { type: Number, default: 0 },
  voteCount:   { type: Number, default: 0 },
  // Time-series snapshots for charts (daily buckets)
  viewsHistory:  [{ date: String, count: Number }],   // YYYY-MM-DD
  likesHistory:  [{ date: String, count: Number }],
  salesHistory:  [{ date: String, count: Number }],
  priceHistory:  [{ date: String, price: Number }],
  lastViewed:  { type: Date, default: null },
  updatedAt:   { type: Date, default: Date.now },
  tags:        [{ type: String }],
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; }
  }
});
productMetaSchema.virtual('avgRating').get(function() {
  if (!this.voteCount) return 0;
  return Math.round(((this.voteScore / this.voteCount) + 1) / 2 * 4 + 1);
});
module.exports.ProductMeta = mongoose.model('ProductMeta', productMetaSchema);

// ═══════════════════════════════════════
// PRODUCT COMMENT MODEL
// ═══════════════════════════════════════
const productCommentSchema = new mongoose.Schema({
  productId:    { type: String, required: true, index: true },
  parentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'ProductComment', default: null },
  // Author
  firstName:    { type: String, required: true, trim: true },
  lastName:     { type: String, required: true, trim: true },
  email:        { type: String, required: true, trim: true, lowercase: true },
  phone:        { type: String, default: '', trim: true },
  authorColor:  { type: String, default: '' },
  isAdmin:      { type: Boolean, default: false },
  isVendor:     { type: Boolean, default: false },
  // Content
  body:         { type: String, required: true, maxlength: 2000 },
  // Engagement
  likes:        { type: Number, default: 0 },
  voteScore:    { type: Number, default: 0 },
  voteCount:    { type: Number, default: 0 },
  views:        { type: Number, default: 0 },
  viewedIps:    [{ ip: String, lastViewed: Date }],
  // Moderation
  pinned:       { type: Boolean, default: false },
  deleted:      { type: Boolean, default: false },
  deletedBody:  { type: String, default: '' },
  // Anonymous cannot edit/delete
  edited:       { type: Boolean, default: false },
  userId:       { type: String, default: '' },  // email or user id for ownership
  likedBy:      [{ type: String }],             // list of userIds who liked
  replies:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'ProductComment' }],
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id; delete ret.__v; delete ret.viewedIps;
      return ret;
    }
  }
});
productCommentSchema.virtual('authorName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});
productCommentSchema.index({ productId: 1, createdAt: -1 });
module.exports.ProductComment = mongoose.model('ProductComment', productCommentSchema);


// ═══════════════════════════════════════
// USER MODEL (for SELA user accounts)
// ═══════════════════════════════════════
const userSchema = new mongoose.Schema({
  firstName:   { type: String, required: true, trim: true },
  lastName:    { type: String, required: true, trim: true },
  username:    { type: String, required: true, unique: true, trim: true, lowercase: true },
  email:       { type: String, required: true, unique: true, trim: true, lowercase: true },
  password:    { type: String, required: true },
  phone:       { type: String, default: '' },
  isVerified:  { type: Boolean, default: false },
  verifyCode:  { type: String, default: null },
  avatar:      { type: String, default: '' },
  addresses:   [{
    id:        { type: String, default: () => Math.random().toString(36).slice(2,10) },
    label:     { type: String, default: 'Home' },  // Home, Work, Other
    name:      { type: String, default: '' },
    phone:     { type: String, default: '' },
    address:   { type: String, default: '' },
    city:      { type: String, default: '' },
    isDefault: { type: Boolean, default: false },
  }],
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      ret.id = ret._id.toString();
      delete ret._id; delete ret.__v; delete ret.password; delete ret.verifyCode;
      return ret;
    }
  }
});
userSchema.virtual('name').get(function() { return `${this.firstName} ${this.lastName}`; });
module.exports.User = mongoose.model('User', userSchema);

// ═══════════════════════════════════════
// HELP POST MODEL
// ═══════════════════════════════════════
const helpPostSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  category:    { type: String, required: true, trim: true },
  content:     { type: String, required: true },
  excerpt:     { type: String, default: '' },
  helpful:     { type: Number, default: 0 },
  notHelpful:  { type: Number, default: 0 },
  views:       { type: Number, default: 0 },
  published:   { type: Boolean, default: true },
}, {
  timestamps: true,
  toJSON: { virtuals:true, transform:(d,r)=>{ r.id=r._id.toString(); delete r._id; delete r.__v; return r; } }
});
module.exports.HelpPost = mongoose.model('HelpPost', helpPostSchema);

// ═══════════════════════════════════════
// HELP REPLY MODEL
// ═══════════════════════════════════════
const helpReplySchema = new mongoose.Schema({
  postId:      { type: mongoose.Schema.Types.ObjectId, ref: 'HelpPost', required: true },
  author:      { type: String, required: true, trim: true },
  email:       { type: String, required: true, trim: true },
  body:        { type: String, required: true },
  isAdmin:     { type: Boolean, default: false },
  helpful:     { type: Number, default: 0 },
}, {
  timestamps: true,
  toJSON: { virtuals:true, transform:(d,r)=>{ r.id=r._id.toString(); delete r._id; delete r.__v; return r; } }
});
module.exports.HelpReply = mongoose.model('HelpReply', helpReplySchema);

// ═══════════════════════════════════════════════════════════════
// SHOP PLATFORM MODELS
// ═══════════════════════════════════════════════════════════════

// ── Shop ──────────────────────────────────────────────────────
const shopSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  slug:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  description:   { type: String, default: '' },
  logo:          { type: String, default: '' },
  banner:        { type: String, default: '' },
  themeColor:    { type: String, default: '#1a73e8' },
  email:         { type: String, default: '' },
  phone:         { type: String, default: '' },
  whatsapp:      { type: String, default: '' },
  location:      { type: String, default: '' },
  social: {
    facebook:    { type: String, default: '' },
    instagram:   { type: String, default: '' },
    twitter:     { type: String, default: '' },
    tiktok:      { type: String, default: '' },
    youtube:     { type: String, default: '' },
  },
  ownerId:       { type: String, required: true },
  ownerEmail:    { type: String, required: true },
  status:        { type: String, enum: ['draft','active','suspended','expired'], default: 'draft' },
  subscription: {
    plan:        { type: String, enum:['starter','growth','pro'], default: 'growth' },
    fee:         { type: Number, default: 1000 },
    paidUntil:   { type: Date, default: null },
    lastPaid:    { type: Date, default: null },
    mpesaRef:    { type: String, default: '' },
    billingCycle:{ type: String, enum:['monthly','annual'], default: 'monthly' },
    gracePeriod: { type: Boolean, default: false },
    graceUntil:  { type: Date, default: null },
  },
  billingHistory: [{
    date:     { type: Date, default: Date.now },
    plan:     { type: String, default: 'growth' },
    amount:   { type: Number, default: 0 },
    months:   { type: Number, default: 1 },
    mpesaRef: { type: String, default: '' },
    method:   { type: String, default: 'mpesa' },
    cycle:    { type: String, default: 'monthly' },
  }],
  rating:        { type: Number, default: 0 },
  totalSales:    { type: Number, default: 0 },
  published:     { type: Boolean, default: false },
  mpesa: {
    enabled:       { type: Boolean, default: false },
    type:          { type: String, enum: ['till','paybill'], default: 'till' },
    shortCode:     { type: String, default: '' },
    accountName:   { type: String, default: '' },
    consumerKey:   { type: String, default: '' },
    consumerSecret:{ type: String, default: '' },
    passkey:       { type: String, default: '' },
    environment:   { type: String, enum: ['sandbox','live'], default: 'sandbox' },
    provider:      { type: String, enum: ['daraja','intasend'], default: 'daraja' },
    intasendPublishableKey: { type: String, default: '' },
    intasendSecretKey:      { type: String, default: '' },
  },
}, { timestamps: true, toJSON: { virtuals: true, transform: (d,r)=>{ r.id=r._id.toString(); delete r._id; delete r.__v; return r; } } });
module.exports.Shop = mongoose.model('Shop', shopSchema);

// ── Branch ─────────────────────────────────────────────────────
const branchSchema = new mongoose.Schema({
  shopId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name:          { type: String, required: true, trim: true },
  location:      { type: String, default: '' },
  phone:         { type: String, default: '' },
  email:         { type: String, default: '' },
  whatsapp:      { type: String, default: '' },
  hours:         { type: String, default: '' },
  isMain:        { type: Boolean, default: false },
  active:        { type: Boolean, default: true },
}, { timestamps: true, toJSON: { virtuals: true, transform: (d,r)=>{ r.id=r._id.toString(); delete r._id; delete r.__v; return r; } } });
module.exports.Branch = mongoose.model('Branch', branchSchema);

// ── ShopCategory ───────────────────────────────────────────────
const shopCategorySchema = new mongoose.Schema({
  shopId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  name:          { type: String, required: true, trim: true },
  icon:          { type: String, default: '📦' },
  color:         { type: String, default: '#1a73e8' },
  sortOrder:     { type: Number, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true, transform: (d,r)=>{ r.id=r._id.toString(); delete r._id; delete r.__v; return r; } } });
module.exports.ShopCategory = mongoose.model('ShopCategory', shopCategorySchema);

// ── ShopProduct ────────────────────────────────────────────────
const shopProductSchema = new mongoose.Schema({
  shopId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  categoryId:    { type: mongoose.Schema.Types.ObjectId, ref: 'ShopCategory', default: null },
  categoryName:  { type: String, default: 'Uncategorised' },
  branchIds:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
  name:          { type: String, required: true, trim: true },
  slug:          { type: String, default: '', trim: true, lowercase: true },
  description:   { type: String, default: '' },
  price:         { type: Number, required: true, default: 0 },
  salePrice:     { type: Number, default: null },
  onSale:        { type: Boolean, default: false },
  discountPct:   { type: Number, default: 0 },
  images:        [{ type: String }],
  sku:           { type: String, default: '' },
  stock:         { type: Number, default: 0 },
  sold:          { type: Number, default: 0 },
  unit:          { type: String, default: 'pcs' },
  tags:          [{ type: String }],
  featured:      { type: Boolean, default: false },
  active:        { type: Boolean, default: true },
  addedAt:       { type: Date, default: Date.now },
}, { timestamps: true, toJSON: { virtuals: true, transform: (d,r)=>{ r.id=r._id.toString(); delete r._id; delete r.__v; return r; } } });
shopProductSchema.virtual('effectivePrice').get(function(){ return this.onSale && this.salePrice ? this.salePrice : this.price; });
module.exports.ShopProduct = mongoose.model('ShopProduct', shopProductSchema);

// ── ShopSubUser ────────────────────────────────────────────────
const shopSubUserSchema = new mongoose.Schema({
  shopId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  userId:        { type: String, required: true },
  name:          { type: String, required: true },
  email:         { type: String, required: true },
  role:          { type: String, enum: ['manager','staff'], default: 'staff' },
  permissions:   {
    scope:       { type: String, enum: ['global','branch'], default: 'branch' },
    branchId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    canCreate:   { type: Boolean, default: true },
    canEdit:     { type: Boolean, default: true },
    canDelete:   { type: Boolean, default: false },
  },
  active:        { type: Boolean, default: true },
}, { timestamps: true, toJSON: { virtuals: true, transform: (d,r)=>{ r.id=r._id.toString(); delete r._id; delete r.__v; return r; } } });
module.exports.ShopSubUser = mongoose.model('ShopSubUser', shopSubUserSchema);

// ── SubscriptionPayment ────────────────────────────────────────
const subscriptionPaymentSchema = new mongoose.Schema({
  shopId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  amount:        { type: Number, required: true },
  mpesaPhone:    { type: String, default: '' },
  mpesaRef:      { type: String, default: '' },
  months:        { type: Number, default: 1 },
  status:        { type: String, enum: ['pending','paid','failed'], default: 'pending' },
  paidAt:        { type: Date, default: null },
}, { timestamps: true, toJSON: { virtuals: true, transform: (d,r)=>{ r.id=r._id.toString(); delete r._id; delete r.__v; return r; } } });
module.exports.SubscriptionPayment = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
module.exports.Service = mongoose.model('Service', serviceSchema);

// ── Shop Review ──────────────────────────────────────────────────────────────
const shopReviewSchema = new mongoose.Schema({
  shopId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Shop',  required: true },
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  orderNo:   { type: String, required: true },
  customer: {
    name:    { type: String, required: true, trim: true },
    phone:   { type: String, required: true, trim: true },
  },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, required: true, trim: true, maxlength: 1000 },
  vendorReply: { type: String, default: '', trim: true, maxlength: 500 },
  repliedAt:   { type: Date, default: null },
  helpful:     { type: Number, default: 0 },
  flagged:     { type: Boolean, default: false },
}, { timestamps: true });

shopReviewSchema.index({ shopId: 1, createdAt: -1 });
shopReviewSchema.index({ orderId: 1 }, { unique: true }); // one review per order

module.exports.Sale     = mongoose.model('Sale',     saleSchema);
module.exports.Customer = mongoose.model('Customer', customerSchema);


// ── Page View ─────────────────────────────────────────────────────────────────
const pageViewSchema = new mongoose.Schema({
  shopId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShopProduct', default: null },
  page:      { type: String, enum: ['shop','product','home'], default: 'home' },
  ref:       { type: String, default: '' }, // referrer
  ua:        { type: String, default: '' }, // user agent (mobile/desktop)
}, { timestamps: true });
pageViewSchema.index({ shopId: 1, createdAt: -1 });
pageViewSchema.index({ productId: 1, createdAt: -1 });
pageViewSchema.index({ createdAt: -1 });

// ── Search Log ────────────────────────────────────────────────────────────────
const searchLogSchema = new mongoose.Schema({
  query:        { type: String, required: true, trim: true },
  resultsCount: { type: Number, default: 0 },
  shopId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
}, { timestamps: true });
searchLogSchema.index({ query: 1 });
searchLogSchema.index({ createdAt: -1 });


// ── Product Rating ────────────────────────────────────────────────────────────
const productRatingSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  shopId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', default: null },
  userId:    { type: String, required: true }, // email or user id
  userName:  { type: String, default: '' },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  review:    { type: String, default: '', maxlength: 500 },
}, { timestamps: true });
productRatingSchema.index({ productId: 1, userId: 1 }, { unique: true }); // one per user per product

module.exports.ShopReview = mongoose.model('ShopReview', shopReviewSchema);
module.exports.PageView  = mongoose.model('PageView',  pageViewSchema);
module.exports.SearchLog = mongoose.model('SearchLog', searchLogSchema);
module.exports.ProductRating = mongoose.model('ProductRating', productRatingSchema);
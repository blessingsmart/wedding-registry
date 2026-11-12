const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CONTRIBUTIONS_FILE = path.join(DATA_DIR, 'contributions.json');
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper functions for reading and writing data
function readJSON(file, defaultData = []) {
  try {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content || '[]');
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return defaultData;
  }
}

function writeJSON(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

// Multer storage for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, 'item-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Admin Auth Middleware
function checkAdminAuth(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.query.pin || req.body.adminPin;
  const settings = readJSON(SETTINGS_FILE, {});
  const expectedPin = settings.adminPin || '2026';

  if (pin && String(pin) === String(expectedPin)) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
}

/* =========================================================
   PUBLIC ROUTES
   ========================================================= */

// Get Settings (public info only)
app.get('/api/settings', (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  const publicSettings = {
    couple: settings.couple,
    bankTransfer: settings.bankTransfer,
    paystack: {
      enabled: Boolean(settings.paystack && settings.paystack.enabled),
      publicKey: (settings.paystack && settings.paystack.publicKey) || '',
      note: (settings.paystack && settings.paystack.note) || ''
    }
  };
  res.json({ success: true, settings: publicSettings });
});

// Get Registry Items
app.get('/api/items', (req, res) => {
  const items = readJSON(ITEMS_FILE, []);
  res.json({ success: true, items });
});

// Get Single Registry Item
app.get('/api/items/:id', (req, res) => {
  const items = readJSON(ITEMS_FILE, []);
  const item = items.find(i => String(i.id) === String(req.params.id));
  if (!item) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }
  res.json({ success: true, item });
});

// Create a Donation / Contribution Pledge
app.post('/api/contributions', (req, res) => {
  const { guestName, guestEmail, guestPhone, itemId, amount, paymentMethod, reference, message } = req.body;

  if (!guestName || !amount) {
    return res.status(400).json({ success: false, error: 'Name and amount are required' });
  }

  const items = readJSON(ITEMS_FILE, []);
  const item = items.find(i => String(i.id) === String(itemId));

  const contributions = readJSON(CONTRIBUTIONS_FILE, []);
  const newContrib = {
    id: 'contrib_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    date: new Date().toISOString(),
    guestName: guestName.trim(),
    guestEmail: (guestEmail || '').trim(),
    guestPhone: (guestPhone || '').trim(),
    itemId: itemId || 'cash_fund',
    itemTitle: item ? item.title : (itemId === 'plenty_cash' ? 'Plenty Cash' : 'Cash Gift Fund'),
    amount: parseFloat(amount) || 0,
    paymentMethod: paymentMethod || 'bank_transfer',
    reference: reference || 'CE-' + Math.floor(100000 + Math.random() * 900000),
    message: (message || '').trim(),
    status: 'pending', // 'pending' verification or 'verified'
    showInGuestbook: true
  };

  contributions.unshift(newContrib);
  writeJSON(CONTRIBUTIONS_FILE, contributions);

  // Update item raised amount
  if (item) {
    item.raised = (parseFloat(item.raised) || 0) + newContrib.amount;
    if (item.price > 0 && item.raised >= item.price) {
      item.status = 'completed';
    }
    writeJSON(ITEMS_FILE, items);
  }

  res.json({
    success: true,
    contribution: newContrib,
    message: 'Thank you for your generous gift and lovely message!'
  });
});

// Public Guestbook (congratulatory messages)
app.get('/api/guestbook', (req, res) => {
  const contributions = readJSON(CONTRIBUTIONS_FILE, []);
  const messages = contributions
    .filter(c => c.showInGuestbook && c.message && c.message.trim().length > 0)
    .map(c => ({
      id: c.id,
      guestName: c.guestName,
      message: c.message,
      date: c.date,
      itemTitle: c.itemTitle
    }));
  res.json({ success: true, messages });
});

/* =========================================================
   ADMIN ROUTES (Item editing, Settings, Verification)
   ========================================================= */

// Admin Verify PIN
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  const settings = readJSON(SETTINGS_FILE, {});
  const expectedPin = settings.adminPin || '2026';

  if (String(pin) === String(expectedPin)) {
    return res.json({ success: true, message: 'Authenticated successfully' });
  }
  return res.status(401).json({ success: false, error: 'Incorrect PIN' });
});

// Admin Get Full Settings
app.get('/api/admin/settings', checkAdminAuth, (req, res) => {
  const settings = readJSON(SETTINGS_FILE, {});
  res.json({ success: true, settings });
});

// Admin Update Settings (Bank details, Couple details, Paystack config, PIN)
app.put('/api/admin/settings', checkAdminAuth, (req, res) => {
  const currentSettings = readJSON(SETTINGS_FILE, {});
  const updatedSettings = {
    ...currentSettings,
    ...req.body
  };
  writeJSON(SETTINGS_FILE, updatedSettings);
  res.json({ success: true, settings: updatedSettings, message: 'Settings updated successfully' });
});

// Admin Add New Item
app.post('/api/items', checkAdminAuth, (req, res) => {
  const { title, category, price, isCashFund, allowPartial, image, description, featured } = req.body;

  if (!title) {
    return res.status(400).json({ success: false, error: 'Title is required' });
  }

  const items = readJSON(ITEMS_FILE, []);
  const newItem = {
    id: 'item_' + Date.now(),
    title: title.trim(),
    category: category || 'General',
    price: parseFloat(price) || 0,
    isCashFund: Boolean(isCashFund),
    raised: 0,
    allowPartial: allowPartial !== undefined ? Boolean(allowPartial) : true,
    image: image || '/images/cash.jpg',
    description: (description || '').trim(),
    status: 'available',
    featured: Boolean(featured)
  };

  items.push(newItem);
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item: newItem, message: 'Item added successfully' });
});

// Admin Edit Item
app.put('/api/items/:id', checkAdminAuth, (req, res) => {
  const items = readJSON(ITEMS_FILE, []);
  const idx = items.findIndex(i => String(i.id) === String(req.params.id));

  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  const existing = items[idx];
  const updatedItem = {
    ...existing,
    title: req.body.title !== undefined ? req.body.title.trim() : existing.title,
    category: req.body.category !== undefined ? req.body.category : existing.category,
    price: req.body.price !== undefined ? parseFloat(req.body.price) : existing.price,
    isCashFund: req.body.isCashFund !== undefined ? Boolean(req.body.isCashFund) : existing.isCashFund,
    allowPartial: req.body.allowPartial !== undefined ? Boolean(req.body.allowPartial) : existing.allowPartial,
    image: req.body.image !== undefined ? req.body.image : existing.image,
    description: req.body.description !== undefined ? req.body.description.trim() : existing.description,
    status: req.body.status !== undefined ? req.body.status : existing.status,
    raised: req.body.raised !== undefined ? parseFloat(req.body.raised) : existing.raised,
    featured: req.body.featured !== undefined ? Boolean(req.body.featured) : existing.featured
  };

  items[idx] = updatedItem;
  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, item: updatedItem, message: 'Item updated successfully' });
});

// Admin Delete Item
app.delete('/api/items/:id', checkAdminAuth, (req, res) => {
  let items = readJSON(ITEMS_FILE, []);
  const initialLength = items.length;
  items = items.filter(i => String(i.id) !== String(req.params.id));

  if (items.length === initialLength) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  writeJSON(ITEMS_FILE, items);
  res.json({ success: true, message: 'Item deleted successfully' });
});

// Admin Upload Image
app.post('/api/upload', checkAdminAuth, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded' });
  }
  const imageUrl = '/uploads/' + req.file.filename;
  res.json({ success: true, imageUrl });
});

// Admin Get All Contributions
app.get('/api/admin/contributions', checkAdminAuth, (req, res) => {
  const contributions = readJSON(CONTRIBUTIONS_FILE, []);
  res.json({ success: true, contributions });
});

// Admin Update Contribution Status (e.g., mark verified or toggle guestbook)
app.put('/api/admin/contributions/:id', checkAdminAuth, (req, res) => {
  const contributions = readJSON(CONTRIBUTIONS_FILE, []);
  const contrib = contributions.find(c => String(c.id) === String(req.params.id));

  if (!contrib) {
    return res.status(404).json({ success: false, error: 'Contribution not found' });
  }

  if (req.body.status !== undefined) contrib.status = req.body.status;
  if (req.body.showInGuestbook !== undefined) contrib.showInGuestbook = Boolean(req.body.showInGuestbook);

  writeJSON(CONTRIBUTIONS_FILE, contributions);
  res.json({ success: true, contribution: contrib, message: 'Contribution updated' });
});

// Admin Delete Contribution
app.delete('/api/admin/contributions/:id', checkAdminAuth, (req, res) => {
  let contributions = readJSON(CONTRIBUTIONS_FILE, []);
  contributions = contributions.filter(c => String(c.id) !== String(req.params.id));
  writeJSON(CONTRIBUTIONS_FILE, contributions);
  res.json({ success: true, message: 'Contribution removed' });
});

/* =========================================================
   PAYSTACK INTEGRATION READY STUBS
   ========================================================= */

// Paystack initialize stub (ready to plug secret key or use inline Paystack JS)
app.post('/api/paystack/initialize', async (req, res) => {
  const { email, amount, itemId, guestName } = req.body;
  const settings = readJSON(SETTINGS_FILE, {});

  if (!settings.paystack || !settings.paystack.enabled) {
    return res.status(400).json({
      success: false,
      error: 'Paystack is not currently enabled. Please use the direct Bank Transfer option.'
    });
  }

  // Generate reference
  const reference = 'PAYSTACK_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

  // Return public key & reference for client-side PaystackPop popup
  res.json({
    success: true,
    publicKey: settings.paystack.publicKey,
    reference: reference,
    amountInKobo: Math.round(amount * 100),
    email: email,
    metadata: {
      guestName,
      itemId
    }
  });
});

// Paystack verification stub
app.post('/api/paystack/verify/:reference', async (req, res) => {
  const { reference } = req.params;
  const settings = readJSON(SETTINGS_FILE, {});

  // When live, an HTTP request to https://api.paystack.co/transaction/verify/${reference}
  // with Authorization: Bearer ${settings.paystack.secretKey} validates payment instantly.
  res.json({
    success: true,
    status: 'success',
    reference: reference,
    message: 'Payment verified successfully'
  });
});

// Serve admin page on /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Wedding Registry Server running at http://localhost:${PORT}`);
  console.log(`Admin dashboard available at http://localhost:${PORT}/admin`);
});

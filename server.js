require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Upload directory
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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
async function checkAdminAuth(req, res, next) {
  try {
    const pin = req.headers['x-admin-pin'] || req.query.pin || req.body.adminPin;
    const settings = await db.getSettings();
    const expectedPin = settings.adminPin || '2026';

    if (pin && String(pin) === String(expectedPin)) {
      return next();
    }
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin PIN' });
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).json({ success: false, error: 'Authentication check error' });
  }
}

/* =========================================================
   PUBLIC ROUTES
   ========================================================= */

// Get Settings (public info only)
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
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
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Registry Items
app.get('/api/items', async (req, res) => {
  try {
    const items = await db.getItems();
    res.json({ success: true, items });
  } catch (err) {
    console.error('Error fetching items:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Single Registry Item
app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await db.getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, item });
  } catch (err) {
    console.error('Error fetching item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create a Donation / Contribution Pledge
app.post('/api/contributions', async (req, res) => {
  try {
    const { guestName, guestEmail, guestPhone, itemId, amount, paymentMethod, reference, message } = req.body;

    if (!guestName || !amount) {
      return res.status(400).json({ success: false, error: 'Name and amount are required' });
    }

    const item = itemId ? await db.getItemById(itemId) : null;

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

    await db.addContribution(newContrib);

    res.json({
      success: true,
      contribution: newContrib,
      message: 'Thank you for your generous gift and lovely message!'
    });
  } catch (err) {
    console.error('Error creating contribution:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public Guestbook (congratulatory messages)
app.get('/api/guestbook', async (req, res) => {
  try {
    const messages = await db.getGuestbookMessages();
    res.json({ success: true, messages });
  } catch (err) {
    console.error('Error fetching guestbook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   ADMIN ROUTES (Item editing, Settings, Verification)
   ========================================================= */

// Admin Verify PIN
app.post('/api/admin/login', async (req, res) => {
  try {
    const { pin } = req.body;
    const settings = await db.getSettings();
    const expectedPin = settings.adminPin || '2026';

    if (String(pin) === String(expectedPin)) {
      return res.json({ success: true, message: 'Authenticated successfully' });
    }
    return res.status(401).json({ success: false, error: 'Incorrect PIN' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Get Full Settings
app.get('/api/admin/settings', checkAdminAuth, async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Update Settings (Bank details, Couple details, Paystack config, PIN)
app.put('/api/admin/settings', checkAdminAuth, async (req, res) => {
  try {
    const currentSettings = await db.getSettings();
    const updatedSettings = {
      ...currentSettings,
      ...req.body
    };
    await db.saveSettings(updatedSettings);
    res.json({ success: true, settings: updatedSettings, message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Add New Item
app.post('/api/items', checkAdminAuth, async (req, res) => {
  try {
    const { title, category, price, isCashFund, allowPartial, image, description, featured } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required' });
    }

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

    await db.addItem(newItem);
    res.json({ success: true, item: newItem, message: 'Item added successfully' });
  } catch (err) {
    console.error('Error adding item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Edit Item
app.put('/api/items/:id', checkAdminAuth, async (req, res) => {
  try {
    const existing = await db.getItemById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }

    const updated = await db.updateItem(req.params.id, req.body);
    res.json({ success: true, item: updated, message: 'Item updated successfully' });
  } catch (err) {
    console.error('Error editing item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Delete Item
app.delete('/api/items/:id', checkAdminAuth, async (req, res) => {
  try {
    const ok = await db.deleteItem(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Item not found' });
    }
    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
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
app.get('/api/admin/contributions', checkAdminAuth, async (req, res) => {
  try {
    const contributions = await db.getContributions();
    res.json({ success: true, contributions });
  } catch (err) {
    console.error('Error fetching contributions:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Update Contribution Status (e.g., mark verified or toggle guestbook)
app.put('/api/admin/contributions/:id', checkAdminAuth, async (req, res) => {
  try {
    const contrib = await db.updateContribution(req.params.id, req.body);
    if (!contrib) {
      return res.status(404).json({ success: false, error: 'Contribution not found' });
    }
    res.json({ success: true, contribution: contrib, message: 'Contribution updated' });
  } catch (err) {
    console.error('Error updating contribution:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin Delete Contribution
app.delete('/api/admin/contributions/:id', checkAdminAuth, async (req, res) => {
  try {
    const ok = await db.deleteContribution(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Contribution not found' });
    }
    res.json({ success: true, message: 'Contribution removed' });
  } catch (err) {
    console.error('Error deleting contribution:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* =========================================================
   PAYSTACK INTEGRATION READY STUBS
   ========================================================= */

app.post('/api/paystack/initialize', async (req, res) => {
  try {
    const { email, amount, itemId, guestName } = req.body;
    const settings = await db.getSettings();

    if (!settings.paystack || !settings.paystack.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Paystack is not currently enabled. Please use the direct Bank Transfer option.'
      });
    }

    const reference = 'PAYSTACK_' + Date.now() + '_' + Math.floor(Math.random() * 10000);

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
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    res.json({
      success: true,
      status: 'success',
      reference: reference,
      message: 'Payment verified successfully'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
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
app.listen(PORT, async () => {
  console.log(`Wedding Registry Server running at http://localhost:${PORT}`);
  console.log(`Admin dashboard available at http://localhost:${PORT}/admin`);
  await db.initDb();
});

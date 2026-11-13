const fs = require('fs');
const path = require('path');

// Load environment variables (.env locally or /etc/secrets/.env on Render)
if (fs.existsSync(path.join(__dirname, '.env'))) {
  require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
}
if (fs.existsSync('/etc/secrets/.env')) {
  require('dotenv').config({ path: '/etc/secrets/.env', quiet: true });
}

// File paths for local JSON fallback
const DATA_DIR = path.join(__dirname, 'data');
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CONTRIBUTIONS_FILE = path.join(DATA_DIR, 'contributions.json');

// Helper functions for JSON fallback
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

/**
 * Flexible environment variable getter:
 * Checks direct key, alternate keys, and case-insensitive matches.
 * Also strips surrounding quotes and whitespace.
 */
function getEnvValue(...candidateKeys) {
  // 1. Direct match
  for (const key of candidateKeys) {
    if (process.env[key] !== undefined && process.env[key] !== '') {
      return String(process.env[key]).trim().replace(/^['"]|['"]$/g, '');
    }
  }

  // 2. Case-insensitive / normalized match (e.g. db_host, Db_Host, DBHOST)
  const envKeys = Object.keys(process.env);
  for (const key of candidateKeys) {
    const normTarget = key.toLowerCase().replace(/[-_]/g, '');
    const found = envKeys.find(k => k.toLowerCase().replace(/[-_]/g, '') === normTarget);
    if (found && process.env[found] !== undefined && process.env[found] !== '') {
      return String(process.env[found]).trim().replace(/^['"]|['"]$/g, '');
    }
  }

  return '';
}

let pool = null;
let isConnected = false;

/**
 * Initialize DB: Create tables and seed from JSON files if tables are empty.
 */
async function initDb() {
  const dbUrl = getEnvValue('DATABASE_URL', 'MYSQL_URL', 'JAWSDB_URL', 'CLEARDB_DATABASE_URL');
  const dbHost = getEnvValue('DB_HOST', 'MYSQL_HOST', 'DATABASE_HOST', 'DBHOST');
  const dbName = getEnvValue('DB_NAME', 'MYSQL_DATABASE', 'DATABASE_NAME', 'DBNAME');
  const dbUser = getEnvValue('DB_USER', 'MYSQL_USER', 'DATABASE_USER', 'DBUSER');
  const dbPass = getEnvValue('DB_PASSWORD', 'DB_PASS', 'MYSQL_PASSWORD', 'DATABASE_PASSWORD', 'DBPASSWORD');
  const dbPortStr = getEnvValue('DB_PORT', 'MYSQL_PORT', 'DATABASE_PORT', 'DBPORT');
  const dbPort = parseInt(dbPortStr, 10) || 3306;
  const dbSsl = getEnvValue('DB_SSL');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 Database Configuration Check:');
  if (dbUrl) {
    console.log('  - DATABASE_URL: Provided (will connect via URL)');
  } else {
    console.log('  - Host:    ', dbHost ? `"${dbHost}"` : '❌ NOT FOUND');
    console.log('  - Port:    ', dbPort);
    console.log('  - Database:', dbName ? `"${dbName}"` : '❌ NOT FOUND');
    console.log('  - User:    ', dbUser ? `"${dbUser}"` : '❌ NOT FOUND');
    console.log('  - Password:', dbPass ? '****** (provided)' : '❌ NOT PROVIDED');
  }

  const hasConfig = Boolean(dbUrl || (dbHost && dbName && dbUser));

  if (!hasConfig) {
    console.log('ℹ️ Using local JSON file storage (No database credentials found in environment).');
    console.log('👉 Tip for Render: In your Web Service -> "Environment" tab:');
    console.log('   Add: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
    console.log('   Make sure to click the blue "Save Changes" button at the bottom!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return false;
  }

  try {
    const mysql = require('mysql2/promise');

    const poolConfig = dbUrl
      ? {
          uri: dbUrl,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
          ssl: dbSsl === 'true' ? { rejectUnauthorized: false } : undefined
        }
      : {
          host: dbHost,
          port: dbPort,
          user: dbUser,
          password: dbPass,
          database: dbName,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000,
          ssl: dbSsl === 'true' ? { rejectUnauthorized: false } : undefined
        };

    pool = mysql.createPool(poolConfig);

    console.log(`🔌 Connecting to MySQL database at ${dbHost || dbUrl}:${dbPort}...`);
    const conn = await pool.getConnection();
    console.log(`✅ Successfully connected to Alwaysdata MySQL database (${dbName || 'connected'})!`);

    // 1. Settings Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id INT PRIMARY KEY,
        config LONGTEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Items Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS registry_items (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'General',
        price DECIMAL(14,2) DEFAULT 0,
        raised DECIMAL(14,2) DEFAULT 0,
        allowPartial TINYINT(1) DEFAULT 1,
        isCashFund TINYINT(1) DEFAULT 0,
        image TEXT,
        description TEXT,
        status VARCHAR(50) DEFAULT 'available',
        featured TINYINT(1) DEFAULT 0,
        displayOrder INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Contributions Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS contributions (
        id VARCHAR(100) PRIMARY KEY,
        itemId VARCHAR(100),
        itemTitle VARCHAR(255),
        guestName VARCHAR(255) NOT NULL,
        guestEmail VARCHAR(255),
        guestPhone VARCHAR(100),
        amount DECIMAL(14,2) NOT NULL,
        paymentMethod VARCHAR(50) DEFAULT 'bank_transfer',
        reference VARCHAR(100),
        message TEXT,
        showInGuestbook TINYINT(1) DEFAULT 1,
        status VARCHAR(50) DEFAULT 'pending',
        date VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // --- Auto-Seed Settings if empty ---
    const [settingsRows] = await conn.query('SELECT id FROM site_settings WHERE id = 1');
    if (settingsRows.length === 0) {
      console.log('🌱 Seeding initial settings into MySQL database...');
      const defaultSettings = readJSON(SETTINGS_FILE, {});
      await conn.query(
        'INSERT INTO site_settings (id, config) VALUES (1, ?)',
        [JSON.stringify(defaultSettings)]
      );
    }

    // --- Auto-Seed Items if empty ---
    const [itemRows] = await conn.query('SELECT COUNT(*) AS count FROM registry_items');
    if (itemRows[0].count === 0) {
      console.log('🌱 Seeding initial 10 registry items into MySQL database...');
      const defaultItems = readJSON(ITEMS_FILE, []);
      let order = 1;
      for (const it of defaultItems) {
        await conn.query(`
          INSERT INTO registry_items 
          (id, title, category, price, raised, allowPartial, isCashFund, image, description, status, featured, displayOrder)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          it.id,
          it.title,
          it.category || 'General',
          parseFloat(it.price) || 0,
          parseFloat(it.raised) || 0,
          it.allowPartial ? 1 : 0,
          it.isCashFund ? 1 : 0,
          it.image || '/images/cash.jpg',
          it.description || '',
          it.status || 'available',
          it.featured ? 1 : 0,
          order++
        ]);
      }
    }

    // --- Auto-Seed Contributions if any exist in JSON ---
    const [contribRows] = await conn.query('SELECT COUNT(*) AS count FROM contributions');
    if (contribRows[0].count === 0) {
      const defaultContribs = readJSON(CONTRIBUTIONS_FILE, []);
      for (const c of defaultContribs) {
        await conn.query(`
          INSERT INTO contributions 
          (id, itemId, itemTitle, guestName, guestEmail, guestPhone, amount, paymentMethod, reference, message, showInGuestbook, status, date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          c.id,
          c.itemId || '',
          c.itemTitle || '',
          c.guestName,
          c.guestEmail || '',
          c.guestPhone || '',
          parseFloat(c.amount) || 0,
          c.paymentMethod || 'bank_transfer',
          c.reference || '',
          c.message || '',
          c.showInGuestbook ? 1 : 0,
          c.status || 'pending',
          c.date || new Date().toISOString()
        ]);
      }
    }

    conn.release();
    isConnected = true;
    console.log('🎉 Database ready and fully synchronized!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to MySQL database:', err.message);
    console.log('⚠️ Falling back to local JSON file storage.');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    isConnected = false;
    pool = null;
    return false;
  }
}

/* =========================================================
   SETTINGS METHODS
   ========================================================= */

async function getSettings() {
  if (isConnected && pool) {
    try {
      const [rows] = await pool.query('SELECT config FROM site_settings WHERE id = 1');
      if (rows.length > 0) {
        return typeof rows[0].config === 'string' ? JSON.parse(rows[0].config) : rows[0].config;
      }
    } catch (err) {
      console.error('MySQL getSettings error:', err.message);
    }
  }
  return readJSON(SETTINGS_FILE, {});
}

async function saveSettings(settings) {
  if (isConnected && pool) {
    try {
      const jsonStr = JSON.stringify(settings);
      await pool.query(
        'INSERT INTO site_settings (id, config) VALUES (1, ?) ON DUPLICATE KEY UPDATE config = ?',
        [jsonStr, jsonStr]
      );
      writeJSON(SETTINGS_FILE, settings);
      return true;
    } catch (err) {
      console.error('MySQL saveSettings error:', err.message);
    }
  }
  return writeJSON(SETTINGS_FILE, settings);
}

/* =========================================================
   ITEMS METHODS
   ========================================================= */

function formatItemRow(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    price: Number(row.price),
    raised: Number(row.raised),
    allowPartial: Boolean(row.allowPartial),
    isCashFund: Boolean(row.isCashFund),
    image: row.image,
    description: row.description || '',
    status: row.status || 'available',
    featured: Boolean(row.featured)
  };
}

async function getItems() {
  if (isConnected && pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM registry_items ORDER BY displayOrder ASC, created_at ASC');
      return rows.map(formatItemRow);
    } catch (err) {
      console.error('MySQL getItems error:', err.message);
    }
  }
  return readJSON(ITEMS_FILE, []);
}

async function getItemById(id) {
  if (isConnected && pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM registry_items WHERE id = ?', [id]);
      if (rows.length > 0) {
        return formatItemRow(rows[0]);
      }
      return null;
    } catch (err) {
      console.error('MySQL getItemById error:', err.message);
    }
  }
  const items = readJSON(ITEMS_FILE, []);
  return items.find(i => String(i.id) === String(id)) || null;
}

async function addItem(item) {
  if (isConnected && pool) {
    try {
      await pool.query(`
        INSERT INTO registry_items 
        (id, title, category, price, raised, allowPartial, isCashFund, image, description, status, featured, displayOrder)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        item.id,
        item.title,
        item.category || 'General',
        parseFloat(item.price) || 0,
        parseFloat(item.raised) || 0,
        item.allowPartial ? 1 : 0,
        item.isCashFund ? 1 : 0,
        item.image || '/images/cash.jpg',
        item.description || '',
        item.status || 'available',
        item.featured ? 1 : 0,
        Date.now()
      ]);
      return item;
    } catch (err) {
      console.error('MySQL addItem error:', err.message);
    }
  }
  const items = readJSON(ITEMS_FILE, []);
  items.push(item);
  writeJSON(ITEMS_FILE, items);
  return item;
}

async function updateItem(id, itemData) {
  if (isConnected && pool) {
    try {
      await pool.query(`
        UPDATE registry_items SET
          title = COALESCE(?, title),
          category = COALESCE(?, category),
          price = COALESCE(?, price),
          raised = COALESCE(?, raised),
          allowPartial = COALESCE(?, allowPartial),
          isCashFund = COALESCE(?, isCashFund),
          image = COALESCE(?, image),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          featured = COALESCE(?, featured)
        WHERE id = ?
      `, [
        itemData.title,
        itemData.category,
        itemData.price !== undefined ? parseFloat(itemData.price) : null,
        itemData.raised !== undefined ? parseFloat(itemData.raised) : null,
        itemData.allowPartial !== undefined ? (itemData.allowPartial ? 1 : 0) : null,
        itemData.isCashFund !== undefined ? (itemData.isCashFund ? 1 : 0) : null,
        itemData.image,
        itemData.description,
        itemData.status,
        itemData.featured !== undefined ? (itemData.featured ? 1 : 0) : null,
        id
      ]);
      return getItemById(id);
    } catch (err) {
      console.error('MySQL updateItem error:', err.message);
    }
  }

  const items = readJSON(ITEMS_FILE, []);
  const idx = items.findIndex(i => String(i.id) === String(id));
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...itemData };
  writeJSON(ITEMS_FILE, items);
  return items[idx];
}

async function deleteItem(id) {
  if (isConnected && pool) {
    try {
      const [result] = await pool.query('DELETE FROM registry_items WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (err) {
      console.error('MySQL deleteItem error:', err.message);
    }
  }
  let items = readJSON(ITEMS_FILE, []);
  const initialLength = items.length;
  items = items.filter(i => String(i.id) !== String(id));
  if (items.length !== initialLength) {
    writeJSON(ITEMS_FILE, items);
    return true;
  }
  return false;
}

/* =========================================================
   CONTRIBUTIONS METHODS
   ========================================================= */

function formatContribRow(row) {
  return {
    id: row.id,
    itemId: row.itemId,
    itemTitle: row.itemTitle,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    guestPhone: row.guestPhone,
    amount: Number(row.amount),
    paymentMethod: row.paymentMethod,
    reference: row.reference,
    message: row.message,
    showInGuestbook: Boolean(row.showInGuestbook),
    status: row.status,
    date: row.date || row.created_at
  };
}

async function getContributions() {
  if (isConnected && pool) {
    try {
      const [rows] = await pool.query('SELECT * FROM contributions ORDER BY created_at DESC');
      return rows.map(formatContribRow);
    } catch (err) {
      console.error('MySQL getContributions error:', err.message);
    }
  }
  return readJSON(CONTRIBUTIONS_FILE, []);
}

async function addContribution(contrib) {
  if (isConnected && pool) {
    try {
      await pool.query(`
        INSERT INTO contributions 
        (id, itemId, itemTitle, guestName, guestEmail, guestPhone, amount, paymentMethod, reference, message, showInGuestbook, status, date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        contrib.id,
        contrib.itemId || 'cash_fund',
        contrib.itemTitle || '',
        contrib.guestName,
        contrib.guestEmail || '',
        contrib.guestPhone || '',
        parseFloat(contrib.amount) || 0,
        contrib.paymentMethod || 'bank_transfer',
        contrib.reference || '',
        contrib.message || '',
        contrib.showInGuestbook !== false ? 1 : 0,
        contrib.status || 'pending',
        contrib.date || new Date().toISOString()
      ]);

      if (contrib.itemId && contrib.itemId !== 'cash_fund' && contrib.itemId !== 'plenty_cash') {
        const item = await getItemById(contrib.itemId);
        if (item) {
          const newRaised = (parseFloat(item.raised) || 0) + parseFloat(contrib.amount);
          const newStatus = (item.price > 0 && newRaised >= item.price) ? 'completed' : item.status;
          await updateItem(item.id, { raised: newRaised, status: newStatus });
        }
      }
      return contrib;
    } catch (err) {
      console.error('MySQL addContribution error:', err.message);
    }
  }

  const contributions = readJSON(CONTRIBUTIONS_FILE, []);
  contributions.unshift(contrib);
  writeJSON(CONTRIBUTIONS_FILE, contributions);

  if (contrib.itemId && contrib.itemId !== 'cash_fund' && contrib.itemId !== 'plenty_cash') {
    const items = readJSON(ITEMS_FILE, []);
    const item = items.find(i => String(i.id) === String(contrib.itemId));
    if (item) {
      item.raised = (parseFloat(item.raised) || 0) + parseFloat(contrib.amount);
      if (item.price > 0 && item.raised >= item.price) {
        item.status = 'completed';
      }
      writeJSON(ITEMS_FILE, items);
    }
  }
  return contrib;
}

async function updateContribution(id, data) {
  if (isConnected && pool) {
    try {
      await pool.query(`
        UPDATE contributions SET
          status = COALESCE(?, status),
          showInGuestbook = COALESCE(?, showInGuestbook)
        WHERE id = ?
      `, [
        data.status !== undefined ? data.status : null,
        data.showInGuestbook !== undefined ? (data.showInGuestbook ? 1 : 0) : null,
        id
      ]);
      const [rows] = await pool.query('SELECT * FROM contributions WHERE id = ?', [id]);
      return rows.length > 0 ? formatContribRow(rows[0]) : null;
    } catch (err) {
      console.error('MySQL updateContribution error:', err.message);
    }
  }

  const contributions = readJSON(CONTRIBUTIONS_FILE, []);
  const contrib = contributions.find(c => String(c.id) === String(id));
  if (!contrib) return null;
  if (data.status !== undefined) contrib.status = data.status;
  if (data.showInGuestbook !== undefined) contrib.showInGuestbook = Boolean(data.showInGuestbook);
  writeJSON(CONTRIBUTIONS_FILE, contributions);
  return contrib;
}

async function deleteContribution(id) {
  if (isConnected && pool) {
    try {
      const [result] = await pool.query('DELETE FROM contributions WHERE id = ?', [id]);
      return result.affectedRows > 0;
    } catch (err) {
      console.error('MySQL deleteContribution error:', err.message);
    }
  }

  let contributions = readJSON(CONTRIBUTIONS_FILE, []);
  const initialLength = contributions.length;
  contributions = contributions.filter(c => String(c.id) !== String(id));
  if (contributions.length !== initialLength) {
    writeJSON(CONTRIBUTIONS_FILE, contributions);
    return true;
  }
  return false;
}

async function getGuestbookMessages() {
  if (isConnected && pool) {
    try {
      const [rows] = await pool.query(`
        SELECT id, guestName, message, date, itemTitle 
        FROM contributions 
        WHERE showInGuestbook = 1 AND message IS NOT NULL AND TRIM(message) != ''
        ORDER BY created_at DESC
      `);
      return rows;
    } catch (err) {
      console.error('MySQL getGuestbookMessages error:', err.message);
    }
  }

  const contributions = readJSON(CONTRIBUTIONS_FILE, []);
  return contributions
    .filter(c => c.showInGuestbook && c.message && c.message.trim().length > 0)
    .map(c => ({
      id: c.id,
      guestName: c.guestName,
      message: c.message,
      date: c.date,
      itemTitle: c.itemTitle
    }));
}

module.exports = {
  initDb,
  getSettings,
  saveSettings,
  getItems,
  getItemById,
  addItem,
  updateItem,
  deleteItem,
  getContributions,
  addContribution,
  updateContribution,
  deleteContribution,
  getGuestbookMessages,
  isConnected: () => isConnected
};

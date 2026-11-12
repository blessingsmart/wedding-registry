/* =========================================================
   ADMIN PORTAL JAVASCRIPT
   Backend Route & Management Controls
   ========================================================= */

let currentPin = sessionStorage.getItem('weddingAdminPin') || '';
let adminItems = [];
let adminContributions = [];
let adminSettings = {};

document.addEventListener('DOMContentLoaded', () => {
  if (currentPin) {
    verifyStoredPin();
  } else {
    showLoginScreen();
  }
});

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-admin-pin': currentPin
  };
}

function showLoginScreen() {
  document.getElementById('loginScreen').classList.remove('d-none');
  document.getElementById('adminApp').classList.add('d-none');
}

function showAppScreen() {
  document.getElementById('loginScreen').classList.add('d-none');
  document.getElementById('adminApp').classList.remove('d-none');
}

function togglePinVisibility() {
  const pinInput = document.getElementById('loginPin');
  pinInput.type = pinInput.type === 'password' ? 'text' : 'password';
}

// Admin Login
async function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('loginPin').value.trim();
  const errorEl = document.getElementById('loginError');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const data = await res.json();

    if (data.success) {
      currentPin = pin;
      sessionStorage.setItem('weddingAdminPin', pin);
      errorEl.classList.add('d-none');
      showAppScreen();
      fetchDashboardData();
    } else {
      errorEl.textContent = data.error || 'Incorrect PIN';
      errorEl.classList.remove('d-none');
    }
  } catch (err) {
    console.error('Login error:', err);
    errorEl.textContent = 'Server connection error';
    errorEl.classList.remove('d-none');
  }
}

async function verifyStoredPin() {
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: currentPin })
    });
    const data = await res.json();
    if (data.success) {
      showAppScreen();
      fetchDashboardData();
    } else {
      adminLogout();
    }
  } catch (err) {
    adminLogout();
  }
}

function adminLogout() {
  sessionStorage.removeItem('weddingAdminPin');
  currentPin = '';
  showLoginScreen();
}

// Switch Sidebar Tabs
function switchTab(tabId) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const targetPane = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
  if (targetPane) targetPane.classList.add('active');

  const titles = {
    items: { title: 'Registry Items', sub: 'Add, edit, or customize gifts and target amounts.' },
    contributions: { title: 'Contributions & Notes', sub: 'Verify payments and manage congratulatory wishes.' },
    bank: { title: 'Bank & Payment Settings', sub: 'Customize Nigerian bank details and Paystack gateway.' },
    wedding: { title: 'Wedding & Security', sub: 'Manage ceremony date, venue details, and access PIN.' }
  };

  if (titles[tabId]) {
    document.getElementById('currentTabTitle').textContent = titles[tabId].title;
    document.getElementById('topbarSubtitle').textContent = titles[tabId].sub;
  }
}

// Fetch All Dashboard Data
async function fetchDashboardData() {
  await Promise.all([
    loadAdminItems(),
    loadAdminContributions(),
    loadAdminSettings()
  ]);
  updateStats();
}

// =========================================================
// 1. MANAGE ITEMS
// =========================================================
async function loadAdminItems() {
  try {
    const res = await fetch('/api/items');
    const data = await res.json();
    if (data.success && Array.isArray(data.items)) {
      adminItems = data.items;
      renderAdminItems(adminItems);
      document.getElementById('statItemCount').textContent = adminItems.length;
    }
  } catch (err) {
    console.error('Error loading items:', err);
  }
}

function renderAdminItems(items) {
  const tbody = document.getElementById('adminItemsTableBody');
  tbody.innerHTML = '';

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted" style="padding: 30px;">No registry items yet. Click "+ Add New Registry Item" above.</td></tr>`;
    return;
  }

  items.forEach(item => {
    const isCompleted = item.status === 'completed';
    const isCash = item.isCashFund || item.price === 0;
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td><img src="${item.image || '/images/cash.jpg'}" class="table-thumb" onerror="this.src='/images/cash.jpg'"></td>
      <td>
        <strong>${item.title}</strong>
        ${item.description ? `<br><small class="text-muted">${item.description.substring(0, 60)}...</small>` : ''}
      </td>
      <td><span class="badge-role">${item.category || 'General'}</span></td>
      <td><strong>${isCash ? 'Flexible Fund' : '₦' + Number(item.price).toLocaleString()}</strong></td>
      <td><span style="color: #278345; font-weight:600;">₦${Number(item.raised || 0).toLocaleString()}</span></td>
      <td>
        <span class="badge-status ${isCompleted ? 'badge-completed' : 'badge-available'}">
          ${isCompleted ? 'Completed' : 'Available'}
        </span>
      </td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-icon" title="Edit Item" onclick="openEditItemModal('${item.id}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button class="btn-icon btn-icon-danger" title="Delete Item" onclick="deleteRegistryItem('${item.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterAdminItems() {
  const search = (document.getElementById('adminItemSearch').value || '').toLowerCase().trim();
  const category = document.getElementById('adminCategoryFilter').value;

  const filtered = adminItems.filter(item => {
    const matchCat = category === 'all' || item.category === category;
    const matchSearch = !search || item.title.toLowerCase().includes(search) || (item.category && item.category.toLowerCase().includes(search));
    return matchCat && matchSearch;
  });

  renderAdminItems(filtered);
}

// Open Add Modal
function openAddItemModal() {
  document.getElementById('editItemId').value = '';
  document.getElementById('itemModalTitle').textContent = 'Add New Registry Item';
  document.getElementById('itemTitle').value = '';
  document.getElementById('itemCategory').value = 'Home Appliances';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemImageUrl').value = '/images/cash.jpg';
  document.getElementById('imagePreview').src = '/images/cash.jpg';
  document.getElementById('itemDescription').value = '';
  document.getElementById('itemStatus').value = 'available';
  document.getElementById('itemRaised').value = '0';
  document.getElementById('itemAllowPartial').checked = true;
  document.getElementById('uploadFileName').textContent = '';

  document.getElementById('itemModal').classList.add('show');
}

// Open Edit Modal
function openEditItemModal(itemId) {
  const item = adminItems.find(i => String(i.id) === String(itemId));
  if (!item) return;

  document.getElementById('editItemId').value = item.id;
  document.getElementById('itemModalTitle').textContent = `Edit: ${item.title}`;
  document.getElementById('itemTitle').value = item.title;
  document.getElementById('itemCategory').value = item.category || 'Home Appliances';
  document.getElementById('itemPrice').value = item.price;
  document.getElementById('itemImageUrl').value = item.image || '';
  document.getElementById('imagePreview').src = item.image || '/images/cash.jpg';
  document.getElementById('itemDescription').value = item.description || '';
  document.getElementById('itemStatus').value = item.status || 'available';
  document.getElementById('itemRaised').value = item.raised || 0;
  document.getElementById('itemAllowPartial').checked = item.allowPartial !== false;
  document.getElementById('uploadFileName').textContent = '';

  document.getElementById('itemModal').classList.add('show');
}

function closeItemModal() {
  document.getElementById('itemModal').classList.remove('show');
}

function selectPresetImage(path) {
  document.getElementById('itemImageUrl').value = path;
  document.getElementById('imagePreview').src = path;
}

// Upload custom image
async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('uploadFileName').textContent = file.name;

  const formData = new FormData();
  formData.append('image', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: {
        'x-admin-pin': currentPin
      },
      body: formData
    });
    const data = await res.json();
    if (data.success && data.imageUrl) {
      document.getElementById('itemImageUrl').value = data.imageUrl;
      document.getElementById('imagePreview').src = data.imageUrl;
      showAdminToast('Image uploaded successfully! 🖼️');
    } else {
      showAdminToast(data.error || 'Upload failed', 'toast-danger');
    }
  } catch (err) {
    console.error('Upload error:', err);
    showAdminToast('Error uploading image', 'toast-danger');
  }
}

// Save (Add or Edit) Item
async function handleItemSave(e) {
  e.preventDefault();

  const id = document.getElementById('editItemId').value;
  const payload = {
    title: document.getElementById('itemTitle').value.trim(),
    category: document.getElementById('itemCategory').value,
    price: parseFloat(document.getElementById('itemPrice').value) || 0,
    isCashFund: parseFloat(document.getElementById('itemPrice').value) === 0,
    image: document.getElementById('itemImageUrl').value.trim() || '/images/cash.jpg',
    description: document.getElementById('itemDescription').value.trim(),
    status: document.getElementById('itemStatus').value,
    raised: parseFloat(document.getElementById('itemRaised').value) || 0,
    allowPartial: document.getElementById('itemAllowPartial').checked
  };

  const isEdit = Boolean(id);
  const url = isEdit ? `/api/items/${id}` : '/api/items';
  const method = isEdit ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: method,
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showAdminToast(isEdit ? 'Item updated successfully!' : 'New item added successfully!');
      closeItemModal();
      loadAdminItems();
    } else {
      showAdminToast(data.error || 'Failed to save item', 'toast-danger');
    }
  } catch (err) {
    console.error('Save item error:', err);
    showAdminToast('Network error while saving item', 'toast-danger');
  }
}

// Delete Item
async function deleteRegistryItem(itemId) {
  if (!confirm('Are you sure you want to delete this registry item?')) return;

  try {
    const res = await fetch(`/api/items/${itemId}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();

    if (data.success) {
      showAdminToast('Item deleted successfully');
      loadAdminItems();
    } else {
      showAdminToast(data.error || 'Failed to delete item', 'toast-danger');
    }
  } catch (err) {
    console.error('Delete item error:', err);
    showAdminToast('Network error', 'toast-danger');
  }
}

// =========================================================
// 2. CONTRIBUTIONS & NOTES MANAGEMENT
// =========================================================
async function loadAdminContributions() {
  try {
    const res = await fetch('/api/admin/contributions', {
      headers: getHeaders()
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.contributions)) {
      adminContributions = data.contributions;
      renderAdminContributions(adminContributions);
    }
  } catch (err) {
    console.error('Error loading contributions:', err);
  }
}

function renderAdminContributions(contributions) {
  const tbody = document.getElementById('adminContributionsTableBody');
  tbody.innerHTML = '';

  const pendingCount = contributions.filter(c => c.status === 'pending').length;
  document.getElementById('unreadCount').textContent = pendingCount;

  if (!contributions.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center text-muted" style="padding: 30px;">No contributions received yet.</td></tr>`;
    return;
  }

  contributions.forEach(c => {
    const tr = document.createElement('tr');
    const isVerified = c.status === 'verified';
    const dateFormatted = new Date(c.date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    tr.innerHTML = `
      <td><small class="text-muted">${dateFormatted}</small></td>
      <td><strong>${c.guestName}</strong></td>
      <td>
        <small>${c.guestPhone || 'No Phone'}</small><br>
        <small class="text-muted">${c.guestEmail || ''}</small>
      </td>
      <td><span class="badge-role">${c.itemTitle || 'Gift'}</span></td>
      <td><strong style="color: #278345; font-size: 1rem;">₦${Number(c.amount).toLocaleString()}</strong></td>
      <td>
        <small class="text-muted">${c.paymentMethod}</small><br>
        <span class="badge-role">${c.reference || ''}</span>
      </td>
      <td><small style="font-style: italic;">${c.message ? `"${c.message}"` : '—'}</small></td>
      <td>
        <span class="badge-status ${isVerified ? 'badge-verified' : 'badge-pending'}">
          ${isVerified ? 'Verified' : 'Pending'}
        </span>
      </td>
      <td class="text-right">
        <div class="table-actions">
          <button class="btn-icon" title="${isVerified ? 'Mark Pending' : 'Mark Verified'}" onclick="toggleContributionStatus('${c.id}', '${isVerified ? 'pending' : 'verified'}')">
            <i class="fa-solid ${isVerified ? 'fa-rotate-left' : 'fa-check'}"></i>
          </button>
          <button class="btn-icon btn-icon-danger" title="Delete Contribution" onclick="deleteContribution('${c.id}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function toggleContributionStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/admin/contributions/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(`Payment marked as ${newStatus}`);
      loadAdminContributions();
      updateStats();
    }
  } catch (err) {
    showAdminToast('Failed to update status', 'toast-danger');
  }
}

async function deleteContribution(id) {
  if (!confirm('Are you sure you want to delete this contribution record?')) return;
  try {
    const res = await fetch(`/api/admin/contributions/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast('Contribution deleted');
      loadAdminContributions();
      updateStats();
    }
  } catch (err) {
    showAdminToast('Failed to delete', 'toast-danger');
  }
}

// =========================================================
// 3. BANK & PAYSTACK SETTINGS
// =========================================================
async function loadAdminSettings() {
  try {
    const res = await fetch('/api/admin/settings', {
      headers: getHeaders()
    });
    const data = await res.json();
    if (data.success && data.settings) {
      adminSettings = data.settings;
      populateSettingsForm(adminSettings);
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

function populateSettingsForm(s) {
  const bank = s.bankTransfer || {};
  const pay = s.paystack || {};
  const couple = s.couple || {};

  // Bank
  document.getElementById('setBankName').value = bank.bankName || '';
  document.getElementById('setAccountNumber').value = bank.accountNumber || '';
  document.getElementById('setAccountName').value = bank.accountName || '';
  document.getElementById('setInstructions').value = bank.instructions || '';
  document.getElementById('setWhatsappPhone').value = bank.whatsappPhone || '';

  // Paystack
  document.getElementById('setPaystackEnabled').checked = Boolean(pay.enabled);
  document.getElementById('setPaystackPublicKey').value = pay.publicKey || '';
  document.getElementById('setPaystackSecretKey').value = pay.secretKey || '';
  document.getElementById('setPaystackNote').value = pay.note || '';

  // Wedding Info
  document.getElementById('setBride').value = couple.bride || '';
  document.getElementById('setGroom').value = couple.groom || '';
  document.getElementById('setShortNames').value = couple.shortNames || '';
  document.getElementById('setHashtag').value = couple.hashtag || '';
  document.getElementById('setWeddingDate').value = couple.weddingDate ? couple.weddingDate.substring(0, 16) : '2026-12-29T10:00';
  document.getElementById('setChurchName').value = couple.venueName || '';
  document.getElementById('setChurchAddress').value = couple.venueAddress || '';
  document.getElementById('setStory').value = couple.story || '';

  // Status banner
  const paystat = document.getElementById('statPaystackStatus');
  if (pay.enabled) {
    paystat.textContent = 'Paystack Online';
    paystat.style.color = '#0288d1';
  } else {
    paystat.textContent = 'Bank Transfer';
    paystat.style.color = '#3b513f';
  }
}

async function saveBankSettings(e) {
  e.preventDefault();
  const bankTransfer = {
    bankName: document.getElementById('setBankName').value.trim(),
    accountNumber: document.getElementById('setAccountNumber').value.trim(),
    accountName: document.getElementById('setAccountName').value.trim(),
    instructions: document.getElementById('setInstructions').value.trim(),
    whatsappPhone: document.getElementById('setWhatsappPhone').value.trim()
  };

  await updateSettingsAPI({ bankTransfer }, 'Bank details updated successfully! 🏦');
}

async function savePaystackSettings(e) {
  e.preventDefault();
  const paystack = {
    enabled: document.getElementById('setPaystackEnabled').checked,
    publicKey: document.getElementById('setPaystackPublicKey').value.trim(),
    secretKey: document.getElementById('setPaystackSecretKey').value.trim(),
    note: document.getElementById('setPaystackNote').value.trim()
  };

  await updateSettingsAPI({ paystack }, 'Paystack settings updated successfully! 💳');
}

async function saveWeddingSettings(e) {
  e.preventDefault();
  const couple = {
    bride: document.getElementById('setBride').value.trim(),
    groom: document.getElementById('setGroom').value.trim(),
    shortNames: document.getElementById('setShortNames').value.trim(),
    hashtag: document.getElementById('setHashtag').value.trim(),
    weddingDate: document.getElementById('setWeddingDate').value,
    venueName: document.getElementById('setChurchName').value.trim(),
    venueAddress: document.getElementById('setChurchAddress').value.trim(),
    story: document.getElementById('setStory').value.trim()
  };

  await updateSettingsAPI({ couple }, 'Ceremony details updated successfully! 💒');
}

async function changeAdminPin(e) {
  e.preventDefault();
  const newPin = document.getElementById('newAdminPin').value.trim();
  const confirmPin = document.getElementById('confirmAdminPin').value.trim();

  if (!newPin || newPin.length < 4) {
    showAdminToast('PIN must be at least 4 digits', 'toast-danger');
    return;
  }

  if (newPin !== confirmPin) {
    showAdminToast('PINs do not match', 'toast-danger');
    return;
  }

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ adminPin: newPin })
    });
    const data = await res.json();
    if (data.success) {
      currentPin = newPin;
      sessionStorage.setItem('weddingAdminPin', newPin);
      showAdminToast('Admin PIN changed successfully! 🔐');
      document.getElementById('newAdminPin').value = '';
      document.getElementById('confirmAdminPin').value = '';
    } else {
      showAdminToast(data.error || 'Failed to update PIN', 'toast-danger');
    }
  } catch (err) {
    showAdminToast('Error updating PIN', 'toast-danger');
  }
}

async function updateSettingsAPI(payload, successMsg) {
  try {
    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showAdminToast(successMsg);
      loadAdminSettings();
    } else {
      showAdminToast(data.error || 'Failed to update settings', 'toast-danger');
    }
  } catch (err) {
    console.error('Update settings error:', err);
    showAdminToast('Network error while updating settings', 'toast-danger');
  }
}

// Update Top Dashboard Stats
function updateStats() {
  document.getElementById('statDonationCount').textContent = adminContributions.length;

  const totalRaised = adminContributions.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
  document.getElementById('statTotalRaised').textContent = '₦' + totalRaised.toLocaleString();
}

// Admin Toast
function showAdminToast(msg, type = 'toast-success') {
  const container = document.getElementById('adminToastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${msg}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

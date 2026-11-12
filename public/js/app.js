/* =========================================================
   CLARA & EZEKIEL WEDDING REGISTRY — CLIENT APP
   ========================================================= */

let registryItems = [];
let siteSettings = {};
let activeCategory = 'all';
let selectedItem = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initCountdown();
  initHeroCarousel();
  fetchSettings();
  fetchItems();
  fetchGuestbook();
  setupSearch();
});

// Format Currency
function formatNaira(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₦0';
  return '₦' + Number(amount).toLocaleString('en-NG');
}

// =========================================================
// FETCH SETTINGS & RENDER DYNAMIC WEDDING DETAILS
// =========================================================
async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      siteSettings = data.settings;
      renderSettings(siteSettings);
    }
  } catch (err) {
    console.error('Error fetching settings:', err);
  }
}

function renderSettings(settings) {
  const couple = settings.couple || {};
  const bank = settings.bankTransfer || {};
  const paystack = settings.paystack || {};

  // Names & Details
  if (couple.bride && document.getElementById('heroBride')) {
    document.getElementById('heroBride').textContent = couple.bride;
  }
  if (couple.groom && document.getElementById('heroGroom')) {
    document.getElementById('heroGroom').textContent = couple.groom;
  }
  if (couple.story && document.getElementById('welcomeStory')) {
    document.getElementById('welcomeStory').textContent = couple.story;
  }
  if (couple.venueName && document.getElementById('churchName')) {
    document.getElementById('churchName').textContent = couple.venueName;
  }
  if (couple.venueField && document.getElementById('churchField')) {
    document.getElementById('churchField').textContent = couple.venueField;
  }
  if (couple.venueDistrict && document.getElementById('churchDistrict')) {
    document.getElementById('churchDistrict').textContent = couple.venueDistrict;
  }
  if (couple.venueAddress && document.getElementById('churchAddress')) {
    document.getElementById('churchAddress').textContent = couple.venueAddress;
  }

  // Bank Info
  if (bank.bankName) {
    document.getElementById('displayBankName').textContent = bank.bankName;
    document.getElementById('modalBankName').textContent = bank.bankName;
  }
  if (bank.accountNumber) {
    document.getElementById('displayAccountNumber').textContent = bank.accountNumber;
    document.getElementById('modalAccNumber').textContent = bank.accountNumber;
  }
  if (bank.accountName) {
    document.getElementById('displayAccountName').textContent = bank.accountName;
    document.getElementById('modalAccName').textContent = bank.accountName;
  }
  if (bank.instructions && document.getElementById('displayInstructions')) {
    document.getElementById('displayInstructions').innerHTML = `<i class="fa-solid fa-circle-info"></i> ${bank.instructions}`;
  }

  // Paystack Status
  const paystackBadge = document.getElementById('paystackStatusBadge');
  const paystackHeadline = document.getElementById('paystackHeadline');
  const paystackExplainer = document.getElementById('paystackExplainer');
  const paystackSubtext = document.getElementById('paystackSubtext');

  if (paystack.enabled) {
    if (paystackBadge) {
      paystackBadge.textContent = 'Online Active';
      paystackBadge.style.background = '#e1f5fe';
      paystackBadge.style.color = '#0288d1';
    }
    if (paystackHeadline) paystackHeadline.textContent = 'Pay via Paystack (Card, USSD & Bank)';
    if (paystackExplainer) paystackExplainer.textContent = 'Instant online card and transfer processing powered securely by Paystack.';
    if (paystackSubtext) paystackSubtext.textContent = 'Instant online checkout';
  } else {
    if (paystackBadge) {
      paystackBadge.textContent = 'Coming Soon';
      paystackBadge.style.background = '#fef3e2';
      paystackBadge.style.color = '#b7791f';
    }
    if (paystackHeadline) paystackHeadline.textContent = 'Paystack Card Payments Coming Soon';
    if (paystackExplainer) paystackExplainer.textContent = 'Online card payment gateway will be enabled soon. Direct Bank Transfer is active and instant right now!';
    if (paystackSubtext) paystackSubtext.textContent = 'Coming soon (Use Bank Transfer)';
  }
}

// =========================================================
// FETCH & RENDER REGISTRY ITEMS
// =========================================================
async function fetchItems() {
  const grid = document.getElementById('registryGrid');
  try {
    const res = await fetch('/api/items');
    const data = await res.json();
    if (data.success && Array.isArray(data.items)) {
      registryItems = data.items;
      updateItemCounts();
      renderItems(registryItems);
    } else {
      grid.innerHTML = '<p class="text-center text-muted">No registry items found.</p>';
    }
  } catch (err) {
    console.error('Error fetching items:', err);
    grid.innerHTML = '<p class="text-center text-muted">Unable to load registry items at this moment.</p>';
  }
}

function updateItemCounts() {
  const countAll = document.getElementById('countAll');
  if (countAll) countAll.textContent = registryItems.length;
}

function renderItems(itemsToRender) {
  const grid = document.getElementById('registryGrid');
  grid.innerHTML = '';

  if (!itemsToRender.length) {
    grid.innerHTML = `
      <div class="loading-state">
        <i class="fa-solid fa-box-open" style="font-size: 2.5rem; margin-bottom: 12px; color: #8fa692;"></i>
        <p>No registry items match your search or filter.</p>
      </div>`;
    return;
  }

  itemsToRender.forEach(item => {
    const isCompleted = item.status === 'completed';
    const isCash = item.isCashFund || item.price === 0;
    
    // Calculate percentage funded
    let percent = 0;
    if (!isCash && item.price > 0) {
      percent = Math.min(100, Math.round(((item.raised || 0) / item.price) * 100));
    }

    const card = document.createElement('div');
    card.className = `item-card ${isCompleted ? 'item-completed' : ''}`;
    
    card.innerHTML = `
      <div class="item-img-container">
        <img src="${item.image || '/images/cash.jpg'}" alt="${item.title}" class="item-img" onerror="this.src='/images/cash.jpg'">
        <span class="item-category-tag">${item.category || 'Gift'}</span>
        ${isCompleted ? '<span class="item-status-badge completed">Fully Gifted ❤️</span>' : '<span class="item-status-badge">Available</span>'}
      </div>

      <div class="item-card-body">
        <h3 class="item-card-title">${item.title}</h3>
        <p class="item-card-desc">${item.description || 'A cherished gift to bless our home.'}</p>

        <div class="item-pricing-wrap">
          <div class="price-row">
            <span class="target-price">${isCash ? 'Any Amount' : formatNaira(item.price)}</span>
            <span class="raised-amount">${isCash ? 'Flexible Fund' : (item.raised > 0 ? `${formatNaira(item.raised)} raised` : '₦0 pledged')}</span>
          </div>

          ${!isCash ? `
            <div class="progress-container">
              <div class="progress-fill" style="width: ${percent}%;"></div>
            </div>
          ` : `
            <div class="progress-container">
              <div class="progress-fill" style="width: 100%; background: linear-gradient(90deg, #d96582, #721b2c);"></div>
            </div>
          `}
        </div>

        <div class="item-card-footer">
          <button class="btn ${isCompleted ? 'btn-outline' : 'btn-primary'} btn-block" onclick="openItemModal('${item.id}')">
            <i class="fa-solid fa-gift"></i> ${isCompleted ? 'Contribute Extra' : (isCash ? 'Bless with Cash' : 'Gift This Item')}
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Category Filtering
const filterBtns = document.querySelectorAll('.filter-btn');
filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.getAttribute('data-category');
    applyFilters();
  });
});

function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      applyFilters();
    });
  }
}

function applyFilters() {
  const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();

  let filtered = registryItems.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = !searchVal || 
      item.title.toLowerCase().includes(searchVal) || 
      (item.description && item.description.toLowerCase().includes(searchVal)) ||
      (item.category && item.category.toLowerCase().includes(searchVal));

    return matchesCategory && matchesSearch;
  });

  renderItems(filtered);
}

// =========================================================
// LIVE WEDDING COUNTDOWN TIMER (29th Dec 2026)
// =========================================================
function initCountdown() {
  const targetDate = new Date('2026-12-29T10:00:00+01:00').getTime();

  function update() {
    const now = new Date().getTime();
    const distance = targetDate - now;

    if (distance < 0) {
      document.getElementById('countdownGrid').innerHTML = '<h3 style="color: #278345;">Today is the Day! Hallelujah! 💍</h3>';
      return;
    }

    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    const pad = (n) => String(n).padStart(2, '0');

    if (document.getElementById('days')) document.getElementById('days').textContent = pad(days);
    if (document.getElementById('hours')) document.getElementById('hours').textContent = pad(hours);
    if (document.getElementById('minutes')) document.getElementById('minutes').textContent = pad(minutes);
    if (document.getElementById('seconds')) document.getElementById('seconds').textContent = pad(seconds);
  }

  update();
  setInterval(update, 1000);
}

// =========================================================
// COPY ACCOUNT NUMBER TO CLIPBOARD
// =========================================================
function copyAccountNumber() {
  const accNum = document.getElementById('displayAccountNumber').textContent.trim();
  navigator.clipboard.writeText(accNum).then(() => {
    const btn = document.getElementById('copyAccBtn');
    const text = document.getElementById('copyBtnText');
    text.textContent = 'Copied!';
    btn.style.background = 'var(--gold-accent)';
    btn.style.color = '#fff';
    showToast('Account number copied to clipboard! 📋', 'toast-gold');

    setTimeout(() => {
      text.textContent = 'Copy';
      btn.style.background = '';
      btn.style.color = '';
    }, 2500);
  }).catch(err => {
    console.error('Failed to copy: ', err);
    showToast('Please select and copy manually: ' + accNum);
  });
}

function copyModalAccountNumber() {
  const accNum = document.getElementById('modalAccNumber').textContent.trim();
  navigator.clipboard.writeText(accNum).then(() => {
    showToast('Account number copied! 📋', 'toast-gold');
  });
}

// =========================================================
// MODAL & CONTRIBUTION CONTROLS
// =========================================================
function openItemModal(itemId) {
  selectedItem = registryItems.find(i => String(i.id) === String(itemId));

  if (!selectedItem) {
    openDirectTransferModal();
    return;
  }

  document.getElementById('formItemId').value = selectedItem.id;
  document.getElementById('modalItemTitle').textContent = `Gift: ${selectedItem.title}`;
  document.getElementById('modalItemName').textContent = selectedItem.title;
  document.getElementById('modalItemImage').src = selectedItem.image || '/images/cash.jpg';
  
  const isCash = selectedItem.isCashFund || selectedItem.price === 0;
  if (isCash) {
    document.getElementById('modalItemPrice').textContent = 'Flexible Cash Fund';
    document.getElementById('modalItemRaised').textContent = 'Contribute any amount you desire';
    document.getElementById('formAmount').value = '50000';
  } else {
    document.getElementById('modalItemPrice').textContent = `Target: ${formatNaira(selectedItem.price)}`;
    document.getElementById('modalItemRaised').textContent = `${formatNaira(selectedItem.raised || 0)} raised so far`;
    
    // Default suggested amount: remaining amount or full price
    const remaining = Math.max(0, selectedItem.price - (selectedItem.raised || 0));
    document.getElementById('formAmount').value = remaining > 0 ? remaining : selectedItem.price;
  }

  generateReferenceCode();
  resetModalView();
  document.getElementById('giftModal').classList.add('show');
}

function openDirectTransferModal() {
  selectedItem = null;
  document.getElementById('formItemId').value = 'direct_transfer';
  document.getElementById('modalItemTitle').textContent = 'Bless the Couple (Direct Transfer)';
  document.getElementById('modalItemName').textContent = 'Clara & Ezekiel Wedding Gift Fund';
  document.getElementById('modalItemImage').src = '/images/cash.jpg';
  document.getElementById('modalItemPrice').textContent = 'Any Generous Amount';
  document.getElementById('modalItemRaised').textContent = 'Your gift goes directly to the couple';
  document.getElementById('formAmount').value = '25000';

  generateReferenceCode();
  resetModalView();
  document.getElementById('giftModal').classList.add('show');
}

function closeModal() {
  document.getElementById('giftModal').classList.remove('show');
}

function resetModalView() {
  document.getElementById('contributionForm').classList.remove('d-none');
  document.getElementById('successView').classList.add('d-none');
  togglePaymentTab('bank');
}

function generateReferenceCode() {
  const code = 'CE-' + Math.floor(100000 + Math.random() * 900000);
  document.getElementById('modalReference').textContent = code;
}

function setPresetAmount(amount) {
  document.getElementById('formAmount').value = amount;
}

function setFullItemAmount() {
  if (selectedItem && selectedItem.price > 0) {
    document.getElementById('formAmount').value = selectedItem.price;
  } else {
    document.getElementById('formAmount').value = 100000;
  }
}

// Payment method tab in modal
function togglePaymentTab(method) {
  const bankBox = document.getElementById('bankTransferBox');
  const paystackBox = document.getElementById('paystackNoticeBox');
  const submitBtn = document.getElementById('submitGiftBtn');
  const bankLabel = document.getElementById('methodBankLabel');
  const paystackLabel = document.getElementById('methodPaystackLabel');

  if (method === 'bank') {
    bankBox.classList.remove('d-none');
    paystackBox.classList.add('d-none');
    bankLabel.classList.add('active');
    paystackLabel.classList.remove('active');
    submitBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> I Have Made Transfer (Confirm)';
  } else {
    bankBox.classList.add('d-none');
    paystackBox.classList.remove('d-none');
    bankLabel.classList.remove('active');
    paystackLabel.classList.add('active');

    if (siteSettings.paystack && siteSettings.paystack.enabled) {
      submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay Securely with Paystack';
      document.getElementById('paystackInfoNotice').textContent = 'Pay securely with your Card, Bank Transfer, or USSD via Paystack.';
    } else {
      submitBtn.innerHTML = '<i class="fa-solid fa-building-columns"></i> Use Bank Transfer Instead';
      document.getElementById('paystackInfoNotice').innerHTML = '<strong>Online card checkout is coming soon!</strong> Please select the <strong>Direct Bank Transfer</strong> option for instant gifting.';
    }
  }
}

// Handle Form Submission
async function handleContributionSubmit(event) {
  event.preventDefault();

  const itemId = document.getElementById('formItemId').value;
  const amount = parseFloat(document.getElementById('formAmount').value);
  const guestName = document.getElementById('formGuestName').value.trim();
  const guestPhone = document.getElementById('formGuestPhone').value.trim();
  const guestEmail = document.getElementById('formGuestEmail').value.trim();
  const message = document.getElementById('formMessage').value.trim();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'bank_transfer';
  const reference = document.getElementById('modalReference').textContent.trim();

  if (!guestName) {
    showToast('Please enter your full name');
    return;
  }

  if (!amount || amount <= 0) {
    showToast('Please enter a valid contribution amount');
    return;
  }

  // Check if Paystack was chosen and is active
  if (paymentMethod === 'paystack' && siteSettings.paystack && siteSettings.paystack.enabled) {
    launchPaystackCheckout({
      email: guestEmail || 'guest@wedding.com',
      amount: amount,
      guestName: guestName,
      guestPhone: guestPhone,
      itemId: itemId,
      reference: reference,
      message: message
    });
    return;
  }

  // Normal Direct Bank Transfer flow
  await submitContributionData({
    guestName,
    guestEmail,
    guestPhone,
    itemId,
    amount,
    paymentMethod: 'bank_transfer',
    reference,
    message
  });
}

async function submitContributionData(payload) {
  try {
    const res = await fetch('/api/contributions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      // Fire celebration confetti!
      triggerConfetti();

      // Refresh items list and guestbook
      fetchItems();
      fetchGuestbook();

      // Show Success View
      showSuccessView(payload);
    } else {
      showToast(data.error || 'Failed to record contribution');
    }
  } catch (err) {
    console.error('Error submitting contribution:', err);
    showToast('Network error. Please try again.');
  }
}

function showSuccessView(contrib) {
  document.getElementById('contributionForm').classList.add('d-none');
  const successView = document.getElementById('successView');
  successView.classList.remove('d-none');

  const summary = document.getElementById('successSummary');
  const itemName = selectedItem ? selectedItem.title : (contrib.itemId === 'plenty_cash' ? 'Plenty Cash' : 'Wedding Gift Fund');

  summary.innerHTML = `
    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="color:#607264;">Gift Category:</span>
      <strong>${itemName}</strong>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="color:#6f4751;">Amount:</span>
      <strong style="color:#721b2c; font-size:1.15rem;">${formatNaira(contrib.amount)}</strong>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="color:#607264;">Reference Code:</span>
      <strong style="font-family:monospace;">${contrib.reference}</strong>
    </div>
    ${contrib.message ? `
      <div style="margin-top:12px; padding-top:10px; border-top:1px dashed #e3e8e3; font-style:italic; color:#1f2a21;">
        "${contrib.message}"
      </div>
    ` : ''}
  `;

  // WhatsApp notification link
  const whatsappNum = (siteSettings.bankTransfer && siteSettings.bankTransfer.whatsappPhone) || '+2348012345678';
  const cleanPhone = whatsappNum.replace(/[^0-9]/g, '');
  const waText = encodeURIComponent(
    `Hello Clara & Ezekiel! 💍\n\nI just made a wedding gift transfer on your registry website:\n\n• From: ${contrib.guestName}\n• Item: ${itemName}\n• Amount: ${formatNaira(contrib.amount)}\n• Reference: ${contrib.reference}\n${contrib.message ? `• Note: "${contrib.message}"\n` : ''}\nCongratulations on your wedding ceremony on 29th December 2026! ❤️`
  );
  
  const waLink = document.getElementById('whatsappNotifyLink');
  waLink.href = `https://wa.me/${cleanPhone}?text=${waText}`;
}

// Paystack Inline Checkout integration
function launchPaystackCheckout(params) {
  if (typeof PaystackPop === 'undefined') {
    showToast('Paystack script is loading, please try again.');
    return;
  }

  const handler = PaystackPop.setup({
    key: siteSettings.paystack.publicKey,
    email: params.email,
    amount: Math.round(params.amount * 100), // Kobo
    currency: 'NGN',
    ref: params.reference,
    metadata: {
      custom_fields: [
        { display_name: "Guest Name", variable_name: "guest_name", value: params.guestName },
        { display_name: "Item", variable_name: "item_id", value: params.itemId },
        { display_name: "Love Note", variable_name: "message", value: params.message }
      ]
    },
    callback: function (response) {
      // Payment successful, submit to backend
      submitContributionData({
        guestName: params.guestName,
        guestEmail: params.email,
        guestPhone: params.guestPhone,
        itemId: params.itemId,
        amount: params.amount,
        paymentMethod: 'paystack',
        reference: response.reference || params.reference,
        message: params.message
      });
    },
    onClose: function () {
      showToast('Payment window closed');
    }
  });

  handler.openIframe();
}

// =========================================================
// GUESTBOOK / LOVE NOTES WALL
// =========================================================
async function fetchGuestbook() {
  const wall = document.getElementById('guestbookWall');
  try {
    const res = await fetch('/api/guestbook');
    const data = await res.json();
    if (data.success && Array.isArray(data.messages) && data.messages.length > 0) {
      wall.innerHTML = '';
      data.messages.forEach(msg => {
        const card = document.createElement('div');
        card.className = 'guestbook-card';
        const formattedDate = new Date(msg.date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });

        card.innerHTML = `
          <p class="guestbook-message">“${msg.message}”</p>
          <div class="guestbook-meta">
            <div>
              <span class="guestbook-author">${msg.guestName}</span>
              ${msg.itemTitle ? `<span class="guestbook-gift-tag"><i class="fa-solid fa-gift"></i> ${msg.itemTitle}</span>` : ''}
            </div>
            <span class="guestbook-date">${formattedDate}</span>
          </div>
        `;
        wall.appendChild(card);
      });
    } else {
      wall.innerHTML = `
        <div style="grid-column: 1 / -1; text-align:center; padding:30px 0; color:#607264;">
          <p>Be the first to leave a sweet congratulatory note for the couple!</p>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error fetching guestbook:', err);
  }
}

// =========================================================
// CELEBRATION CONFETTI
// =========================================================
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 110,
      spread: 75,
      origin: { y: 0.6 },
      colors: ['#721b2c', '#932a3f', '#d96582', '#f7d3dc', '#c59b27', '#ffffff']
    });
  }
}

// =========================================================
// TOAST NOTIFICATIONS
// =========================================================
function showToast(message, type = 'toast-success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fa-solid fa-circle-check"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// =========================================================
// NAVIGATION & MOBILE MENU
// =========================================================
function initNavbar() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');

  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('open');
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
  
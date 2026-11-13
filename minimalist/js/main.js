/* =========================================================
   CLARA & EZEKIEL — MINIMALIST WEDDING SITE
   Vanilla JavaScript (No backend required)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  initHeroSlider();
  initCountdown();
  initCurrencyTabs();
  initCalendarGenerator();
  initWishesForm();
});

/* =========================================================
   1. HERO AUTO-SCROLLING SLIDER
   ========================================================= */
function initHeroSlider() {
  const slides = document.querySelectorAll('.hero-slide');
  const dotsContainer = document.getElementById('sliderPagination');
  if (!slides.length) return;

  let currentSlide = 0;
  const slideCount = slides.length;
  const slideIntervalTime = 5000; // 5 seconds per slide
  let slideInterval;

  // Generate pagination dots
  dotsContainer.innerHTML = '';
  slides.forEach((_, idx) => {
    const dot = document.createElement('div');
    dot.className = `slider-dot ${idx === 0 ? 'active' : ''}`;
    dot.setAttribute('aria-label', `Go to photo ${idx + 1}`);
    dot.addEventListener('click', () => {
      goToSlide(idx);
      resetInterval();
    });
    dotsContainer.appendChild(dot);
  });

  const dots = document.querySelectorAll('.slider-dot');

  function goToSlide(index) {
    slides[currentSlide].classList.remove('active');
    if (dots[currentSlide]) dots[currentSlide].classList.remove('active');

    currentSlide = (index + slideCount) % slideCount;

    slides[currentSlide].classList.add('active');
    if (dots[currentSlide]) dots[currentSlide].classList.add('active');
  }

  function nextSlide() {
    goToSlide(currentSlide + 1);
  }

  function startInterval() {
    slideInterval = setInterval(nextSlide, slideIntervalTime);
  }

  function resetInterval() {
    clearInterval(slideInterval);
    startInterval();
  }

  startInterval();

  // Pause on hover
  const heroSection = document.getElementById('hero');
  if (heroSection) {
    heroSection.addEventListener('mouseenter', () => clearInterval(slideInterval));
    heroSection.addEventListener('mouseleave', () => startInterval());
  }
}

/* =========================================================
   2. COUNTDOWN TIMER
   ========================================================= */
function initCountdown() {
  // Target: 29th December 2026, 10:00:00 West Africa Time (UTC+1)
  const targetDate = new Date('2026-12-29T10:00:00+01:00').getTime();

  const daysEl = document.getElementById('cdDays');
  const hoursEl = document.getElementById('cdHours');
  const minsEl = document.getElementById('cdMins');
  const secsEl = document.getElementById('cdSecs');

  if (!daysEl) return;

  function update() {
    const now = new Date().getTime();
    const diff = targetDate - now;

    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minsEl.textContent = '00';
      secsEl.textContent = '00';
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    daysEl.textContent = String(d).padStart(2, '0');
    hoursEl.textContent = String(h).padStart(2, '0');
    minsEl.textContent = String(m).padStart(2, '0');
    secsEl.textContent = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

/* =========================================================
   3. CURRENCY TABS (USD vs NGN)
   ========================================================= */
const BANK_DETAILS = {
  usd: {
    currency: 'USD',
    bankName: 'Lead Bank',
    accountName: 'Clara Napoleon',
    accountNumber: '214340084641',
    accountType: 'Checking',
    instructions: 'Please use your Full Name as wire / ACH transfer memo. You can also confirm via WhatsApp.'
  },
  ngn: {
    currency: 'NGN',
    bankName: 'Access Bank',
    accountName: 'Clara Napoleon',
    accountNumber: '0824256834',
    accountType: 'Savings',
    instructions: 'Please use your Full Name as transfer narration. After payment, kindly send confirmation to the couple!'
  }
};

let currentCurrency = 'usd';

function initCurrencyTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const currency = tab.getAttribute('data-currency');
      switchCurrency(currency);
    });
  });
}

function switchCurrency(curr) {
  currentCurrency = curr;
  const data = BANK_DETAILS[curr];
  if (!data) return;

  const bankNameEl = document.getElementById('dispBankName');
  const accNameEl = document.getElementById('dispAccName');
  const accNumEl = document.getElementById('dispAccNum');
  const accTypeEl = document.getElementById('dispAccType');
  const instEl = document.getElementById('dispInstructions');
  const copyBtn = document.getElementById('copyBtnText');

  if (bankNameEl) bankNameEl.textContent = data.bankName;
  if (accNameEl) accNameEl.textContent = data.accountName;
  if (accNumEl) accNumEl.textContent = data.accountNumber;
  if (accTypeEl) accTypeEl.textContent = data.accountType;
  if (instEl) instEl.textContent = data.instructions;

  if (copyBtn) copyBtn.textContent = 'Copy';
}

function copyAccountNumber() {
  const data = BANK_DETAILS[currentCurrency];
  if (!data) return;

  const num = data.accountNumber;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(num).then(() => {
      showCopySuccess();
    }).catch(() => {
      fallbackCopy(num);
    });
  } else {
    fallbackCopy(num);
  }
}

function fallbackCopy(text) {
  const input = document.createElement('input');
  input.value = text;
  document.body.appendChild(input);
  input.select();
  try {
    document.execCommand('copy');
    showCopySuccess();
  } catch (err) {
    alert('Account Number: ' + text);
  }
  document.body.removeChild(input);
}

function showCopySuccess() {
  const copyBtn = document.getElementById('copyBtnText');
  const microBtn = document.getElementById('btnCopyMicro');
  if (copyBtn) copyBtn.textContent = 'Copied!';
  if (microBtn) microBtn.classList.add('copied');

  showToast('Account number copied to clipboard! 📋');

  setTimeout(() => {
    if (copyBtn) copyBtn.textContent = 'Copy';
    if (microBtn) microBtn.classList.remove('copied');
  }, 3000);
}

/* =========================================================
   4. ADD TO GOOGLE CALENDAR
   ========================================================= */
function initCalendarGenerator() {
  const calBtn = document.getElementById('btnAddToCalendar');
  if (!calBtn) return;

  // Event: 29th December 2026, 10:00 to 18:00 WAT (UTC+1 is 09:00Z to 17:00Z)
  const title = encodeURIComponent("Clara Napoleon & Ezekiel Ikoh's Wedding");
  const details = encodeURIComponent("Wedding Ceremony of Clara Napoleon & Ezekiel Ikoh at The Apostolic Church Nigeria, Ekim Town.");
  const location = encodeURIComponent("The Apostolic Church Nigeria, Ekim Town District Headquarters, Ikot Abasi Field, Ekim Road, Opposite Ekim Primary School");
  const dates = "20261229T090000Z/20261229T170000Z";

  const googleCalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;

  calBtn.href = googleCalUrl;
  calBtn.target = "_blank";
  calBtn.rel = "noopener noreferrer";
}

/* =========================================================
   5. SWEET NOTES & TOAST FEEDBACK
   ========================================================= */
function initWishesForm() {
  const form = document.getElementById('wishesForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('wishName');
    const msgInput = document.getElementById('wishMessage');

    const name = nameInput.value.trim();
    const msg = msgInput.value.trim();

    if (!name || !msg) {
      showToast('Please enter your name and a sweet note!');
      return;
    }

    // Launch confetti if library available
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#6B1D2F', '#B76E79', '#C5A059', '#FAF7F2']
      });
    }

    showToast(`Thank you, ${name}! Your warm wishes have been sent to Clara & Ezekiel 💖`);
    form.reset();
  });
}

function showToast(text) {
  let toast = document.getElementById('siteToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'siteToast';
    toast.className = 'toast-notice';
    document.body.appendChild(toast);
  }
  toast.innerHTML = text;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

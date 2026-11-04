(function () {
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const mobileNav = document.querySelector('dialog.mobile-nav');
  if (header) {
    const updateHeader = () => header.classList.toggle('site-header--scrolled', window.scrollY > 40);
    window.addEventListener('scroll', updateHeader, { passive: true });
    updateHeader();
  }
  if (navToggle && mobileNav) {
    let previousOverflow = '';
    const closeMenu = () => { if (mobileNav.open) mobileNav.close(); };
    navToggle.addEventListener('click', () => {
      if (mobileNav.open) { closeMenu(); return; }
      previousOverflow = document.body.style.overflow;
      mobileNav.showModal();
      navToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    });
    mobileNav.querySelector('.mobile-nav__close').addEventListener('click', closeMenu);
    mobileNav.addEventListener('cancel', (event) => { event.preventDefault(); closeMenu(); });
    mobileNav.addEventListener('close', () => {
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = previousOverflow;
      navToggle.focus({ preventScroll: true });
    });
    mobileNav.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
    mobileNav.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const controls = [...mobileNav.querySelectorAll('a[href], button:not([disabled])')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    window.matchMedia('(min-width: 769px)').addEventListener('change', (event) => { if (event.matches) closeMenu(); });
  }
  const site = window.GULAB_SITE;
  if (site) {
    document.querySelectorAll("[data-site='phone']").forEach((el) => {
      el.textContent = site.phone;
      if (el.href) el.href = "tel:" + site.phoneTel;
    });
    document.querySelectorAll("[data-site='email']").forEach((el) => {
      el.textContent = site.email;
      if (el.href) el.href = "mailto:" + site.email;
    });
    document.querySelectorAll("[data-site='email-alt']").forEach((el) => {
      el.textContent = site.emailAlt;
      if (el.href) el.href = "mailto:" + site.emailAlt;
    });
    document.querySelectorAll("[data-site='website']").forEach((el) => {
      el.textContent = site.website.replace("https://", "");
      if (el.href) el.href = site.website;
    });
    document.querySelectorAll("[data-social]").forEach((el) => {
      const key = el.getAttribute("data-social");
      if (site.social[key]) el.href = site.social[key];
    });
  }
})();

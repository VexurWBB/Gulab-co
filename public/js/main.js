(function () {
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  const mobileNav = document.querySelector(".mobile-nav");

  if (header) {
    window.addEventListener("scroll", () => {
      header.classList.toggle("site-header--scrolled", window.scrollY > 40);
    });
    header.classList.toggle("site-header--scrolled", window.scrollY > 40);
  }

  if (navToggle && mobileNav) {
    navToggle.addEventListener("click", () => {
      const open = mobileNav.classList.toggle("mobile-nav--open");
      navToggle.setAttribute("aria-expanded", open);
      document.body.style.overflow = open ? "hidden" : "";
    });

    mobileNav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        mobileNav.classList.remove("mobile-nav--open");
        navToggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  const fadeEls = document.querySelectorAll(".fade-up");
  if (fadeEls.length && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    fadeEls.forEach((el) => observer.observe(el));
  } else {
    fadeEls.forEach((el) => el.classList.add("visible"));
  }

  const track = document.querySelector(".reviews__track");
  const slides = document.querySelectorAll(".reviews__slide");
  const prevBtn = document.querySelector(".reviews__arrow--prev");
  const nextBtn = document.querySelector(".reviews__arrow--next");
  const dotsContainer = document.querySelector(".reviews__dots");

  if (track && slides.length > 1) {
    let current = 0;
    let perView = 3;

    function getPerView() {
      if (window.innerWidth <= 768) return 1;
      if (window.innerWidth <= 1024) return 2;
      return 3;
    }

    function maxIndex() {
      return Math.max(0, slides.length - perView);
    }

    function goTo(index) {
      current = Math.max(0, Math.min(index, maxIndex()));
      const slide = slides[0];
      const gap = 24;
      const offset = current * (slide.offsetWidth + gap);
      track.style.transform = `translateX(-${offset}px)`;
      track.style.transition = "transform 0.5s ease";

      document.querySelectorAll(".reviews__dot").forEach((dot, i) => {
        dot.classList.toggle("reviews__dot--active", i === current);
      });
    }

    function buildDots() {
      if (!dotsContainer) return;
      dotsContainer.innerHTML = "";
      const total = maxIndex() + 1;
      for (let i = 0; i < total; i++) {
        const dot = document.createElement("button");
        dot.className = "reviews__dot" + (i === 0 ? " reviews__dot--active" : "");
        dot.setAttribute("aria-label", `Go to review ${i + 1}`);
        dot.addEventListener("click", () => goTo(i));
        dotsContainer.appendChild(dot);
      }
    }

    perView = getPerView();
    buildDots();
    goTo(0);

    if (prevBtn) prevBtn.addEventListener("click", () => goTo(current - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => goTo(current + 1));

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        perView = getPerView();
        buildDots();
        goTo(Math.min(current, maxIndex()));
      }, 200);
    });

    setInterval(() => {
      goTo(current >= maxIndex() ? 0 : current + 1);
    }, 7000);
  }

  const countEls = document.querySelectorAll("[data-count]");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (countEls.length) {
    function animateCount(el) {
      const target = parseInt(el.getAttribute("data-count"), 10);
      const suffix = el.getAttribute("data-suffix") || "";
      const duration = 1800;
      const start = performance.now();

      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(target * eased);
        el.textContent = value + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }

    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );
    if (prefersReducedMotion) {
      countEls.forEach((el) => {
        el.textContent = el.getAttribute("data-count") + (el.getAttribute("data-suffix") || "");
      });
    } else {
      countEls.forEach((el) => counterObserver.observe(el));
    }
  }

  const accordions = document.querySelectorAll(".diff-accordion");
  accordions.forEach((accordion) => {
    const items = accordion.querySelectorAll(".diff-accordion__item");

    function setPanelHeight(panel, open) {
      if (open) {
        panel.hidden = false;
        panel.style.height = "0px";
        requestAnimationFrame(() => {
          panel.style.height = panel.scrollHeight + "px";
        });
      } else {
        panel.style.height = panel.scrollHeight + "px";
        requestAnimationFrame(() => {
          panel.style.height = "0px";
        });
      }
    }

    function closeItem(item) {
      const trigger = item.querySelector(".diff-accordion__trigger");
      const panel = item.querySelector(".diff-accordion__panel");
      if (!trigger || !panel || !item.classList.contains("is-open")) return;
      item.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      setPanelHeight(panel, false);
      panel.addEventListener(
        "transitionend",
        () => {
          if (!item.classList.contains("is-open")) panel.hidden = true;
        },
        { once: true }
      );
    }

    function openItem(item) {
      const trigger = item.querySelector(".diff-accordion__trigger");
      const panel = item.querySelector(".diff-accordion__panel");
      if (!trigger || !panel) return;
      items.forEach((other) => {
        if (other !== item) closeItem(other);
      });
      item.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      setPanelHeight(panel, true);
      panel.addEventListener(
        "transitionend",
        () => {
          if (item.classList.contains("is-open")) panel.style.height = "auto";
        },
        { once: true }
      );
    }

    items.forEach((item) => {
      const trigger = item.querySelector(".diff-accordion__trigger");
      const panel = item.querySelector(".diff-accordion__panel");
      if (!trigger || !panel) return;

      panel.style.height = "0px";
      panel.hidden = true;

      trigger.addEventListener("click", () => {
        if (item.classList.contains("is-open")) {
          closeItem(item);
        } else {
          openItem(item);
        }
      });
    });
  });

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

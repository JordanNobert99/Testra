// Testra shared script - handles mobile menu toggle
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector('[data-mobile-toggle]');
  const menu = document.querySelector('.menu');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open);
    });
  }
});
document.getElementById('year').textContent = new Date().getFullYear();
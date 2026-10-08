/* Shared shell + feedback helpers (vanilla JS, offline) */
(function () {
  'use strict';

  function icon(name) {
    var svg = '';
    if (name === 'check') {
      svg = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
    } else if (name === 'error') {
      svg = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    } else if (name === 'close') {
      svg = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    }
    return svg;
  }

  window.OD = window.OD || {};

  /* Toast (AC-17) */
  window.OD.toast = function (message, variant) {
    variant = variant || 'success';
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var el = document.createElement('div');
    el.className = 'toast toast-' + variant;
    el.setAttribute('role', variant === 'error' ? 'alert' : 'status');
    var iconEl = document.createElement('span');
    iconEl.className = 'toast-icon';
    iconEl.innerHTML = icon(variant === 'error' ? 'error' : 'check');
    var msg = document.createElement('span');
    msg.className = 'toast-msg';
    msg.textContent = message;
    var closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Schließen');
    closeBtn.innerHTML = icon('close');
    el.appendChild(iconEl);
    el.appendChild(msg);
    el.appendChild(closeBtn);

    container.appendChild(el);

    var timer;
    function dismiss() {
      el.remove();
      clearTimeout(timer);
    }
    function startTimer() {
      timer = setTimeout(dismiss, 5000);
    }
    closeBtn.addEventListener('click', dismiss);
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', startTimer);
    startTimer();
  };

  /* Dialogs */
  window.OD.openDialog = function (id) {
    var d = document.getElementById(id);
    if (!d) return;
    d.classList.add('open');
    document.body.style.overflow = 'hidden';
    var focusTarget = d.querySelector('[data-autofocus]') || d.querySelector('button, input, select, textarea');
    if (focusTarget) focusTarget.focus();
  };

  window.OD.closeDialog = function (id) {
    var d = document.getElementById(id);
    if (!d) return;
    d.classList.remove('open');
    document.body.style.overflow = '';
  };

  /* Mobile drawer + shell wiring */
  window.OD.initShell = function () {
    var sidebar = document.getElementById('sidebar');
    var backdrop = document.getElementById('backdrop');
    var menuBtn = document.getElementById('menu-btn');

    function close() {
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('show');
    }

    if (menuBtn) menuBtn.addEventListener('click', function () {
      if (sidebar) sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('show');
    });
    if (backdrop) backdrop.addEventListener('click', close);
    var navLinks = sidebar ? sidebar.querySelectorAll('.nav-item') : [];
    navLinks.forEach(function (a) { a.addEventListener('click', close); });
  };

  /* Generic modal close wiring (backdrop + close + cancel + escape) */
  window.OD.wireModals = function () {
    document.querySelectorAll('.modal').forEach(function (modal) {
      var id = modal.id;
      modal.addEventListener('click', function (e) {
        if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
          window.OD.closeDialog(id);
        }
      });
      modal.querySelectorAll('[data-close]').forEach(function (btn) {
        btn.addEventListener('click', function () { window.OD.closeDialog(id); });
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var open = document.querySelector('.modal.open');
        if (open) window.OD.closeDialog(open.id);
      }
    });
  };

  /* Simple field validation helper: mark .invalid + show .field-error on a field */
  window.OD.setFieldError = function (input, valid, message) {
    var field = input.closest('.field');
    if (!field) return valid;
    if (!valid) {
      field.classList.add('invalid');
      input.classList.add('invalid');
      input.setAttribute('aria-invalid', 'true');
      var err = field.querySelector('.field-error');
      if (err) err.textContent = message;
    } else {
      field.classList.remove('invalid');
      input.classList.remove('invalid');
      input.removeAttribute('aria-invalid');
    }
    return valid;
  };

  window.OD.clearFieldError = function (input) {
    var field = input.closest('.field');
    if (!field) return;
    field.classList.remove('invalid');
    input.classList.remove('invalid');
    input.removeAttribute('aria-invalid');
  };

  window.OD.validEmail = function (v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  };

  window.OD.initials = function (name) {
    var parts = (name || '').trim().split(/\s+/);
    if (!parts[0]) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
})();

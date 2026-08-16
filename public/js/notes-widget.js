/**
 * "+ Note" widget — a box for leaving myself notes while reading the site.
 *
 * Notes are POSTed to a Cloudflare Worker which appends them to D1. Nothing is
 * ever read back here: the point is to capture an idea without breaking
 * reading flow, and to collect it later straight from the database.
 *
 * The whole widget is injected from this one file, so no page template has to
 * carry markup for it.
 */
(function () {
  'use strict';

  // Set by the deploy workflow's follow-up commit. Until it points at a real
  // Worker, saving fails loudly rather than pretending to work.
  var WORKER_URL = 'https://markets-first-principles-notes.alessiomartini.workers.dev/notes';

  var MAX_TEXT = 2000;

  if (document.querySelector('.notes-widget')) return;

  var root = document.createElement('div');
  root.className = 'notes-widget';
  root.innerHTML = [
    '<button type="button" class="notes-widget__toggle" aria-expanded="false">+ Note</button>',
    '<div class="notes-widget__panel" hidden>',
    '  <label class="notes-widget__label" for="notes-widget-text">Note to self</label>',
    '  <textarea id="notes-widget-text" class="notes-widget__text" rows="5"',
    '    maxlength="' + MAX_TEXT + '" placeholder="What should change on this page?"></textarea>',
    // Honeypot: hidden from people, irresistible to form-filling bots. The
    // Worker discards anything that arrives with it filled in.
    '  <div class="notes-widget__hp" aria-hidden="true">',
    '    <label for="notes-widget-website">Website</label>',
    '    <input id="notes-widget-website" name="website" type="text" tabindex="-1" autocomplete="off">',
    '  </div>',
    '  <div class="notes-widget__row">',
    '    <button type="button" class="notes-widget__save">Save note</button>',
    '    <button type="button" class="notes-widget__cancel">Cancel</button>',
    '    <span class="notes-widget__status" role="status"></span>',
    '  </div>',
    '</div>',
  ].join('\n');

  document.body.appendChild(root);

  var toggle = root.querySelector('.notes-widget__toggle');
  var panel = root.querySelector('.notes-widget__panel');
  var text = root.querySelector('.notes-widget__text');
  var honeypot = root.querySelector('#notes-widget-website');
  var save = root.querySelector('.notes-widget__save');
  var cancel = root.querySelector('.notes-widget__cancel');
  var status = root.querySelector('.notes-widget__status');

  function setStatus(message, kind) {
    status.textContent = message;
    status.dataset.kind = kind || '';
  }

  function open() {
    panel.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    setStatus('');
    text.focus();
  }

  function close() {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    if (panel.hidden) open();
    else close();
  });

  cancel.addEventListener('click', function () {
    text.value = '';
    close();
  });

  // Escape is bound to the document, not to the panel.
  //
  // During a submit the save button is disabled, and disabling the focused
  // element moves focus to <body>. A listener scoped to the panel would stop
  // receiving key events at exactly that moment, so Escape would silently stop
  // working after a failed save — precisely when someone wants to dismiss the
  // box.
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !panel.hidden) close();
  });

  save.addEventListener('click', function () {
    var body = text.value.trim();
    if (!body) {
      setStatus('Write something first.', 'error');
      text.focus();
      return;
    }

    save.disabled = true;
    setStatus('Saving…');

    fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: body,
        page: location.pathname,
        website: honeypot.value,
      }),
    })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        text.value = '';
        setStatus('Saved.', 'ok');
        setTimeout(function () {
          if (!panel.hidden) close();
        }, 900);
      })
      .catch(function (error) {
        // Never fail silently: a note the reader believes was saved and was
        // not is worse than no note box at all.
        setStatus('Not saved — ' + error.message, 'error');
      })
      .finally(function () {
        save.disabled = false;
      });
  });
})();

// @bertui/dev — error-overlay.js
// Injected into the browser during dev. Plain JS, no dependencies, no build step.
// Called by HMR: window.__BERTUI_SHOW_ERROR__(data) / window.__BERTUI_HIDE_ERROR__()

(function () {
  'use strict';

  const OVERLAY_ID = '__bertui_error_overlay__';
  const STYLE_ID   = '__bertui_error_styles__';

  // ── Inject styles once ───────────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(8, 8, 14, 0.88);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        font-family: 'DM Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
        animation: __bertui_fadein 0.15s ease;
      }

      @keyframes __bertui_fadein {
        from { opacity: 0; transform: scale(0.98); }
        to   { opacity: 1; transform: scale(1); }
      }

      #${OVERLAY_ID} .be-card {
        background: #0f0f18;
        border: 1px solid rgba(232, 73, 138, 0.35);
        border-radius: 12px;
        max-width: 780px;
        width: 100%;
        max-height: 88vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        box-shadow:
          0 0 0 1px rgba(232,73,138,0.08),
          0 24px 64px rgba(0,0,0,0.6),
          0 0 80px rgba(232,73,138,0.06);
      }

      #${OVERLAY_ID} .be-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 20px;
        border-bottom: 1px solid rgba(232,73,138,0.15);
        background: rgba(232,73,138,0.06);
        flex-shrink: 0;
      }

      #${OVERLAY_ID} .be-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      #${OVERLAY_ID} .be-icon {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        background: rgba(232,73,138,0.2);
        border: 1.5px solid rgba(232,73,138,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        color: #e8498a;
        flex-shrink: 0;
      }

      #${OVERLAY_ID} .be-title {
        font-size: 12px;
        font-weight: 700;
        color: #e8498a;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      #${OVERLAY_ID} .be-badge {
        font-size: 10px;
        color: rgba(232,73,138,0.6);
        letter-spacing: 0.1em;
        text-transform: uppercase;
        padding: 2px 8px;
        border: 1px solid rgba(232,73,138,0.2);
        border-radius: 100px;
      }

      #${OVERLAY_ID} .be-close {
        background: none;
        border: none;
        color: rgba(240,238,255,0.3);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        padding: 4px 8px;
        border-radius: 6px;
        transition: color 0.15s, background 0.15s;
        font-family: inherit;
      }

      #${OVERLAY_ID} .be-close:hover {
        color: rgba(240,238,255,0.9);
        background: rgba(255,255,255,0.06);
      }

      #${OVERLAY_ID} .be-body {
        overflow-y: auto;
        flex: 1;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      #${OVERLAY_ID} .be-location {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: rgba(240,238,255,0.4);
        letter-spacing: 0.04em;
      }

      #${OVERLAY_ID} .be-location .be-file {
        color: #4cc9f0;
      }

      #${OVERLAY_ID} .be-location .be-line {
        color: rgba(76,201,240,0.6);
      }

      #${OVERLAY_ID} .be-message-block {
        background: rgba(232,73,138,0.05);
        border: 1px solid rgba(232,73,138,0.15);
        border-left: 3px solid #e8498a;
        border-radius: 0 8px 8px 0;
        padding: 14px 16px;
      }

      #${OVERLAY_ID} .be-message {
        font-size: 13px;
        color: #f0eeff;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-word;
      }

      #${OVERLAY_ID} .be-stack-label {
        font-size: 10px;
        color: rgba(240,238,255,0.25);
        letter-spacing: 0.15em;
        text-transform: uppercase;
        margin-bottom: 8px;
      }

      #${OVERLAY_ID} .be-stack {
        background: #080810;
        border: 1px solid rgba(42,42,58,0.8);
        border-radius: 8px;
        padding: 14px 16px;
        font-size: 11px;
        color: rgba(240,238,255,0.35);
        line-height: 1.8;
        white-space: pre-wrap;
        word-break: break-all;
        overflow-x: auto;
        max-height: 200px;
        overflow-y: auto;
      }

      #${OVERLAY_ID} .be-stack .be-stack-highlight {
        color: rgba(240,238,255,0.7);
      }

      #${OVERLAY_ID} .be-footer {
        padding: 12px 20px;
        border-top: 1px solid rgba(42,42,58,0.6);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(0,0,0,0.2);
      }

      #${OVERLAY_ID} .be-hint {
        font-size: 10px;
        color: rgba(240,238,255,0.2);
        letter-spacing: 0.08em;
      }

      #${OVERLAY_ID} .be-hint kbd {
        font-family: inherit;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 4px;
        padding: 1px 5px;
        color: rgba(240,238,255,0.4);
      }

      #${OVERLAY_ID} .be-wordmark {
        font-size: 10px;
        color: rgba(232,73,138,0.25);
        letter-spacing: 0.15em;
        text-transform: uppercase;
      }

      #${OVERLAY_ID} .be-body::-webkit-scrollbar,
      #${OVERLAY_ID} .be-stack::-webkit-scrollbar {
        width: 4px;
        height: 4px;
      }

      #${OVERLAY_ID} .be-body::-webkit-scrollbar-track,
      #${OVERLAY_ID} .be-stack::-webkit-scrollbar-track {
        background: transparent;
      }

      #${OVERLAY_ID} .be-body::-webkit-scrollbar-thumb,
      #${OVERLAY_ID} .be-stack::-webkit-scrollbar-thumb {
        background: rgba(232,73,138,0.25);
        border-radius: 2px;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Build overlay DOM ────────────────────────────────────────────────────

  function buildOverlay(data) {
    const el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Compilation error');

    const file    = data.file    || null;
    const line    = data.line    || null;
    const column  = data.column  || null;
    const message = data.message || 'Unknown error';
    const stack   = data.stack   || null;

    // Location string
    let locationHTML = '';
    if (file) {
      const lineCol = (line != null ? `:${line}` : '') + (column != null ? `:${column}` : '');
      locationHTML = `
        <div class="be-location">
          <span>in</span>
          <span class="be-file">${escapeHtml(file)}</span>
          ${lineCol ? `<span class="be-line">${escapeHtml(lineCol)}</span>` : ''}
        </div>
      `;
    }

    // Stack — highlight first user-land lines
    let stackHTML = '';
    if (stack) {
      const lines = stack.split('\n').slice(1); // drop first line (= message)
      const formatted = lines.map(l => {
        const isUserland = !l.includes('node_modules') && !l.includes('bun:');
        return isUserland
          ? `<span class="be-stack-highlight">${escapeHtml(l)}</span>`
          : escapeHtml(l);
      }).join('\n');

      stackHTML = `
        <div>
          <div class="be-stack-label">Stack trace</div>
          <div class="be-stack">${formatted}</div>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="be-card">
        <div class="be-header">
          <div class="be-title-row">
            <div class="be-icon">✕</div>
            <span class="be-title">Compilation Error</span>
            <span class="be-badge">Dev</span>
          </div>
          <button class="be-close" aria-label="Close error overlay">✕</button>
        </div>
        <div class="be-body">
          ${locationHTML}
          <div class="be-message-block">
            <div class="be-message">${escapeHtml(message)}</div>
          </div>
          ${stackHTML}
        </div>
        <div class="be-footer">
          <span class="be-hint">Fix the error and save — overlay clears automatically. <kbd>Esc</kbd> to dismiss.</span>
          <span class="be-wordmark">BertUI</span>
        </div>
      </div>
    `;

    return el;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.__BERTUI_SHOW_ERROR__ = function (data) {
    // Remove any existing overlay first
    window.__BERTUI_HIDE_ERROR__();

    injectStyles();

    const overlay = buildOverlay(data);
    document.body.appendChild(overlay);

    // Focus trap — close button
    const closeBtn = overlay.querySelector('.be-close');
    if (closeBtn) closeBtn.focus();

    // Log to console too so it's searchable
    console.groupCollapsed('[BertUI] Compilation Error' + (data.file ? ' — ' + data.file : ''));
    console.error(data.message);
    if (data.stack) console.log(data.stack);
    console.groupEnd();
  };

  window.__BERTUI_HIDE_ERROR__ = function () {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) existing.remove();
  };

  // ── Close handlers ───────────────────────────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') window.__BERTUI_HIDE_ERROR__();
  });

  document.addEventListener('click', function (e) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    // Close button
    if (e.target && e.target.classList.contains('be-close')) {
      window.__BERTUI_HIDE_ERROR__();
      return;
    }

    // Click on backdrop (outside the card)
    const card = overlay.querySelector('.be-card');
    if (card && !card.contains(e.target)) {
      window.__BERTUI_HIDE_ERROR__();
    }
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
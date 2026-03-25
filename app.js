// ═══════════════════════════════════════════════
// Hati Safi — app.js  (complete)
// ═══════════════════════════════════════════════

// ── ⚠️  FILL THESE IN ──────────────────────────
const SUPABASE_URL = null;
const SUPABASE_KEY = null;
// ───────────────────────────────────────────────

// ── SUPABASE ────────────────────────────────────
let db;
function initSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } catch (e) {
    console.error('Supabase init failed:', e);
  }
}

// ── SESSION ID ──────────────────────────────────
function getSessionId() {
  let sid = localStorage.getItem('hati_safi_session');
  if (!sid) {
    sid = 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    localStorage.setItem('hati_safi_session', sid);
  }
  return sid;
}

// ── SPLASH ──────────────────────────────────────
function hideSplashScreen() {
  const splash = document.getElementById('splash');
  const app    = document.getElementById('app');
  splash.style.transition = 'opacity 0.5s ease-out';
  splash.style.opacity = '0';
  setTimeout(() => {
    splash.style.display = 'none';
    app.style.display    = 'flex';
  }, 500);
}

// ── APP STARTUP ─────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  initSupabase();
  getSessionId();
  buildFAQ();
  setupPWA();
  setupDragDrop();
  await loadHistory();
  hideSplashScreen();
});

// ── STATE ────────────────────────────────────────
let currentFile = null;
let currentLang  = 'English';
let deferredInstallPrompt = null;

// ── PAGE NAVIGATION ──────────────────────────────
function switchPage(page, navId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById(navId).classList.add('active');
}

// ── LANGUAGE ─────────────────────────────────────
const LANGS = [
  { lang: 'English',   flag: '🇬🇧', code: 'EN' },
  { lang: 'Kiswahili', flag: '🇰🇪', code: 'SW' },
  { lang: 'Sheng',     flag: '🇰🇪', code: 'SH' },
];
let langIndex = 0;

function cycleLang() {
  langIndex = (langIndex + 1) % LANGS.length;
  applyLang(LANGS[langIndex]);
}

function setLang(el) {
  const l = LANGS.find(x => x.lang === el.dataset.lang) || LANGS[0];
  langIndex = LANGS.indexOf(l);
  applyLang(l);
  document.querySelectorAll('.lpill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}

function applyLang(l) {
  currentLang = l.lang;
  document.getElementById('langFlag').textContent = l.flag;
  document.getElementById('langCode').textContent = l.code;
  document.querySelectorAll('.lpill').forEach(p => {
    p.classList.toggle('active', p.dataset.lang === currentLang);
  });
}

// ── FILE HANDLING ─────────────────────────────────
function handleFile(event) {
  const file = event.target.files[0];
  if (file) setFile(file);
}

function setFile(file) {
  currentFile = file;
  const isImage = file.type.startsWith('image/');
  document.getElementById('fpIcon').textContent  = isImage ? '🖼️' : '📄';
  document.getElementById('fpName').textContent  = file.name;
  document.getElementById('fpSize').textContent  = formatSize(file.size);
  document.getElementById('filePill').style.display = 'flex';
  document.getElementById('dzInner').style.opacity  = '0.4';
}

function removeFile() {
  currentFile = null;
  document.getElementById('filePill').style.display = 'none';
  document.getElementById('dzInner').style.opacity   = '1';
  document.getElementById('fileInput').value = '';
}

function formatSize(bytes) {
  if (bytes < 1024)          return bytes + ' B';
  if (bytes < 1024 * 1024)   return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function setupDragDrop() {
  const dz = document.getElementById('dropzone');
  if (!dz) return;
  dz.addEventListener('dragover',  e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', ()  => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) setFile(file);
  });
}

// ── QUICK QUESTION CHIPS ──────────────────────────
function quickQ(el, text) {
  document.getElementById('qInput').value = text;
  document.querySelectorAll('.qchip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

// ── ANALYSE ───────────────────────────────────────
async function analyse() {
  if (!currentFile) { showToast('Please upload a document first'); return; }

  const maxSize = 3 * 1024 * 1024;
  if (currentFile.size > maxSize) {
    showToast('File too large — please use a file under 3MB');
    return;
  }

  const question = document.getElementById('qInput').value.trim();

  // Reset UI
  document.getElementById('results').style.display      = 'none';
  document.getElementById('errorShell').style.display   = 'none';
  document.getElementById('loadingShell').style.display = 'block';
  document.getElementById('analyseBtn').disabled = true;

  // Animate load steps
  const stepIds = ['ls1','ls2','ls3','ls4','ls5'];
  let stepIdx = 0;
  const stepTimer = setInterval(() => {
    if (stepIdx < stepIds.length) {
      document.getElementById(stepIds[stepIdx]).classList.add('active');
      stepIdx++;
    }
  }, 1800);

  setTimeout(() => { document.getElementById('webPulse').style.display = 'flex'; }, 5400);

  try {
    const base64 = await fileToBase64(currentFile);

    const res = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64: base64,
        fileType:   currentFile.type,
        question:   question || null,
        language:   currentLang,
      }),
    });

    // Safely parse response
    const text = await res.text();
    if (!text) throw new Error('Server timed out — please try again');
    const data = JSON.parse(text);
    if (!data.success) throw new Error(data.error || 'Analysis failed');

    clearInterval(stepTimer);
    document.getElementById('loadingShell').style.display = 'none';
    document.getElementById('webPulse').style.display     = 'none';
    document.getElementById('analyseBtn').disabled = false;

    await saveAnalysis(data.result, question);
    renderResults(data.result);
    await loadHistory();

  } catch (err) {
    clearInterval(stepTimer);
    document.getElementById('loadingShell').style.display = 'none';
    document.getElementById('webPulse').style.display     = 'none';
    document.getElementById('analyseBtn').disabled = false;
    document.getElementById('errorShell').style.display   = 'block';
    document.getElementById('errorBody').textContent = err.message || 'Please try again.';
    console.error('Analyse error:', err);
  }
}

// Compresses images before sending to stay under 4.5MB Vercel limit
async function fileToBase64(file) {
  if (file.type.startsWith('image/')) {
    return await compressImage(file);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 800;
      let w = img.width, h = img.height;
      if (w > h) { h = (h / w) * maxDim; w = maxDim; }
      else       { w = (w / h) * maxDim; h = maxDim; }
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
    };
    img.src = URL.createObjectURL(file);
  });
}

function resetError() {
  document.getElementById('errorShell').style.display = 'none';
}

// ── SAVE ANALYSIS ─────────────────────────────────
async function saveAnalysis(r, userQuestion) {
  if (!db) return;
  try {
    await db.from('analyses').insert({
      file_name:             currentFile?.name || null,
      file_type:             currentFile?.type || null,
      doc_type:              r.docType,
      language:              currentLang,
      risk:                  r.risk,
      risk_explanation:      r.riskExplanation,
      summary:               r.summary,
      answer_to_question:    r.answerToQuestion || null,
      key_terms:             r.keyTerms         || [],
      action_steps:          r.actionSteps      || [],
      deadlines:             r.deadlines        || [],
      help_resources:        r.helpResources    || [],
      web_sources:           r.webSources       || [],
      live_research_summary: r.liveResearchSummary || null,
      session_id:            getSessionId(),
      user_question:         userQuestion || null,
    });
  } catch (e) {
    console.error('Save analysis error:', e);
  }
}

// ── RENDER RESULTS ────────────────────────────────
function renderResults(r) {
  const riskColor = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' };
  const riskEmoji = { low: '🟢', medium: '🟡', high: '🔴' };
  const risk = r.risk || 'low';

  document.getElementById('docMetaBar').innerHTML =
    `<span class="dmt-type">${r.docType || 'Document'}</span>
     <span class="dmt-lang">${currentLang}</span>`;

  document.getElementById('riskBanner').innerHTML =
    `<div class="rb-inner" style="border-left:4px solid ${riskColor[risk]};padding:12px 16px;background:rgba(0,0,0,0.2);border-radius:8px;display:flex;gap:10px;align-items:flex-start">
       <span style="font-size:20px">${riskEmoji[risk]}</span>
       <div><strong>${risk.toUpperCase()} RISK</strong><p style="margin:4px 0 0;font-size:14px;opacity:.85">${r.riskExplanation || ''}</p></div>
     </div>`;

  if (r.webSources && r.webSources.length) {
    document.getElementById('webBadge').style.display = 'flex';
    document.getElementById('webBadgeSub').textContent =
      `${r.webSources.length} source${r.webSources.length > 1 ? 's' : ''} found`;
  }

  let html = '';
  if (r.summary)             html += card('📋 Summary', `<p>${r.summary}</p>`);
  if (r.answerToQuestion)    html += card('💬 Answer to Your Question', `<p>${r.answerToQuestion}</p>`);
  if (r.liveResearchSummary) html += card('🌐 Live Research', `<p>${r.liveResearchSummary}</p>`);
  if (r.actionSteps?.length)
    html += card('✅ What You Should Do', `<ol style="padding-left:18px">${r.actionSteps.map(s => `<li style="margin-bottom:6px">${s}</li>`).join('')}</ol>`);
  if (r.deadlines?.length)
    html += card('⏰ Important Deadlines', `<ul style="padding-left:18px">${r.deadlines.map(d => `<li style="margin-bottom:6px">${d}</li>`).join('')}</ul>`);
  if (r.keyTerms?.length)
    html += card('📖 Key Terms Explained', r.keyTerms.map(t =>
      `<div style="margin-bottom:10px"><strong>${t.term}</strong><p style="margin:4px 0 0;font-size:14px;opacity:.85">${t.definition}</p></div>`
    ).join(''));
  if (r.helpResources?.length)
    html += card('🤝 Where to Get Help', r.helpResources.map(h =>
      `<div class="help-item"><div class="hi-icon">${h.icon || '📞'}</div>
       <div class="hi-body"><div class="hi-name">${h.name}</div><div class="hi-desc">${h.description}</div></div></div>`
    ).join(''));

  document.getElementById('resultCards').innerHTML = html;

  if (r.webSources?.length) {
    document.getElementById('sourcesSection').style.display = 'block';
    document.getElementById('sourcesList').innerHTML = r.webSources.map(s =>
      `<a class="source-item" href="${s.url}" target="_blank" rel="noopener" style="display:block;margin-bottom:8px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);text-decoration:none">
         <div style="font-weight:600;font-size:13px">${s.title}</div>
         ${s.snippet ? `<div style="font-size:12px;opacity:.7;margin-top:4px">${s.snippet}</div>` : ''}
         <div style="font-size:11px;opacity:.5;margin-top:4px">${s.url}</div>
       </a>`
    ).join('');
  }

  document.getElementById('results').style.display = 'block';
  document.getElementById('results').scrollIntoView({ behavior: 'smooth' });
}

function card(title, content) {
  return `<div class="card result-card" style="margin-bottom:12px">
    <div class="card-label">${title}</div>
    ${content}
  </div>`;
}

// ── LOAD HISTORY ──────────────────────────────────
async function loadHistory() {
  if (!db) return;
  try {
    const { data, error } = await db
      .from('analyses')
      .select('id, created_at, doc_type, risk, summary, file_name, language')
      .eq('session_id', getSessionId())
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    const list     = document.getElementById('historyList');
    const clearBtn = document.getElementById('clearHistBtn');
    const badge    = document.getElementById('dbStatusBadge');

    if (!data || data.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="es-icon">🗂️</div>
          <div class="es-title">No documents yet</div>
          <div class="es-sub">Analysed documents will appear here</div>
        </div>`;
      clearBtn.style.display = 'none';
      return;
    }

    badge.style.display    = 'flex';
    clearBtn.style.display = 'inline-flex';

    const riskEmoji = { low: '🟢', medium: '🟡', high: '🔴' };
    list.innerHTML = data.map(item => `
      <div class="card" style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <span style="font-weight:600;font-size:14px">${item.doc_type}</span>
          <span style="font-size:12px">${riskEmoji[item.risk] || ''} ${(item.risk || '').toUpperCase()}</span>
        </div>
        ${item.file_name ? `<div style="font-size:12px;opacity:.6;margin-bottom:6px">📄 ${item.file_name}</div>` : ''}
        <div style="font-size:13px;opacity:.8">${(item.summary || '').slice(0, 120)}…</div>
        <div style="font-size:11px;opacity:.5;margin-top:8px">${new Date(item.created_at).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' })}</div>
      </div>`
    ).join('');

  } catch (e) {
    console.error('Load history error:', e);
  }
}

async function clearHistory() {
  if (!confirm('Clear all your document history?')) return;
  if (!db) return;
  try {
    await db.from('analyses').delete().eq('session_id', getSessionId());
    await loadHistory();
    showToast('History cleared');
  } catch (e) {
    showToast('Could not clear history');
  }
}

// ── ASK LEGAL QUESTION ────────────────────────────
async function askLegalQuestion() {
  const q = document.getElementById('legalQInput').value.trim();
  if (!q) { showToast('Please enter a question'); return; }

  document.getElementById('lqLoading').style.display  = 'block';
  document.getElementById('lqResults').innerHTML      = '';
  document.getElementById('legalQBtn').disabled       = true;

  try {
    const res = await fetch('/api/legal-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, language: currentLang }),
    });

    const text = await res.text();
    if (!text) throw new Error('Server timed out — please try again');
    const data = JSON.parse(text);
    if (!data.success) throw new Error(data.error);

    const r = data.result;

    if (db) {
      await db.from('legal_searches').insert({
        question: q, language: currentLang,
        headline: r.headline, answer: r.answer,
        steps: r.steps || [], contacts: r.contacts || [],
        sources: r.sources || [], session_id: getSessionId(),
      }).catch(console.error);
    }

    let html = '';
    if (r.headline) html += `<div style="font-size:18px;font-weight:700;margin:12px 0">${r.headline}</div>`;
    if (r.answer)   html += card('📋 Answer', `<p>${r.answer}</p>`);
    if (r.steps?.length)
      html += card('✅ Steps to Take', `<ol style="padding-left:18px">${r.steps.map(s => `<li style="margin-bottom:6px">${s}</li>`).join('')}</ol>`);
    if (r.contacts?.length)
      html += card('📞 Contacts', r.contacts.map(c =>
        `<div class="help-item"><div class="hi-icon">${c.icon || '📞'}</div>
         <div class="hi-body"><div class="hi-name">${c.name}</div><div class="hi-desc">${c.detail}</div></div></div>`
      ).join(''));
    if (r.sources?.length)
      html += card('🔗 Sources', r.sources.map(s =>
        `<a href="${s.url}" target="_blank" rel="noopener" style="display:block;margin-bottom:8px;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);text-decoration:none">
           <div style="font-weight:600;font-size:13px">${s.title}</div>
           ${s.snippet ? `<div style="font-size:12px;opacity:.7;margin-top:4px">${s.snippet}</div>` : ''}
         </a>`
      ).join(''));

    document.getElementById('lqResults').innerHTML = html;

  } catch (e) {
    document.getElementById('lqResults').innerHTML =
      `<div class="error-shell" style="display:block">
         <div class="error-icon">⚠️</div>
         <div class="error-body">${e.message}</div>
       </div>`;
  } finally {
    document.getElementById('lqLoading').style.display = 'none';
    document.getElementById('legalQBtn').disabled      = false;
  }
}

// ── TOAST ─────────────────────────────────────────
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

// ── UTILITIES ─────────────────────────────────────
function callNumber(num) {
  window.location.href = 'tel:' + num;
}

// ── FAQ ───────────────────────────────────────────
const FAQS = [
  { q: 'What documents can Hati Safi analyse?', a: 'Any Kenyan government document — KRA notices, HELB letters, SHA forms, court summons, tender documents, employment letters, and more.' },
  { q: 'Is my document stored anywhere?', a: 'Only the extracted analysis is saved — your original file is never stored on our servers.' },
  { q: 'Is this legal advice?', a: 'No. Hati Safi provides AI-generated explanations for educational purposes. For serious matters, consult a qualified advocate or legal aid organisation.' },
  { q: 'Does it work offline?', a: 'The app shell works offline, but document analysis requires internet to process through AI.' },
  { q: 'How accurate is the analysis?', a: 'Hati Safi uses AI with live web research from official Kenyan sources. Always verify important legal details with a professional.' },
];

function buildFAQ() {
  const container = document.getElementById('faqAccordion');
  if (!container) return;
  container.innerHTML = FAQS.map((item, i) => `
    <div class="card" style="margin-bottom:8px">
      <button onclick="toggleFAQ(${i})" style="width:100%;text-align:left;background:none;border:none;color:inherit;cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:0;font-size:14px;font-weight:600">
        <span>${item.q}</span>
        <span id="faq-arrow-${i}" style="transition:transform 0.2s;font-size:18px">›</span>
      </button>
      <div id="faq-a-${i}" style="display:none;margin-top:10px;font-size:13px;opacity:.85;line-height:1.6">${item.a}</div>
    </div>`
  ).join('');
}

function toggleFAQ(i) {
  const ans   = document.getElementById('faq-a-' + i);
  const arrow = document.getElementById('faq-arrow-' + i);
  const open  = ans.style.display !== 'none';
  ans.style.display     = open ? 'none' : 'block';
  arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
}

// ── PWA INSTALL ───────────────────────────────────
function setupPWA() {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('installBanner').style.display = 'flex';
  });
}

function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(() => {
    deferredInstallPrompt = null;
    document.getElementById('installBanner').style.display = 'none';
  });
}

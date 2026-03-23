/* ══════════════════════════════════════════════════
   HATI SAFI v2 — app.js
   Uses Netlify Functions (secure API proxy) + Supabase DB
   ══════════════════════════════════════════════════ */

'use strict';

/* ─────────────────────────────────────────────────
   ⚙️  CONFIGURATION
   Replace these two values after setting up Supabase
   ───────────────────────────────────────────────── */
const SUPABASE_URL  = 'REPLACE_WITH_YOUR_SUPABASE_URL';   // e.g. https://xyzabc.supabase.co
const SUPABASE_ANON = 'REPLACE_WITH_YOUR_SUPABASE_ANON_KEY'; // starts with "eyJ..."

/* ─────────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────────── */
const LANGS      = ['English','Kiswahili','Sheng'];
const LANG_FLAGS = { English:'🇬🇧', Kiswahili:'🇰🇪', Sheng:'🇰🇪' };
const LANG_CODES = { English:'EN', Kiswahili:'SW', Sheng:'SH' };

const LOAD_STEPS = [
  { id:'ls1', msg:'Reading document content',            sub:'Extracting text and structure' },
  { id:'ls2', msg:'Identifying document type',           sub:'Classifying document category' },
  { id:'ls3', msg:'Searching Kenya laws online',         sub:'Live web research in progress…' },
  { id:'ls4', msg:'Fetching official government sources',sub:'Verifying from sha.go.ke, helb.co.ke, kra.go.ke' },
  { id:'ls5', msg:'Saving to database',                  sub:'Storing results for your history' },
];

const WEB_SEARCHES = [
  'Searching: Kenya SHA regulations 2024…',
  'Searching: HELB loan repayment Kenya…',
  'Searching: Kenya government tender requirements…',
  'Searching: Kenya court summons procedure…',
  'Searching: KRA tax appeal process Kenya…',
  'Fetching: sha.go.ke official guidelines…',
  'Fetching: helb.co.ke official policy…',
  'Fetching: ppra.go.ke procurement rules…',
  'Verifying: Kenya law portal sources…',
];

const FAQS = [
  { q:'Is my document kept private?', a:'Yes. Your document is sent securely to our AI and immediately discarded after analysis. We only store the text result — never the original file. Your session ID is anonymous.' },
  { q:'What types of documents can I upload?', a:'PDF files, JPG and PNG images, or photos taken with your phone camera. This includes scanned letters, official PDF downloads from government portals, and photos of paper documents.' },
  { q:'What is SHA (Social Health Authority)?', a:'SHA replaced NHIF as Kenya\'s national health insurer in October 2023. It covers Kenyans under the Social Health Insurance Fund (SHIF). Register at any Huduma Centre or via the MySHA app. Helpline: 0800 720 601.' },
  { q:'What is HELB?', a:'The Higher Education Loans Board (HELB) provides loans, bursaries and scholarships to Kenyan students. A HELB letter may concern your loan application, disbursement, repayment, or a default notice. Contact: 0703 054 200.' },
  { q:'I received a court summons. What must I do?', a:'Do not ignore it. You must appear in court on the specified date. Ignoring it can result in a warrant of arrest. Contact Kituo Cha Sheria (0800 720 519) or NLAS (0800 723 151) immediately.' },
  { q:'I won a government tender. What happens next?', a:'You will receive a Contract Agreement to sign including performance bond requirements (usually 10% of contract value), delivery timelines, and payment milestones. Upload it to Hati Safi to understand every clause.' },
  { q:'Can I use this app in Kiswahili?', a:'Yes! Select "Kiswahili" in Step 3 before analysing your document. The full explanation will be delivered in Kiswahili. Sheng is also available.' },
  { q:'How is my history saved?', a:'Your analysis results are saved to our secure database (Supabase) using an anonymous session ID. This means your history is available even if you clear your browser or switch devices — as long as you use the same session link.' },
];

/* ─────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────── */
let supabase       = null;
let selectedFile   = null;
let selectedLang   = 'English';
let langIndex      = 0;
let isAnalysing    = false;
let stepTimer      = null;
let webPulseTimer  = null;
let deferredPrompt = null;
let sessionId      = localStorage.getItem('hs_session') || generateSessionId();

/* ─────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {

  // Save session ID
  localStorage.setItem('hs_session', sessionId);

  // Init Supabase
  initSupabase();

  // Splash
  setTimeout(() => {
    document.getElementById('splash').classList.add('fade');
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    }, 500);
  }, 2200);

  buildFAQ();
  setupDragDrop();
  loadHistory();

  // PWA install
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('installBanner').style.display = 'flex';
  });
});

function generateSessionId() {
  return 'hs_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function initSupabase() {
  try {
    if (SUPABASE_URL !== 'REPLACE_WITH_YOUR_SUPABASE_URL' && window.supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
      console.log('✅ Supabase connected');
      document.getElementById('dbStatusBadge').style.display = 'flex';
    } else {
      console.log('ℹ️ Supabase not configured — using localStorage fallback');
    }
  } catch (e) {
    console.warn('Supabase init failed, using localStorage:', e);
  }
}

/* ─────────────────────────────────────────────────
   NAVIGATION
   ───────────────────────────────────────────────── */
function switchPage(page, btnId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bnav-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById(btnId).classList.add('active');
  if (page === 'history') loadHistory();
}

/* ─────────────────────────────────────────────────
   LANGUAGE
   ───────────────────────────────────────────────── */
function cycleLang() {
  langIndex = (langIndex + 1) % LANGS.length;
  selectLangByName(LANGS[langIndex]);
}
function setLang(btn) { selectLangByName(btn.dataset.lang); }
function selectLangByName(lang) {
  selectedLang = lang;
  document.querySelectorAll('.lpill').forEach(p => p.classList.toggle('active', p.dataset.lang === lang));
  document.getElementById('langFlag').textContent = LANG_FLAGS[lang];
  document.getElementById('langCode').textContent = LANG_CODES[lang];
}

/* ─────────────────────────────────────────────────
   FILE HANDLING
   ───────────────────────────────────────────────── */
function handleFile(e) { const f = e.target.files[0]; if (f) setFile(f); }

function setFile(file) {
  selectedFile = file;
  document.getElementById('fpIcon').textContent = file.type.startsWith('image/') ? '🖼️' : '📄';
  document.getElementById('fpName').textContent = file.name;
  document.getElementById('fpSize').textContent = formatSize(file.size);
  document.getElementById('filePill').style.display = 'flex';
}
function removeFile() {
  selectedFile = null;
  document.getElementById('filePill').style.display = 'none';
  document.getElementById('fileInput').value = '';
}
function formatSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  return (b/1048576).toFixed(1) + ' MB';
}
function setupDragDrop() {
  const dz = document.getElementById('dropzone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('over'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) setFile(f); });
}

/* ─────────────────────────────────────────────────
   QUICK PROMPTS
   ───────────────────────────────────────────────── */
function quickQ(btn, text) {
  document.querySelectorAll('.qchip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('qInput').value = text;
}

/* ─────────────────────────────────────────────────
   LOADING ANIMATION
   ───────────────────────────────────────────────── */
function startLoadAnim() {
  let i = 0;
  LOAD_STEPS.forEach(s => document.getElementById(s.id).className = 'lstep');
  document.getElementById('ls1').classList.add('active');

  stepTimer = setInterval(() => {
    document.getElementById(LOAD_STEPS[i].id).className = 'lstep done';
    i++;
    if (i < LOAD_STEPS.length) {
      document.getElementById(LOAD_STEPS[i].id).classList.add('active');
      document.getElementById('loadTitle').textContent = LOAD_STEPS[i].msg;
      document.getElementById('loadSub').textContent   = LOAD_STEPS[i].sub;

      if (i === 2 || i === 3) {
        const wp = document.getElementById('webPulse');
        wp.style.display = 'flex';
        let wi = 0;
        webPulseTimer = setInterval(() => {
          document.getElementById('wpText').textContent = WEB_SEARCHES[wi % WEB_SEARCHES.length];
          wi++;
        }, 1800);
      }
    } else {
      clearInterval(stepTimer);
    }
  }, 2200);
}

function stopLoadAnim() {
  clearInterval(stepTimer);
  clearInterval(webPulseTimer);
  document.getElementById('webPulse').style.display = 'none';
}

/* ─────────────────────────────────────────────────
   FILE → BASE64
   ───────────────────────────────────────────────── */
function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ─────────────────────────────────────────────────
   MAIN ANALYSE — calls /api/analyse (Netlify function)
   ───────────────────────────────────────────────── */
async function analyse() {
  if (isAnalysing) return;
  if (!selectedFile) { showToast('⚠️ Please upload a document first'); return; }

  isAnalysing = true;
  document.getElementById('analyseBtn').disabled = true;
  document.getElementById('results').style.display = 'none';
  document.getElementById('errorShell').style.display = 'none';
  document.getElementById('loadingShell').style.display = 'block';
  startLoadAnim();

  try {
    const b64 = await toBase64(selectedFile);
    const question = document.getElementById('qInput').value.trim();

    // POST to Netlify Function
    const resp = await fetch('/api/analyse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64: b64,
        fileType:   selectedFile.type,
        question,
        language:   selectedLang,
      }),
    });

    stopLoadAnim();
    document.getElementById('loadingShell').style.display = 'none';

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err?.error || `Server error ${resp.status}`);
    }

    const { success, result, error } = await resp.json();
    if (!success) throw new Error(error || 'Analysis failed');

    // Save to Supabase (or localStorage fallback)
    await saveAnalysis(result, question);

    renderResults(result, question);

  } catch (err) {
    stopLoadAnim();
    document.getElementById('loadingShell').style.display = 'none';
    document.getElementById('errorBody').textContent = err.message || 'Unknown error. Please try again.';
    document.getElementById('errorShell').style.display = 'block';
  } finally {
    isAnalysing = false;
    document.getElementById('analyseBtn').disabled = false;
  }
}

/* ─────────────────────────────────────────────────
   SAVE ANALYSIS TO SUPABASE (or localStorage fallback)
   ───────────────────────────────────────────────── */
async function saveAnalysis(data, question) {
  const record = {
    session_id:            sessionId,
    file_name:             selectedFile?.name || 'document',
    file_type:             selectedFile?.type || 'unknown',
    doc_type:              data.docType,
    language:              selectedLang,
    risk:                  data.risk,
    risk_explanation:      data.riskExplanation,
    summary:               data.summary,
    answer_to_question:    data.answerToQuestion || '',
    key_terms:             data.keyTerms || [],
    action_steps:          data.actionSteps || [],
    deadlines:             data.deadlines || [],
    help_resources:        data.helpResources || [],
    web_sources:           data.webSources || [],
    live_research_summary: data.liveResearchSummary || '',
    user_question:         question || '',
  };

  if (supabase) {
    try {
      const { error } = await supabase.from('analyses').insert([record]);
      if (error) throw error;
      console.log('✅ Saved to Supabase');
      showToast('💾 Saved to database');
    } catch (e) {
      console.warn('Supabase save failed, falling back to localStorage:', e);
      saveToLocal(record);
    }
  } else {
    saveToLocal(record);
  }
}

function saveToLocal(record) {
  const history = JSON.parse(localStorage.getItem('hs_history') || '[]');
  history.unshift({ ...record, id: Date.now(), created_at: new Date().toISOString() });
  localStorage.setItem('hs_history', JSON.stringify(history.slice(0, 30)));
}

/* ─────────────────────────────────────────────────
   LOAD HISTORY
   ───────────────────────────────────────────────── */
async function loadHistory() {
  let items = [];

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('id,doc_type,risk,summary,file_name,created_at,language,key_terms,action_steps,deadlines,help_resources,web_sources,live_research_summary,answer_to_question')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      items = data || [];
    } catch (e) {
      console.warn('Supabase load failed:', e);
      items = JSON.parse(localStorage.getItem('hs_history') || '[]');
    }
  } else {
    items = JSON.parse(localStorage.getItem('hs_history') || '[]');
  }

  renderHistory(items);
}

function renderHistory(items) {
  const el = document.getElementById('historyList');
  const clearBtn = document.getElementById('clearHistBtn');

  if (!items || !items.length) {
    el.innerHTML = `<div class="empty-state"><div class="es-icon">🗂️</div><div class="es-title">No documents yet</div><div class="es-sub">Analysed documents will appear here</div></div>`;
    clearBtn.style.display = 'none';
    return;
  }

  clearBtn.style.display = 'block';
  el.innerHTML = items.map(h => `
    <div class="hist-item" onclick='reloadItem(${JSON.stringify(JSON.stringify(h))})'>
      <div class="hist-doctype">${esc(h.doc_type || h.docType)}</div>
      <div class="hist-meta">
        <span class="hist-risk risk-${h.risk}">${capitalize(h.risk)} Risk</span>
        <span>·</span><span>${esc(h.file_name || 'Document')}</span>
        <span>·</span><span>${formatDate(h.created_at)}</span>
      </div>
      <div class="hist-summary">${esc((h.summary||'').substring(0,130))}…</div>
    </div>`).join('');
}

function reloadItem(jsonStr) {
  try {
    const h = JSON.parse(jsonStr);
    // Normalise field names (db uses snake_case, result uses camelCase)
    const result = {
      docType:              h.doc_type || h.docType,
      risk:                 h.risk,
      riskExplanation:      h.risk_explanation || h.riskExplanation,
      summary:              h.summary,
      answerToQuestion:     h.answer_to_question || h.answerToQuestion || '',
      keyTerms:             h.key_terms || h.keyTerms || [],
      actionSteps:          h.action_steps || h.actionSteps || [],
      deadlines:            h.deadlines || [],
      helpResources:        h.help_resources || h.helpResources || [],
      webSources:           h.web_sources || h.webSources || [],
      liveResearchSummary:  h.live_research_summary || h.liveResearchSummary || '',
    };
    switchPage('home','bnav-home');
    setTimeout(() => { renderResults(result, ''); showToast('📂 Loaded from history'); }, 200);
  } catch(e) { console.error(e); }
}

function clearHistory() {
  if (!confirm('Clear all history?')) return;
  localStorage.removeItem('hs_history');
  if (supabase) {
    supabase.from('analyses').delete().eq('session_id', sessionId).then(() => loadHistory());
  } else {
    loadHistory();
  }
}

function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-KE', { day:'numeric', month:'short', year:'numeric' }); }
  catch { return iso; }
}

/* ─────────────────────────────────────────────────
   RENDER RESULTS
   ───────────────────────────────────────────────── */
function renderResults(d, question) {
  document.getElementById('docMetaBar').innerHTML = `
    <div class="dmb-icon">📄</div>
    <div class="dmb-text">
      <div class="dmb-type">${esc(d.docType)}</div>
      <div class="dmb-sub">AI analysis with live web research</div>
    </div>`;

  const rClass = d.risk === 'high' ? 'rb-high' : d.risk === 'medium' ? 'rb-medium' : 'rb-low';
  const rEmoji = d.risk === 'high' ? '🔴' : d.risk === 'medium' ? '🟡' : '🟢';
  const rLabel = d.risk === 'high' ? 'High Risk' : d.risk === 'medium' ? 'Medium Risk' : 'Low Risk';
  const rb = document.getElementById('riskBanner');
  rb.className = `risk-banner ${rClass}`;
  rb.innerHTML = `<span class="rb-icon">${rEmoji}</span><div class="rb-body"><div class="rb-level">${rLabel}</div><div class="rb-text">${esc(d.riskExplanation)}</div></div>`;

  if (d.liveResearchSummary || (d.webSources && d.webSources.length)) {
    document.getElementById('webBadge').style.display = 'flex';
    document.getElementById('webBadgeSub').textContent = d.liveResearchSummary || `${(d.webSources||[]).length} sources verified`;
  }

  const cards = [];

  // Summary
  let summaryHTML = `<p>${esc(d.summary)}</p>`;
  if (d.answerToQuestion) summaryHTML += `<div class="qa-box mt12"><div class="qa-label">💬 Your Question Answered</div><div class="qa-text">${esc(d.answerToQuestion)}</div></div>`;
  if (d.liveResearchSummary) summaryHTML += `<div class="qa-box mt12"><div class="qa-label">🌐 Live Research Found</div><div class="qa-text">${esc(d.liveResearchSummary)}</div></div>`;
  cards.push(makeCard('📋','rch-gold','Plain-Language Summary','What this document means for you', summaryHTML, true));

  // Key Terms
  if (d.keyTerms && d.keyTerms.length) {
    const items = d.keyTerms.map(t=>`<div class="term-item"><div class="term-name">${esc(t.term)}</div><div class="term-def">${esc(t.definition)}</div></div>`).join('');
    cards.push(makeCard('📖','rch-blue','Key Terms Explained',`${d.keyTerms.length} important terms defined`,`<div class="term-list">${items}</div>`));
  }

  // Action Steps
  if (d.actionSteps && d.actionSteps.length) {
    const items = d.actionSteps.map((s,i)=>`<div class="action-item"><div class="action-num">${i+1}</div><div class="action-txt">${esc(s)}</div></div>`).join('');
    cards.push(makeCard('✅','rch-green','What To Do Next',`${d.actionSteps.length} clear steps`,`<div class="action-list">${items}</div>`));
  }

  // Deadlines
  if (d.deadlines && d.deadlines.length) {
    const items = d.deadlines.map(dl=>`<div class="deadline-item"><span class="deadline-icon">⏰</span><div class="deadline-txt">${esc(dl)}</div></div>`).join('');
    cards.push(makeCard('📅','rch-red','Important Dates & Deadlines','Do not miss these',`<div class="deadline-list">${items}</div>`));
  }

  // Help Resources
  const defaultHelp = [
    { name:'Kituo Cha Sheria', description:'Free legal aid · 0800 720 519', icon:'⚖️' },
    { name:'National Legal Aid Service', description:'Government free legal aid · 0800 723 151', icon:'🏛️' },
  ];
  const helpItems = [...(d.helpResources||[]), ...defaultHelp].slice(0,5);
  const helpHTML = `<div class="help-cards">${helpItems.map(h=>`<div class="help-card" onclick="callNumber('${extractPhone(h.description)}')"><div class="hc-icon">${h.icon||'📞'}</div><div class="hc-body"><div class="hc-name">${esc(h.name)}</div><div class="hc-desc">${esc(h.description)}</div></div><span class="hc-arrow">›</span></div>`).join('')}</div>`;
  cards.push(makeCard('🤝','rch-purple','Where To Get Help','Organisations that can assist you', helpHTML));

  document.getElementById('resultCards').innerHTML = cards.join('');

  // Sources
  if (d.webSources && d.webSources.length) {
    document.getElementById('sourcesList').innerHTML = d.webSources.map((s,i)=>`
      <div class="source-item">
        <div class="src-num">${i+1}</div>
        <div class="src-body">
          <div class="src-title">${esc(s.title||'Source')}</div>
          <div class="src-url">${esc(s.url||'')}</div>
          ${s.snippet?`<div class="src-snippet">${esc(s.snippet)}</div>`:''}
        </div>
      </div>`).join('');
    document.getElementById('sourcesSection').style.display = 'block';
  }

  document.getElementById('results').style.display = 'block';
  setTimeout(()=>document.getElementById('results').scrollIntoView({behavior:'smooth',block:'start'}),80);
}

function makeCard(icon, iconCls, title, sub, bodyHTML, open=false) {
  return `<div class="rcard">
    <div class="rcard-header${open?' open':''}" onclick="toggleCard(this)">
      <div class="rcard-header-icon ${iconCls}">${icon}</div>
      <div class="rcard-header-txt"><div class="rcard-title">${title}</div><div class="rcard-sub">${sub}</div></div>
      <span class="rcard-chevron">▾</span>
    </div>
    <div class="rcard-body${open?' open':''}">${bodyHTML}</div>
  </div>`;
}

function toggleCard(h) { h.classList.toggle('open'); h.nextElementSibling.classList.toggle('open'); }

/* ─────────────────────────────────────────────────
   LEGAL QUESTION — calls /api/legal-question
   ───────────────────────────────────────────────── */
async function askLegalQuestion() {
  const q = document.getElementById('legalQInput').value.trim();
  if (!q) { showToast('Please type your question first'); return; }

  const btn = document.getElementById('legalQBtn');
  btn.disabled = true;
  document.getElementById('lqLoading').style.display = 'block';
  document.getElementById('lqResults').innerHTML = '';

  try {
    const resp = await fetch('/api/legal-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, language: selectedLang }),
    });

    document.getElementById('lqLoading').style.display = 'none';
    if (!resp.ok) throw new Error(`Server error ${resp.status}`);

    const { success, result, error } = await resp.json();
    if (!success) throw new Error(error || 'Search failed');

    // Save to Supabase
    if (supabase) {
      await supabase.from('legal_searches').insert([{
        session_id: sessionId,
        question: q,
        language: selectedLang,
        headline: result.headline,
        answer: result.answer,
        steps: result.steps || [],
        contacts: result.contacts || [],
        sources: result.sources || [],
      }]).catch(console.warn);
    }

    // Render result
    const stepsHTML = result.steps?.length
      ? `<div class="action-list mt12">${result.steps.map((s,i)=>`<div class="action-item"><div class="action-num">${i+1}</div><div class="action-txt">${esc(s)}</div></div>`).join('')}</div>` : '';
    const contactsHTML = result.contacts?.length
      ? `<div style="margin-top:14px"><div class="card-label">Contacts & Help</div><div class="help-cards">${result.contacts.map(c=>`<div class="help-card"><div class="hc-icon">${c.icon||'📞'}</div><div class="hc-body"><div class="hc-name">${esc(c.name)}</div><div class="hc-desc">${esc(c.detail)}</div></div><span class="hc-arrow">›</span></div>`).join('')}</div></div>` : '';
    const srcsHTML = result.sources?.length
      ? `<div class="sources-section mt12"><div class="sources-header"><span class="sources-icon">🔗</span> Online Sources</div>${result.sources.map((s,i)=>`<div class="source-item"><div class="src-num">${i+1}</div><div class="src-body"><div class="src-title">${esc(s.title||'Source')}</div><div class="src-url">${esc(s.url||'')}</div>${s.snippet?`<div class="src-snippet">${esc(s.snippet)}</div>`:''}</div></div>`).join('')}</div>` : '';

    document.getElementById('lqResults').innerHTML = `
      <div class="lq-result">
        <h3>${esc(result.headline||'Answer')}</h3>
        <p>${esc(result.answer)}</p>
        ${stepsHTML}${contactsHTML}${srcsHTML}
      </div>`;

  } catch (err) {
    document.getElementById('lqLoading').style.display = 'none';
    document.getElementById('lqResults').innerHTML = `<div class="error-shell" style="display:block"><div class="error-icon">⚠️</div><div class="error-title">Search failed</div><div class="error-body">${esc(err.message)}</div></div>`;
  } finally {
    btn.disabled = false;
  }
}

/* ─────────────────────────────────────────────────
   FAQ
   ───────────────────────────────────────────────── */
function buildFAQ() {
  document.getElementById('faqAccordion').innerHTML = FAQS.map(f=>`
    <div class="faq-item">
      <div class="faq-q" onclick="toggleFaq(this)">${esc(f.q)}<span>▾</span></div>
      <div class="faq-a">${esc(f.a)}</div>
    </div>`).join('');
}
function toggleFaq(el) { el.classList.toggle('open'); el.nextElementSibling.classList.toggle('open'); }

/* ─────────────────────────────────────────────────
   PWA INSTALL
   ───────────────────────────────────────────────── */
function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(c => {
      if (c.outcome === 'accepted') showToast('✅ Hati Safi installed!');
      deferredPrompt = null;
      document.getElementById('installBanner').style.display = 'none';
    });
  } else {
    showToast('📲 Use browser menu → Add to Home Screen');
  }
}

/* ─────────────────────────────────────────────────
   UTILITIES
   ───────────────────────────────────────────────── */
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function capitalize(s) { return s ? s[0].toUpperCase()+s.slice(1) : ''; }
function extractPhone(str) { const m=(str||'').match(/[\d\s]{9,}/); return m?m[0].replace(/\s/g,''):''; }
function callNumber(num) { if (num && num.length >= 9) window.location.href='tel:'+num; }
function resetError() { document.getElementById('errorShell').style.display='none'; }

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
}

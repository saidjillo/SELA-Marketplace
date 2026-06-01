/**
 * auth.js — SELA User Auth System
 * Provides: register, verify-email, login, forgot-password, reset-password
 * Injects modals on any page that needs them.
 * Usage: <script src="auth.js"></script>
 */
(function() {
  'use strict';

  const API = window.API || 'http://localhost:5000/api';

  // ── Persist user session ──────────────────────────────────────────────────
  window._acUser = {
    getToken:    () => localStorage.getItem('ac_user_token'),
    getUser:     () => { try { return JSON.parse(localStorage.getItem('ac_user')||'null'); } catch { return null; } },
    setSession:  (token, user) => { localStorage.setItem('ac_user_token', token); localStorage.setItem('ac_user', JSON.stringify(user)); },
    clearSession:() => { localStorage.removeItem('ac_user_token'); localStorage.removeItem('ac_user'); },
    isLoggedIn:  () => !!localStorage.getItem('ac_user_token'),
  };

  // ── CSS ──────────────────────────────────────────────────────────────────
  if (!document.getElementById('ac-auth-style')) {
    const st = document.createElement('style');
    st.id = 'ac-auth-style';
    st.textContent = `
.ac-auth-overlay{position:fixed;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(10px);z-index:3000;display:none;align-items:center;justify-content:center;padding:1rem}
.ac-auth-overlay.open{display:flex;animation:acAuthFade .22s ease}
@keyframes acAuthFade{from{opacity:0}to{opacity:1}}
.ac-auth-modal{background:#111520;border:1px solid #252f47;border-radius:20px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 32px 80px rgba(0,0,0,.7);max-height:90vh;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#252f47 transparent}
.ac-auth-head{background:linear-gradient(135deg,#0d1525,#161b27);padding:1.5rem 1.5rem 1.25rem;border-bottom:1px solid #252f47;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:1}
.ac-auth-logo{display:flex;align-items:center;gap:.4rem;font-family:'Montserrat',sans-serif;font-size:.95rem;font-weight:800;color:#e8edf5}
.ac-auth-logo-dot{color:#00d4ff}
.ac-auth-x{background:rgba(255,255,255,.06);border:none;color:#8a97b0;cursor:pointer;width:32px;height:32px;border-radius:8px;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
.ac-auth-x:hover{background:rgba(255,71,87,.15);color:#ff4757}
.ac-auth-body{padding:1.5rem}
.ac-auth-title{font-family:'Montserrat',sans-serif;font-size:1.1rem;font-weight:900;color:#e8edf5;margin-bottom:.35rem}
.ac-auth-sub{font-size:.8rem;color:#5a6a8a;margin-bottom:1.25rem;line-height:1.6}
/* Form */
.ac-fg{margin-bottom:.85rem}
.ac-fg-row{display:grid;grid-template-columns:1fr 1fr;gap:.65rem;margin-bottom:.85rem}
.ac-label{display:flex;align-items:center;justify-content:space-between;font-size:.72rem;font-weight:600;color:#8a97b0;margin-bottom:.3rem;font-family:'Montserrat',sans-serif}
.ac-label-link{color:#00d4ff;cursor:pointer;font-weight:600}
.ac-label-link:hover{text-decoration:underline}
.ac-input{width:100%;padding:.68rem .9rem;background:#161b27;border:1.5px solid #252f47;border-radius:10px;color:#e8edf5;font-family:'Roboto',sans-serif;font-size:.88rem;outline:none;transition:border-color .2s}
.ac-input:focus{border-color:#00d4ff}
.ac-input.err{border-color:#ff4757;animation:acShake .3s ease}
@keyframes acShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.ac-input-wrap{position:relative}
.ac-input-wrap .ac-input{padding-right:2.5rem}
.ac-input-eye{position:absolute;right:.75rem;top:50%;transform:translateY(-50%);background:none;border:none;color:#5a6a8a;cursor:pointer;font-size:.88rem;padding:0;transition:color .2s}
.ac-input-eye:hover{color:#00d4ff}
/* Password strength */
.ac-pwd-strength{margin-top:.35rem}
.ac-pwd-bar{height:4px;border-radius:2px;background:#252f47;overflow:hidden;margin-bottom:.25rem}
.ac-pwd-fill{height:100%;border-radius:2px;transition:width .3s,background .3s}
.ac-pwd-text{font-size:.65rem;color:#5a6a8a;font-family:'Montserrat',sans-serif}
.ac-pwd-rules{margin-top:.35rem;display:flex;flex-direction:column;gap:.18rem}
.ac-pwd-rule{font-size:.65rem;display:flex;align-items:center;gap:.3rem;color:#5a6a8a;transition:color .2s}
.ac-pwd-rule.ok{color:#00e676}.ac-pwd-rule.ok::before{content:'✓'}.ac-pwd-rule:not(.ok)::before{content:'○'}
/* Submit button */
.ac-auth-btn{width:100%;padding:.85rem;background:linear-gradient(135deg,#00d4ff,#0099bb);color:#0b0e14;border:none;border-radius:11px;font-family:'Montserrat',sans-serif;font-size:.9rem;font-weight:900;cursor:pointer;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:.4rem;margin-top:.25rem}
.ac-auth-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,212,255,.3)}
.ac-auth-btn:disabled{background:#252f47;color:#5a6a8a;cursor:not-allowed}
.ac-auth-btn.orange{background:linear-gradient(135deg,#ff6b35,#e05a28)}
.ac-auth-btn.orange:hover:not(:disabled){box-shadow:0 6px 20px rgba(255,107,53,.3)}
/* Error / info messages */
.ac-msg{border-radius:9px;padding:.65rem .9rem;font-size:.78rem;margin-bottom:.85rem;line-height:1.6;display:none}
.ac-msg.show{display:block}
.ac-msg.error{background:rgba(255,71,87,.1);border:1px solid rgba(255,71,87,.25);color:#ff4757}
.ac-msg.success{background:rgba(0,230,118,.1);border:1px solid rgba(0,230,118,.25);color:#00e676}
.ac-msg.info{background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);color:#00d4ff}
/* Divider */
.ac-auth-divider{display:flex;align-items:center;gap:.75rem;margin:1rem 0;color:#3a4a6a;font-size:.72rem}
.ac-auth-divider::before,.ac-auth-divider::after{content:'';flex:1;height:1px;background:#252f47}
/* Footer link */
.ac-auth-footer{text-align:center;margin-top:1rem;font-size:.78rem;color:#5a6a8a}
.ac-auth-footer a,.ac-auth-footer span[onclick]{color:#00d4ff;cursor:pointer;font-weight:600}
.ac-auth-footer span[onclick]:hover{text-decoration:underline}
/* Code input */
.ac-code-wrap{display:flex;gap:.5rem;justify-content:center;margin:1rem 0}
.ac-code-input{width:48px;height:56px;text-align:center;font-size:1.4rem;font-weight:800;background:#161b27;border:2px solid #252f47;border-radius:10px;color:#e8edf5;font-family:'Montserrat',sans-serif;outline:none;transition:border-color .2s}
.ac-code-input:focus{border-color:#00d4ff}
.ac-code-input.err{border-color:#ff4757}
/* User avatar chip */
.ac-user-chip{display:inline-flex;align-items:center;gap:.5rem;padding:.3rem .75rem;background:rgba(0,212,255,.08);border:1px solid rgba(0,212,255,.2);border-radius:20px;font-size:.75rem;font-weight:600;color:#00d4ff;font-family:'Montserrat',sans-serif;cursor:pointer;transition:all .18s}
.ac-user-chip:hover{background:rgba(0,212,255,.15)}
.ac-user-avatar{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:800;font-family:'Montserrat',sans-serif}
    `;
    document.head.appendChild(st);
  }

  // ── Modal HTML builder ────────────────────────────────────────────────────
  function buildModal() {
    const el = document.createElement('div');
    el.className = 'ac-auth-overlay';
    el.id = 'acAuthOverlay';
    el.onclick = function(e) { if(e.target===el) window._acAuth.close(); };
    el.innerHTML = `
      <div class="ac-auth-modal" id="acAuthModal">
        <div class="ac-auth-head">
          <div class="ac-auth-logo">SELA<span class="ac-auth-logo-dot">.</span>Solutions</div>
          <button class="ac-auth-x" onclick="window._acAuth.close()">✕</button>
        </div>
        <div class="ac-auth-body" id="acAuthBody"></div>
      </div>`;
    document.body.appendChild(el);
    return el;
  }

  function getModal() {
    return document.getElementById('acAuthOverlay') || buildModal();
  }
  function setBody(html) {
    const b = document.getElementById('acAuthBody');
    if (b) b.innerHTML = html;
  }
  function showMsg(id, text, type='error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text; el.className = `ac-msg show ${type}`;
  }
  function clearMsg(id) {
    const el = document.getElementById(id); if(el) el.className='ac-msg';
  }

  // ── Password strength ─────────────────────────────────────────────────────
  function checkStrength(pw) {
    const rules = [
      { re:/[a-z]/, text:'Lowercase letter' },
      { re:/[A-Z]/, text:'Uppercase letter' },
      { re:/\d/,    text:'Number'           },
      { re:/[\W_]/, text:'Special character (e.g. @!#$)' },
      { re:/.{8,}/, text:'At least 8 characters' },
    ];
    const score = rules.filter(r=>r.re.test(pw)).length;
    const colors = ['#ff4757','#ff4757','#ff9f43','#f59e0b','#00e676','#00e676'];
    const labels = ['','Weak','Weak','Fair','Good','Strong'];
    return { score, rules, color: colors[score], label: labels[score], pct: score*20 };
  }
  window._acPwdInput = function(val) {
    const s = checkStrength(val);
    const fill = document.getElementById('acPwdFill');
    const text = document.getElementById('acPwdText');
    if (fill) { fill.style.width=s.pct+'%'; fill.style.background=s.color; }
    if (text) text.textContent = val ? s.label : '';
    s.rules.forEach(r => {
      const el = document.getElementById('acRule_'+r.text.slice(0,8).replace(/\s/g,''));
      if (el) el.classList.toggle('ok', r.re.test(val));
    });
  };
  window._acTogglePwd = function(id) {
    const inp = document.getElementById(id);
    if (!inp) return;
    inp.type = inp.type === 'password' ? 'text' : 'password';
  };
  // Code input navigation
  window._acCodeKey = function(e, idx) {
    const inputs = document.querySelectorAll('.ac-code-input');
    if (e.key==='Backspace' && !e.target.value && idx>0) inputs[idx-1].focus();
    else if (e.key.length===1 && /\d/.test(e.key) && idx<5) setTimeout(()=>inputs[idx+1]?.focus(), 0);
  };
  window._acGetCode = function() {
    return Array.from(document.querySelectorAll('.ac-code-input')).map(i=>i.value).join('');
  };

  // ── Views ─────────────────────────────────────────────────────────────────
  function showLogin() {
    getModal().classList.add('open');
    setBody(`
      <div class="ac-auth-title">Welcome back</div>
      <div class="ac-auth-sub">Log in to your SELA account</div>
      <div class="ac-msg" id="loginMsg"></div>
      <div class="ac-fg">
        <label class="ac-label">Email or Username</label>
        <input class="ac-input" id="loginId" type="text" placeholder="amina@email.com or amina_hassan" autocomplete="username"
          onkeydown="if(event.key==='Enter')document.getElementById('loginPass').focus()"/>
      </div>
      <div class="ac-fg">
        <label class="ac-label">
          Password
          <span class="ac-label-link" onclick="window._acAuth.forgotPwd()">Forgot password?</span>
        </label>
        <div class="ac-input-wrap">
          <input class="ac-input" id="loginPass" type="password" placeholder="••••••••" autocomplete="current-password"
            onkeydown="if(event.key==='Enter')window._acAuth.submitLogin()"/>
          <button class="ac-input-eye" onclick="window._acTogglePwd('loginPass')">👁</button>
        </div>
      </div>
      <button class="ac-auth-btn" id="loginBtn" onclick="window._acAuth.submitLogin()">🔑 Log In</button>
      <div class="ac-auth-divider">or</div>
      <div class="ac-auth-footer">
        Don't have an account? <span onclick="window._acAuth.showRegister()">Create one →</span>
      </div>`);
    setTimeout(() => document.getElementById('loginId')?.focus(), 100);
  }

  function showRegister() {
    getModal().classList.add('open');
    setBody(`
      <div class="ac-auth-title">Create your account</div>
      <div class="ac-auth-sub">Join SELA — browse products, post comments & track orders</div>
      <div class="ac-msg" id="regMsg"></div>
      <div class="ac-fg-row">
        <div>
          <label class="ac-label">First Name</label>
          <input class="ac-input" id="regFirst" type="text" placeholder="Amina" autocomplete="given-name"/>
        </div>
        <div>
          <label class="ac-label">Last Name</label>
          <input class="ac-input" id="regLast" type="text" placeholder="Hassan" autocomplete="family-name"/>
        </div>
      </div>
      <div class="ac-fg">
        <label class="ac-label">Username</label>
        <input class="ac-input" id="regUser" type="text" placeholder="amina_hassan" autocomplete="username"
          oninput="this.value=this.value.replace(/[^a-zA-Z0-9_]/g,'').toLowerCase()"/>
        <div style="font-size:.63rem;color:#3a4a6a;margin-top:.2rem">Letters, numbers and _ only. Min 3 characters.</div>
      </div>
      <div class="ac-fg">
        <label class="ac-label">Email Address</label>
        <input class="ac-input" id="regEmail" type="email" placeholder="amina@gmail.com" autocomplete="email"/>
      </div>
      <div class="ac-fg">
        <label class="ac-label">Password</label>
        <div class="ac-input-wrap">
          <input class="ac-input" id="regPass" type="password" placeholder="Create a strong password"
            oninput="window._acPwdInput(this.value)" autocomplete="new-password"/>
          <button class="ac-input-eye" onclick="window._acTogglePwd('regPass')">👁</button>
        </div>
        <div class="ac-pwd-strength">
          <div class="ac-pwd-bar"><div class="ac-pwd-fill" id="acPwdFill" style="width:0"></div></div>
          <div class="ac-pwd-text" id="acPwdText"></div>
          <div class="ac-pwd-rules">
            <div class="ac-pwd-rule" id="acRule_Lowercas">Lowercase letter</div>
            <div class="ac-pwd-rule" id="acRule_Uppercas">Uppercase letter</div>
            <div class="ac-pwd-rule" id="acRule_Number">Number</div>
            <div class="ac-pwd-rule" id="acRule_Specialc">Special character (e.g. @!#$)</div>
            <div class="ac-pwd-rule" id="acRule_Atleast">At least 8 characters</div>
          </div>
        </div>
      </div>
      <button class="ac-auth-btn" id="regBtn" onclick="window._acAuth.submitRegister()">🚀 Create Account</button>
      <div class="ac-auth-footer">
        Already have an account? <span onclick="window._acAuth.showLogin()">Log in →</span>
      </div>`);
  }

  // State for verify screen
  let _verifyUserId = null;
  function showVerify(userId, email) {
    _verifyUserId = userId;
    getModal().classList.add('open');
    setBody(`
      <div class="ac-auth-title">Verify your email</div>
      <div class="ac-auth-sub">We sent a 6-digit code to <strong style="color:#e8edf5">${email}</strong>. Enter it below.</div>
      <div class="ac-msg" id="verifyMsg"></div>
      <div class="ac-code-wrap">
        ${[0,1,2,3,4,5].map(i=>`<input class="ac-code-input" id="code${i}" type="text" maxlength="1" inputmode="numeric"
          onkeydown="window._acCodeKey(event,${i})" oninput="this.value=this.value.replace(/\\D/,'')" />`).join('')}
      </div>
      <button class="ac-auth-btn" id="verifyBtn" onclick="window._acAuth.submitVerify()">✅ Verify Email</button>
      <div class="ac-auth-footer" style="margin-top:.75rem">
        Didn't get the code? <span onclick="window._acAuth.resendCode()">Resend →</span>
        &nbsp;·&nbsp; <span onclick="window._acAuth.showLogin()">Back to login</span>
      </div>`);
    setTimeout(() => document.getElementById('code0')?.focus(), 100);
  }

  function showForgot() {
    getModal().classList.add('open');
    setBody(`
      <div class="ac-auth-title">Reset your password</div>
      <div class="ac-auth-sub">Enter your email and we'll send you a reset code.</div>
      <div class="ac-msg" id="forgotMsg"></div>
      <div class="ac-fg">
        <label class="ac-label">Email Address</label>
        <input class="ac-input" id="forgotEmail" type="email" placeholder="amina@gmail.com"
          onkeydown="if(event.key==='Enter')window._acAuth.submitForgot()"/>
      </div>
      <button class="ac-auth-btn orange" id="forgotBtn" onclick="window._acAuth.submitForgot()">📧 Send Reset Code</button>
      <div class="ac-auth-footer">
        <span onclick="window._acAuth.showLogin()">← Back to login</span>
      </div>`);
    setTimeout(() => document.getElementById('forgotEmail')?.focus(), 100);
  }

  function showReset(email, devCode) {
    getModal().classList.add('open');
    const devBanner2 = devCode ? `
      <div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:9px;padding:.75rem 1rem;margin-bottom:.85rem;font-size:.78rem;color:#f59e0b">
        <strong style="display:block;margin-bottom:.2rem">⚠️ No email configured — reset code:</strong>
        <strong style="font-size:1.1rem;letter-spacing:4px;color:#fff;font-family:monospace">${devCode}</strong>
      </div>` : '';
    setBody(`
      <div class="ac-auth-title">Enter reset code</div>
      <div class="ac-auth-sub">Check <strong style="color:#e8edf5">${email}</strong> for your 6-digit reset code.</div>
      ${devBanner2}
      <div class="ac-msg" id="resetMsg"></div>
      <div class="ac-code-wrap">
        ${[0,1,2,3,4,5].map(i=>`<input class="ac-code-input" id="rcode${i}" type="text" maxlength="1" inputmode="numeric"
          onkeydown="window._acCodeKey(event,${i})" oninput="this.value=this.value.replace(/\\D/,'')" style="border-color:#ff6b35" />`).join('')}
      </div>
      <div class="ac-fg" style="margin-top:.5rem">
        <label class="ac-label">New Password</label>
        <div class="ac-input-wrap">
          <input class="ac-input" id="newPass" type="password" placeholder="New strong password"
            oninput="window._acPwdInput(this.value)" autocomplete="new-password"/>
          <button class="ac-input-eye" onclick="window._acTogglePwd('newPass')">👁</button>
        </div>
        <div class="ac-pwd-strength">
          <div class="ac-pwd-bar"><div class="ac-pwd-fill" id="acPwdFill" style="width:0"></div></div>
          <div class="ac-pwd-text" id="acPwdText"></div>
        </div>
      </div>
      <button class="ac-auth-btn orange" id="resetBtn" onclick="window._acAuth.submitReset('${email}')">🔒 Reset Password</button>
      <div class="ac-auth-footer">
        <span onclick="window._acAuth.forgotPwd()">← Resend code</span>
      </div>`);
    if (devCode) {
      setTimeout(() => {
        devCode.split('').forEach((ch, i) => {
          const inp = document.getElementById('rcode'+i);
          if (inp) inp.value = ch;
        });
      }, 200);
    } else {
      setTimeout(() => document.getElementById('rcode0')?.focus(), 100);
    }
  }


  // ── Shared helpers ───────────────────────────────────────────────────────────
  function apiFetch(url, opts={}, ms=5000) {
    const ctrl = new AbortController();
    const tid  = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { ...opts, signal: ctrl.signal })
      .then(r => { clearTimeout(tid); return r; })
      .catch(() => { clearTimeout(tid); return null; });
  }

  const LOCAL_STORE = {
    all()  { try{return JSON.parse(localStorage.getItem('_sela_users')||'[]');}catch{return[];} },
    save(u){ const all=LOCAL_STORE.all(); const i=all.findIndex(x=>x.email===u.email||x.username===u.username); if(i>=0)all[i]=u;else all.push(u); localStorage.setItem('_sela_users',JSON.stringify(all)); },
    find(q){ return LOCAL_STORE.all().find(u=>u.email===q||u.username===q)||null; }
  };

  function loginLocalUser(user) {
    const token = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    window._acUser.setSession(token, user);
    updateAuthUI();
    return token;
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  async function submitLogin() {
    const login = document.getElementById('loginId')?.value.trim();
    const pass  = document.getElementById('loginPass')?.value;
    const btn   = document.getElementById('loginBtn');
    clearMsg('loginMsg');
    if (!login||!pass) { showMsg('loginMsg','Enter your email/username and password'); return; }
    if (btn) { btn.disabled=true; btn.textContent='⏳ Logging in…'; }

    const r = await apiFetch(`${API}/users/login`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({login, password:pass})
    });

    if (r) {
      const j = await r.json().catch(() => ({}));
      if (j.success) {
        window._acUser.setSession(j.token, j.user);
        window._acAuth.close(); updateAuthUI();
        if (typeof window._onUserLogin === 'function') window._onUserLogin(j.user);
        showAuthToast('👋 Welcome back, ' + (j.user.firstName||login) + '!', 'success');
        if (btn) { btn.disabled=false; btn.textContent='🔑 Log In'; } return;
      }
      if (j.needsVerify) {
        showVerify(j.userId, login);
        if (btn) { btn.disabled=false; btn.textContent='🔑 Log In'; } return;
      }
      if (r.status === 401 || j.message?.toLowerCase().includes('no account')) {
        const ra = await apiFetch(`${API}/auth/login`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({username:login, password:pass})
        });
        if (ra) {
          const ja = await ra.json().catch(() => ({}));
          if (ja.success) {
            localStorage.setItem('td_token', ja.token);
            window._acAuth.close(); updateAuthUI();
            showAuthToast('🛡️ Admin logged in!', 'success');
            if (btn) { btn.disabled=false; btn.textContent='🔑 Log In'; } return;
          }
        }
      }
      showMsg('loginMsg', j.message || 'Login failed — check your credentials');
      if (btn) { btn.disabled=false; btn.textContent='🔑 Log In'; } return;
    }

    // Backend offline
    const localUser = LOCAL_STORE.find(login);
    if (localUser) {
      if (localUser.password !== pass) {
        showMsg('loginMsg', 'Wrong password — please try again');
        if (btn) { btn.disabled=false; btn.textContent='🔑 Log In'; } return;
      }
      loginLocalUser(localUser);
      window._acAuth.close();
      showAuthToast('👋 Welcome back, ' + (localUser.firstName||login) + '!', 'success');
      if (btn) { btn.disabled=false; btn.textContent='🔑 Log In'; } return;
    }
    if (btn) { btn.disabled=false; btn.textContent='🔑 Log In'; }
    showMsg('loginMsg', '⚡ Backend offline — log in with an account you registered hereed here');
  }

  async function submitRegister() {
    clearMsg('regMsg');
    const first = document.getElementById('regFirst')?.value.trim();
    const last  = document.getElementById('regLast')?.value.trim();
    const user  = document.getElementById('regUser')?.value.trim();
    const email = document.getElementById('regEmail')?.value.trim();
    const pass  = document.getElementById('regPass')?.value;
    const btn   = document.getElementById('regBtn');
    if (!first||!last||!user||!email||!pass) { showMsg('regMsg','Please fill in all fields'); return; }
    if (!user || user.length < 3 || !/^[a-zA-Z0-9_]+$/.test(user)) { showMsg('regMsg','Username: letters, numbers and _ only. Min 3 chars.'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showMsg('regMsg','Enter a valid email address'); return; }
    if (pass.length < 8) { showMsg('regMsg','Password must be at least 8 characters'); return; }
    if (btn) { btn.disabled=true; btn.textContent='⏳ Creating account…'; }

    // 1. Try real API
    const r = await apiFetch(`${API}/users/register`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({firstName:first, lastName:last, username:user, email, password:pass})
    });

    // Check local duplicate first
    if (LOCAL_STORE.find(email) || LOCAL_STORE.find(user)) {
      showMsg('regMsg', 'An account with that email or username already exists. Try logging in.');
      if (btn) { btn.disabled=false; btn.textContent='🚀 Create Account'; } return;
    }

    // Save locally FIRST — always works, even offline
    const newUser = { id:'local-'+Date.now(), firstName:first, lastName:last, username:user,
      email, password:pass, name:first+' '+last, isVerified:true, isLocal:true,
      createdAt:new Date().toISOString() };
    LOCAL_STORE.save(newUser);
    loginLocalUser(newUser);
    window._acAuth?.close(); updateAuthUI();
    showAuthToast('✅ Account created! Welcome, ' + first + '!', 'success');
    if (typeof window._onUserLogin === 'function') window._onUserLogin(newUser);
    if (btn) { btn.disabled=false; btn.textContent='🚀 Create Account'; }

    // Try backend in background (optional upgrade)
    if (r) {
      const j = await r.json().catch(() => ({}));
      if (j.success && j.token) {
        localStorage.setItem('ac_user_token', j.token);
        if (j.user) localStorage.setItem('ac_user', JSON.stringify(j.user));
      }
    }
  }

  async function submitVerify() {
    const code = window._acGetCode();
    const btn  = document.getElementById('verifyBtn');
    clearMsg('verifyMsg');
    if (code.length !== 6) { showMsg('verifyMsg','Enter the full 6-digit code'); return; }
    if (!_verifyUserId)    { showMsg('verifyMsg','Session error — please register again'); return; }
    if (btn) { btn.disabled=true; btn.textContent='⏳ Verifying…'; }
    const r = await apiFetch(`${API}/users/verify-email`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({userId:_verifyUserId, code})
    });
    if (r) {
      const j = await r.json().catch(() => ({}));
      if (j.success) {
        window._acUser.setSession(j.token, j.user);
        window._acAuth.close(); updateAuthUI();
        if (typeof window._onUserLogin === 'function') window._onUserLogin(j.user);
        showAuthToast('✅ Email verified! Welcome, ' + (j.user.firstName||'') + '!', 'success');
      } else {
        showMsg('verifyMsg', j.message || 'Invalid code — please try again');
        document.querySelectorAll('.ac-code-input').forEach(i=>i.classList.add('err'));
      }
    } else {
      showMsg('verifyMsg','⚡ Backend offline — try logging in with your email and password directly');
    }
    if (btn) { btn.disabled=false; btn.textContent='✅ Verify Email'; }

  async function resendCode() {
    if (!_verifyUserId) return;
    const r = await apiFetch(`${API}/users/resend-code`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({userId:_verifyUserId})
    });
    if (r) {
      const j = await r.json().catch(() => ({}));
      if (j.devCode) {
        j.devCode.split('').forEach((ch,i) => { const inp=document.getElementById('code'+i); if(inp) inp.value=ch; });
        showMsg('verifyMsg','New code auto-filled','info');
      } else {
        showMsg('verifyMsg', j.message||'Code resent','info');
      }
    } else { showMsg('verifyMsg','⚡ Backend offline','error'); }
  }

  let _forgotEmail = '';
  async function submitForgot() {
    const email = document.getElementById('forgotEmail')?.value.trim();
    const btn   = document.getElementById('forgotBtn');
    clearMsg('forgotMsg');
    if (!email) { showMsg('forgotMsg','Enter your email address'); return; }
    _forgotEmail = email;
    if (btn) { btn.disabled=true; btn.textContent='⏳ Sending…'; }
    const r = await apiFetch(`${API}/users/forgot-password`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email})
    });
    if (r) {
      const j = await r.json().catch(() => ({}));
      if (j.success) { showReset(email, j.devCode); }
      else { showMsg('forgotMsg', j.message || 'Could not send code'); }
    } else { showMsg('forgotMsg','⚡ Backend offline — cannot send reset email'); }
    if (btn) { btn.disabled=false; btn.textContent='📧 Send Reset Code'; }
  }

  async function submitReset(email) {
    const code    = Array.from(document.querySelectorAll('.ac-code-input')).map(i=>i.value).join('');
    const newPass = document.getElementById('newPass')?.value;
    const btn     = document.getElementById('resetBtn');
    clearMsg('resetMsg');
    if (code.length!==6) { showMsg('resetMsg','Enter the full 6-digit code'); return; }
    if (!newPass||newPass.length<8) { showMsg('resetMsg','Password must be at least 8 characters'); return; }
    if (btn) { btn.disabled=true; btn.textContent='⏳ Resetting…'; }
    const r = await apiFetch(`${API}/users/reset-password`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({email, code, newPassword:newPass})
    });
    if (r) {
      const j = await r.json().catch(() => ({}));
      if (j.success) { showMsg('resetMsg', j.message || 'Password reset! Logging you in…', 'success'); setTimeout(() => showLogin(), 2000); }
      else { showMsg('resetMsg', j.message || 'Reset failed'); }
    } else { showMsg('resetMsg','⚡ Backend offline — cannot reset password'); }
    if (btn) { btn.disabled=false; btn.textContent='🔒 Reset Password'; }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showAuthToast(msg, type='success') {
    // Use page toast if available
    if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
    let t = document.getElementById('acAuthToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'acAuthToast';
      t.style.cssText = 'position:fixed;bottom:5rem;left:50%;transform:translateX(-50%);padding:.48rem 1.2rem;border-radius:20px;font-size:.78rem;font-weight:700;opacity:0;transition:opacity .3s;pointer-events:none;z-index:9999;white-space:nowrap;font-family:Montserrat,sans-serif';
      document.body.appendChild(t);
    }
    t.textContent=msg; t.style.background=type==='error'?'#ff4757':'#00e676'; t.style.color=type==='error'?'#fff':'#0b0e14';
    t.style.opacity='1'; setTimeout(()=>t.style.opacity='0',2800);
  }

  // ── Auth UI injection into header ─────────────────────────────────────────
  function updateAuthUI() {
    const user = window._acUser.getUser();
    const loggedIn = window._acUser.isLoggedIn();

    // Update ac-header admin area (from header.js)
    const acAdmin = document.getElementById('acNavAdmin');
    const acLoginBtn = document.getElementById('acLoginBtn');
    const acUserChip = document.getElementById('acUserChip');

    if (loggedIn && user) {
      // Show user chip in header
      if (acLoginBtn) acLoginBtn.style.display = 'none';
      if (acAdmin) {
        // Add user chip if not present
        if (!document.getElementById('acUserChip')) {
          const chip = document.createElement('div');
          chip.id = 'acUserChip';
          chip.className = 'ac-user-chip';
          chip.style.cssText = 'margin-right:.5rem';
          chip.onclick = () => window._acAuth.showProfile();
          chip.innerHTML = `<div class="ac-user-avatar" style="background:${user.avatar||'#607D8B'};color:#fff">${(user.firstName||'U')[0].toUpperCase()}</div>${user.firstName}`;
          acAdmin.parentNode.insertBefore(chip, acAdmin);
        }
        // Also show logout button for user (not admin post button)
        const logoutBtn = document.getElementById('acLogoutBtn');
        if (logoutBtn) { logoutBtn.style.display=''; logoutBtn.textContent='Sign Out'; logoutBtn.onclick=()=>window._acAuth.logout(); }
      }
    } else {
      // Remove user chip
      document.getElementById('acUserChip')?.remove();
      if (acLoginBtn) acLoginBtn.style.display = '';
    }

    // Update comment forms on page
    updateCommentForms();
  }

  function updateCommentForms() {
    const loggedIn = window._acUser.isLoggedIn();
    const user     = window._acUser.getUser();

    // Find all comment form anon fields and update them
    ['prdAnonFields','prdAnonWarning'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = (loggedIn || typeof window.isAdmin === 'function' && window.isAdmin()) ? 'none' : '';
    });

    // Update submit button and form title
    const cfTitle = document.getElementById('prdCfTitle') || document.getElementById('cfTitleEl');
    if (cfTitle && loggedIn && user) cfTitle.textContent = `Commenting as ${user.firstName} ${user.lastName}`;

    const cfAvatar = document.getElementById('prdCfAvatar');
    if (cfAvatar && loggedIn && user) {
      cfAvatar.innerHTML = (user.firstName||'U')[0].toUpperCase();
      cfAvatar.style.background = user.avatar || '#607D8B';
      cfAvatar.style.color = '#fff';
    }

    // Show login-to-comment prompt if not logged in
    ['prdCfSubmit'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      if (!loggedIn && !(typeof window.isAdmin === 'function' && window.isAdmin())) {
        btn.textContent = '🔐 Login to Comment';
        btn.onclick = () => window._acAuth.showLogin();
      }
    });
  }

  // ── Show profile / logout ─────────────────────────────────────────────────
  function showProfile() {
    const user = window._acUser.getUser();
    if (!user) { showLogin(); return; }
    getModal().classList.add('open');
    setBody(`
      <div style="text-align:center;padding:.5rem 0 1rem">
        <div style="width:64px;height:64px;border-radius:50%;background:${user.avatar||'#607D8B'};display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;color:#fff;font-family:Montserrat,sans-serif;margin:0 auto .75rem">${(user.firstName||'U')[0].toUpperCase()}</div>
        <div style="font-family:Montserrat,sans-serif;font-size:1rem;font-weight:800;color:#e8edf5">${user.firstName} ${user.lastName}</div>
        <div style="font-size:.78rem;color:#5a6a8a;margin-top:.2rem">@${user.username}</div>
        <div style="font-size:.75rem;color:#5a6a8a;margin-top:.15rem">${user.email}</div>
      </div>
      <div class="ac-auth-divider">Account</div>
      <button class="ac-auth-btn" style="background:rgba(255,71,87,.1);border:1px solid rgba(255,71,87,.2);color:#ff4757;margin-top:.5rem" onclick="window._acAuth.logout()">
        🚪 Sign Out
      </button>
      <div class="ac-auth-footer" style="margin-top:.75rem">
        <span onclick="window._acAuth.close()">Close</span>
      </div>`);
  }

  function logout() {
    window._acUser.clearSession();
    window._acAuth.close();
    updateAuthUI();
    // Update admin bar from header.js if available
    if (typeof updateAdminBar === 'function') updateAdminBar();
    showAuthToast('Signed out successfully');
    // Reload to reset page state
    setTimeout(() => window.location.reload(), 800);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  window._acAuth = {
    showLogin:      showLogin,
    showRegister:   showRegister,
    forgotPwd:      showForgot,
    showProfile:    showProfile,
    logout:         logout,
    close:          () => { document.getElementById('acAuthOverlay')?.classList.remove('open'); },
    submitLogin:    submitLogin,
    submitRegister: submitRegister,
    submitVerify:   submitVerify,
    resendCode:     resendCode,
    submitForgot:   submitForgot,
    submitReset:    submitReset,
    updateUI:       updateAuthUI,
  };

  // Also override _acLogin in header.js to prefer user login
  window._acLogin = function() {
    // If admin overlay exists and user is already admin, use admin login
    if (document.getElementById('loginOverlay')) {
      if (typeof window.openLogin === 'function') { window.openLogin(); return; }
    }
    showLogin();
  };
  window._acLogout = function() {
    if (window._acUser.isLoggedIn()) { logout(); return; }
    localStorage.removeItem('td_token');
    if (typeof updateAdminBar === 'function') updateAdminBar();
    if (typeof window.setAuthUI === 'function') window.setAuthUI(false);
    showAuthToast('Logged out');
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    // Verify stored user token on load
    const token = window._acUser.getToken();
    if (token) {
      try {
        const r = await fetch(`${API}/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: AbortSignal.timeout(4000)
        });
        const j = await r.json();
        if (j.success) {
          window._acUser.setSession(token, j.user);
        } else {
          window._acUser.clearSession();
        }
      } catch {} // offline — keep existing user data
    }
    updateAuthUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // ESC closes modal
  document.addEventListener('keydown', e => { if (e.key==='Escape') window._acAuth.close(); });

}
})();

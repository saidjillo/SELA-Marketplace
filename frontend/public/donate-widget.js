/**
 * donate-widget.js — Self-contained donation widget
 * Usage: <div data-donate-widget="WIDGET_ID"></div>
 * Then: <script src="donate-widget.js"></script>
 */
(function(){
'use strict';

// ── CSS ───────────────────────────────────────────────────────────────────────
var CSS = `
.dw-wrap{background:linear-gradient(160deg,#0d1a2e,#0f2744 60%,#0a1e38);border-radius:16px;padding:1.25rem;position:relative;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.25);margin-bottom:1rem;font-family:'Plus Jakarta Sans','Roboto',sans-serif;color:#e8edf5}
.dw-wrap::before{content:'';position:absolute;top:-40px;right:-40px;width:110px;height:110px;background:radial-gradient(circle,rgba(0,212,255,.1),transparent 70%);pointer-events:none;z-index:0}
.dw-wrap *{box-sizing:border-box;position:relative;z-index:1}
.dw-ttl{font-family:'Montserrat',sans-serif;font-size:.95rem;font-weight:800;color:#fff;margin:0 0 .2rem;display:flex;align-items:center;gap:.4rem}
.dw-sub{font-size:.7rem;color:rgba(255,255,255,.5);margin:0 0 .9rem;line-height:1.5}
.dw-lbl{font-size:.62rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.1em;margin:0 0 .38rem;display:block}
.dw-grid{display:grid;grid-template-columns:1fr 1fr;gap:.35rem;margin-bottom:.45rem}
.dw-btn-amt{background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.1);border-radius:9px;padding:.5rem .35rem;cursor:pointer;transition:all .18s;text-align:center;width:100%}
.dw-btn-amt:hover{border-color:rgba(0,212,255,.3);background:rgba(0,212,255,.07)}
.dw-btn-amt.sel{background:rgba(0,212,255,.13);border-color:#00d4ff;box-shadow:0 0 0 2px rgba(0,212,255,.12)}
.dw-n{font-family:'Montserrat',sans-serif;font-size:.88rem;font-weight:800;color:#00d4ff;display:block}
.dw-t{font-size:.58rem;color:rgba(255,255,255,.38);line-height:1.3;margin-top:.08rem;display:block}
.dw-chk{width:14px;height:14px;border-radius:50%;border:1.5px solid rgba(255,255,255,.15);margin:.28rem auto 0;font-size:.5rem;font-weight:900;color:transparent;transition:all .18s;display:flex;align-items:center;justify-content:center}
.dw-btn-amt.sel .dw-chk{background:#00d4ff;border-color:#00d4ff;color:#0b0e14}
.dw-or{text-align:center;font-size:.62rem;color:rgba(255,255,255,.25);margin:.35rem 0;position:relative}
.dw-or::before,.dw-or::after{content:'';position:absolute;top:50%;width:36%;height:1px;background:rgba(255,255,255,.1)}
.dw-or::before{left:0}.dw-or::after{right:0}
.dw-row{display:flex;align-items:center;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.1);border-radius:8px;overflow:hidden;margin-bottom:.6rem;transition:border-color .2s}
.dw-row:focus-within{border-color:#00d4ff}
.dw-row.err{border-color:rgba(255,71,87,.6)}
.dw-pfx{padding:.55rem .6rem;font-size:.75rem;font-weight:700;color:rgba(255,255,255,.35);font-family:'Montserrat',sans-serif;border-right:1px solid rgba(255,255,255,.07);flex-shrink:0;white-space:nowrap}
.dw-ico{padding:.55rem .6rem;font-size:.8rem;flex-shrink:0;color:rgba(255,255,255,.3)}
.dw-inp{flex:1;padding:.55rem .5rem;background:transparent!important;border:none!important;outline:none!important;color:#fff!important;font-size:.82rem;font-family:inherit;min-width:0}
.dw-inp::placeholder{color:rgba(255,255,255,.22)}
.dw-inp[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
.dw-mpesa{display:flex;align-items:flex-start;gap:.55rem;background:rgba(0,161,76,.09);border:1px solid rgba(0,161,76,.2);border-radius:8px;padding:.6rem .75rem;margin-bottom:.75rem}
.dw-mp-l{font-size:.75rem;font-weight:900;color:#00e676;font-family:'Montserrat',sans-serif;flex-shrink:0;padding-top:1px}
.dw-mp-d{font-size:.67rem;color:rgba(255,255,255,.5);line-height:1.5}
.dw-mp-d strong{color:rgba(255,255,255,.75)}
.dw-errtxt{font-size:.68rem;color:#ff6b6b;padding:.3rem .6rem;background:rgba(255,71,87,.1);border:1px solid rgba(255,71,87,.2);border-radius:6px;margin-bottom:.55rem;display:none}
.dw-errtxt.on{display:block}
.dw-donate{width:100%;padding:.75rem;background:linear-gradient(135deg,#00d4ff,#0099bb);color:#0b0e14!important;border:none;border-radius:9px;font-family:'Montserrat',sans-serif;font-size:.85rem;font-weight:900;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:.4rem;margin-bottom:.5rem}
.dw-donate:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,212,255,.25)}
.dw-donate:disabled{background:rgba(255,255,255,.1);color:rgba(255,255,255,.3)!important;cursor:not-allowed}
.dw-sec{text-align:center;font-size:.6rem;color:rgba(255,255,255,.28);margin-bottom:.7rem}
.dw-hr{border:none;border-top:1px solid rgba(255,255,255,.06);margin:.75rem 0}
.dw-imp{display:flex;align-items:flex-start;gap:.5rem;margin-bottom:.45rem}
.dw-imp-i{width:22px;height:22px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:.7rem;flex-shrink:0}
.dw-imp strong{display:block;font-size:.7rem;font-weight:700;color:rgba(255,255,255,.75)}
.dw-imp span{font-size:.62rem;color:rgba(255,255,255,.38)}
.dw-ok{display:none;text-align:center;padding:.5rem 0}
.dw-ok-ic{font-size:2.5rem;margin-bottom:.5rem;animation:dwpop .4s ease}
@keyframes dwpop{0%{transform:scale(0)}65%{transform:scale(1.15)}100%{transform:scale(1)}}
.dw-ok-ttl{font-family:'Montserrat',sans-serif;font-size:.95rem;font-weight:800;color:#00e676;margin-bottom:.3rem}
.dw-ok-msg{font-size:.72rem;color:rgba(255,255,255,.48);line-height:1.6;margin-bottom:.8rem}
.dw-ok-msg strong{color:#00d4ff}
.dw-again{background:none;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.5);border-radius:7px;padding:.35rem .85rem;font-size:.72rem;cursor:pointer;font-family:'Montserrat',sans-serif;transition:all .18s}
.dw-again:hover{border-color:rgba(255,255,255,.3);color:#fff}
`;

// ── Inject CSS once ───────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('dw-styles')) return;
  var st = document.createElement('style');
  st.id = 'dw-styles';
  st.textContent = CSS;
  document.head.appendChild(st);
}

// ── Build widget HTML ─────────────────────────────────────────────────────────
function buildWidget(id) {
  var amts = [
    {n:'100',  t:'Small help'},
    {n:'250',  t:'You help us'},
    {n:'500',  t:'Bright futures'},
    {n:'1,000',t:'Lasting change'},
  ];
  var presets = amts.map(function(a, i){
    return '<button class="dw-btn-amt'+(i===0?' sel':'')+'" onclick="dwPick(\''+id+'\','+a.n.replace(',','')+',this)">'
      +'<span class="dw-n">'+a.n+'</span>'
      +'<span class="dw-t">'+a.t+'</span>'
      +'<span class="dw-chk">&#10003;</span>'
      +'</button>';
  }).join('');

  return '<div class="dw-wrap">'
    +'<div id="dwF_'+id+'">'
      +'<p class="dw-ttl">&#10084;&#65039; Support SELA</p>'
      +'<p class="dw-sub">Help bring quality products to every Kenyan.</p>'
      +'<span class="dw-lbl">Choose amount (KES)</span>'
      +'<div class="dw-grid" id="dwG_'+id+'">'+presets+'</div>'
      +'<div class="dw-or">or custom amount</div>'
      +'<div class="dw-row" id="dwCW_'+id+'">'
        +'<span class="dw-pfx">KES</span>'
        +'<input class="dw-inp" id="dwC_'+id+'" type="number" min="10" placeholder="Enter amount…" oninput="dwT(\''+id+'\')">'
      +'</div>'
      +'<span class="dw-lbl">Your name</span>'
      +'<div class="dw-row">'
        +'<span class="dw-ico">&#128100;</span>'
        +'<input class="dw-inp" id="dwN_'+id+'" type="text" placeholder="Full name (optional)">'
      +'</div>'
      +'<span class="dw-lbl">M-Pesa number <span style="color:rgba(255,71,87,.8)">*</span></span>'
      +'<div class="dw-row" id="dwPW_'+id+'">'
        +'<span class="dw-pfx">+254</span>'
        +'<input class="dw-inp" id="dwPH_'+id+'" type="tel" maxlength="9" placeholder="7XX XXX XXX" oninput="this.value=this.value.replace(/[^0-9]/g,\'\')">'
      +'</div>'
      +'<div class="dw-mpesa">'
        +'<span class="dw-mp-l">M-PESA</span>'
        +'<div class="dw-mp-d"><strong>M-Pesa STK Push</strong><br>Upon donating you will receive a prompt on your phone to enter your M-Pesa PIN to complete payment.</div>'
      +'</div>'
      +'<div class="dw-errtxt" id="dwE_'+id+'"></div>'
      +'<button class="dw-donate" id="dwB_'+id+'" onclick="dwDo(\''+id+'\')">&#128274; Donate Securely</button>'
      +'<div class="dw-sec">&#128737;&#65039; Secure &amp; encrypted</div>'
      +'<div class="dw-hr"></div>'
      +'<span class="dw-lbl">Your impact</span>'
      +'<div class="dw-imp"><div class="dw-imp-i" style="background:rgba(59,130,246,.12)">&#128218;</div><div><strong>Digital Education</strong><span>Helping youth access ICT skills</span></div></div>'
      +'<div class="dw-imp"><div class="dw-imp-i" style="background:rgba(16,185,129,.12)">&#127760;</div><div><strong>Connectivity</strong><span>Supporting rural internet access</span></div></div>'
      +'<div class="dw-imp"><div class="dw-imp-i" style="background:rgba(245,158,11,.12)">&#129309;</div><div><strong>Community</strong><span>Building stronger communities</span></div></div>'
    +'</div>'
    +'<div class="dw-ok" id="dwOK_'+id+'">'
      +'<div class="dw-ok-ic">&#127881;</div>'
      +'<div class="dw-ok-ttl">Thank you!</div>'
      +'<div class="dw-ok-msg" id="dwOM_'+id+'">Prompt sent. Enter your PIN to complete. &#127472;&#127466;</div>'
      +'<button class="dw-again" onclick="dwR(\''+id+'\')">&#8592; Donate again</button>'
    +'</div>'
  +'</div>';
}

// ── JS functions (global) ─────────────────────────────────────────────────────
var _dw = {};

window.dwPick = function(id, amt, el) {
  _dw[id] = amt;
  var g = document.getElementById('dwG_'+id);
  if (g) g.querySelectorAll('.dw-btn-amt').forEach(function(b){ b.classList.remove('sel'); });
  if (el) el.classList.add('sel');
  var ci = document.getElementById('dwC_'+id);
  if (ci) ci.value = '';
  dwCE(id);
};

window.dwT = function(id) {
  var ci = document.getElementById('dwC_'+id);
  if (ci && parseFloat(ci.value) > 0) {
    _dw[id] = null;
    var g = document.getElementById('dwG_'+id);
    if (g) g.querySelectorAll('.dw-btn-amt').forEach(function(b){ b.classList.remove('sel'); });
  }
  dwCE(id);
};

function dwCE(id) {
  var e = document.getElementById('dwE_'+id);
  if (e) e.classList.remove('on');
  var pw = document.getElementById('dwPW_'+id);
  var cw = document.getElementById('dwCW_'+id);
  if (pw) pw.classList.remove('err');
  if (cw) cw.classList.remove('err');
}

window.dwDo = function(id) {
  dwCE(id);
  var ci  = document.getElementById('dwC_'+id);
  var ph  = document.getElementById('dwPH_'+id);
  var nm  = document.getElementById('dwN_'+id);
  var btn = document.getElementById('dwB_'+id);
  var amt = _dw[id] || (ci && parseFloat(ci.value));

  if (!amt || isNaN(amt) || amt < 10) {
    var e = document.getElementById('dwE_'+id);
    if (e) { e.textContent = 'Select or enter an amount (min KES 10).'; e.classList.add('on'); }
    if (!_dw[id]) { var cw = document.getElementById('dwCW_'+id); if (cw) cw.classList.add('err'); }
    return;
  }
  var phone = ph ? ph.value.trim() : '';
  if (!phone || phone.length < 9 || !/^[0-9]{9}$/.test(phone)) {
    var e = document.getElementById('dwE_'+id);
    if (e) { e.textContent = 'Enter a valid M-Pesa number (9 digits, e.g. 712345678).'; e.classList.add('on'); }
    var pw = document.getElementById('dwPW_'+id);
    if (pw) pw.classList.add('err');
    return;
  }
  var name = nm ? nm.value.trim() : '';
  var full = '254' + phone;
  var fmt  = 'KES ' + Number(amt).toLocaleString('en-KE');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending prompt…'; }

  setTimeout(function() {
    var f   = document.getElementById('dwF_'+id);
    var ok  = document.getElementById('dwOK_'+id);
    var msg = document.getElementById('dwOM_'+id);
    if (f)   f.style.display  = 'none';
    if (ok)  ok.style.display = 'block';
    if (msg) msg.innerHTML = 'Prompt for <strong>'+fmt+'</strong> sent to<br><strong>+'+full+'</strong>.<br>Enter your M-Pesa PIN to complete.'
      + (name ? '<br><br>Asante, <strong style="color:#00e676">'+name+'</strong>! 🇰🇪' : '<br><br>Asante sana! 🇰🇪');
    if (btn) { btn.disabled = false; btn.textContent = '🔒 Donate Securely'; }
  }, 2000);
};

window.dwR = function(id) {
  var f  = document.getElementById('dwF_'+id);
  var ok = document.getElementById('dwOK_'+id);
  if (f)  f.style.display  = '';
  if (ok) ok.style.display = 'none';
  _dw[id] = 100;
  var g = document.getElementById('dwG_'+id);
  if (g) g.querySelectorAll('.dw-btn-amt').forEach(function(b, i){ b.classList.toggle('sel', i===0); });
  ['dwC_','dwN_','dwPH_'].forEach(function(p){ var el = document.getElementById(p+id); if (el) el.value = ''; });
  dwCE(id);
};

// ── Mount all widgets on the page ─────────────────────────────────────────────
function mount() {
  injectCSS();
  var targets = document.querySelectorAll('[data-donate]');
  targets.forEach(function(el) {
    if (el.dataset.mounted) return; // prevent double mount
    el.dataset.mounted = '1';
    var id = el.dataset.donate || ('dw' + Math.random().toString(36).slice(2,6));
    _dw[id] = 100; // default selection
    el.innerHTML = buildWidget(id);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}

})();

window.__ModuleLoader__.load({ id: 'kaori-preview', factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.js
var client_exports = {};
__export(client_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var name = "kaori-preview-client";
var inject = ["connection", "sessions"];
function apply(ctx) {
  installStyles();
  var rpcCall = function(endpoint, payload) {
    return ctx.connection.rpc.call("/kaori-preview", endpoint, payload || {}).then(function(res) {
      if (res && res.ok === true) return res.value;
      return { error: res && res.error && res.error.message || "RPC failed" };
    }, function(e) {
      return { error: String(e) };
    });
  };
  rpcCall("getConfig", {}).then(function(res) {
    if (res && !res.error && Array.isArray(res.hideOnOpen) && res.hideOnOpen.length > 0) {
      applyHideOnOpenCss(res.hideOnOpen);
    }
  });
  var sessionInfo = function() {
    try {
      if (ctx.sessions && ctx.sessions.list && typeof ctx.sessions.list.getSnapshot === "function") {
        var snap = ctx.sessions.list.getSnapshot();
        var byId = snap && snap.byId || {};
        var currentId = snap && snap.current;
        var rec = currentId ? byId[currentId] : null;
        if (rec && rec.cwd) {
          return Promise.resolve({ sessionId: currentId, cwd: rec.cwd });
        }
        var ids = snap && snap.ids || [];
        var bestId = null;
        var bestAt = -1;
        for (var i = 0; i < ids.length; i++) {
          var r = byId[ids[i]];
          if (r && r.cwd && (r.updatedAt || 0) > bestAt) {
            bestAt = r.updatedAt || 0;
            bestId = ids[i];
          }
        }
        if (bestId) return Promise.resolve({ sessionId: bestId, cwd: byId[bestId].cwd });
      }
    } catch (e) {
    }
    return Promise.resolve(null);
  };
  startUI(rpcCall, ctx, sessionInfo);
}
var STYLE_ID = "kaori-preview-styles";
var FILE_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L8.5 1.5Z"></path><path d="M8.5 1.5V5.5H13"></path></svg>';
var CSS_TEXT = String.raw`
.kaori-preview-panel{position:fixed;top:0;right:0;bottom:0;width:min(640px,46vw);z-index:1200;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l2);box-shadow:-8px 0 24px rgba(26,26,46,.18);transform:translateX(105%);transition:transform .22s ease;font-family:var(--dsw-font-family,system-ui)}
.kaori-preview-panel.open{transform:translateX(0)}
.kp-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;background:var(--dsw-alias-bg-layer-1)}
.kp-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.kp-close{width:26px;height:26px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:13px}
.kp-close:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-business-primary)}
.kp-body{display:flex;flex:1;min-height:0}
.kp-tree{width:210px;flex:none;overflow-y:auto;border-right:1px solid var(--dsw-alias-border-l2);padding:6px 0;background:var(--dsw-alias-bg-layer-2)}
.kp-view{flex:1;min-width:0;overflow:auto;padding:14px 16px}
.kp-dir,.kp-file{display:flex;align-items:center;gap:5px;padding:3px 8px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kp-dir{color:var(--dsw-alias-label-primary);font-weight:500}
.kp-dir-name{font-size:12px}
.kp-file:hover{background:var(--dsw-alias-interactive-bg-hover)}
.kp-file.active{background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-state-business-primary)}
.kp-file-icon{flex:none}
.kp-file-name{overflow:hidden;text-overflow:ellipsis}
.kp-loading,.kp-empty,.kp-error{padding:24px 12px;text-align:center;color:var(--dsw-alias-label-tertiary);font-size:12px}
.kp-error{color:var(--dsw-alias-state-error-primary)}
.kp-file-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.kp-file-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary);word-break:break-all}
.kp-meta{font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none}
.kp-text,.kp-code{font:12px/19px ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;white-space:pre-wrap;word-break:break-word;color:var(--dsw-alias-label-primary)}
.kp-tok-comment{color:var(--dsw-alias-label-tertiary);font-style:italic}
.kp-tok-string{color:var(--dsw-static-green-500,var(--dsw-alias-state-success-primary))}
.kp-tok-num{color:var(--dsw-static-gold-500,#b8860b)}
.kp-tok-kw{color:var(--dsw-alias-state-business-primary);font-weight:600}
.kp-md{color:var(--dsw-alias-label-primary);font-size:13px;line-height:22px}
.kp-md-h{margin:14px 0 6px;font-size:15px;font-weight:600;color:var(--dsw-alias-label-primary)}
.kp-md-p{margin:4px 0}
.kp-md-ul,.kp-md-ol{margin:4px 0;padding-left:20px}
.kp-md-code{font:12px/19px ui-monospace,SFMono-Regular,Menlo,monospace;margin:8px 0;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-markdown-code-block);overflow-x:auto;white-space:pre}
.kp-md-inline{font:12px/18px ui-monospace,SFMono-Regular,Menlo,monospace;padding:1px 5px;border-radius:4px;background:var(--dsw-alias-markdown-inline-code)}
.kp-md-link{color:var(--dsw-alias-state-business-primary)}
.kp-md-quote{margin:6px 0;padding:4px 10px;border-left:3px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-secondary)}
.kp-md-hr{border:0;border-top:1px solid var(--dsw-alias-border-l2);margin:10px 0}
.kp-md-space{height:6px}
.kp-img-wrap{display:flex;align-items:center;justify-content:center;padding:8px}
.kp-img{max-width:100%;max-height:70vh;border-radius:8px;box-shadow:var(--dsw-shadow-lv1)}
.kaori-preview-toggle{font-size:15px;line-height:1}
.kaori-preview-rail{position:absolute;left:50%;transform:translateX(-50%);width:32px;height:32px;border-radius:50%;border:none;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;display:inline-flex;align-items:center;justify-content:center;transition:background .15s ease}
.kaori-preview-rail:hover{background:var(--dsw-alias-interactive-bg-hover)}
@media(max-width:1100px){body.kaori-preview-open .kaori-preview-toggle{opacity:0;pointer-events:none}}
@media(max-width:1100px){.kaori-preview-panel{width:100%;border-left:0}.kp-tree{width:160px}.kp-body{flex-direction:column}.kp-tree{width:100%;max-height:40%;border-right:0;border-bottom:1px solid var(--dsw-alias-border-l2)}}
`;
function installStyles() {
  var existing = document.getElementById(STYLE_ID);
  if (existing !== null) return;
  var style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}
var HIDE_CSS_ID = "kaori-preview-hide-on-open";
function applyHideOnOpenCss(selectors) {
  var existing = document.getElementById(HIDE_CSS_ID);
  if (existing) existing.remove();
  var rules = selectors.map(function(s) {
    return "body.kaori-preview-open " + s + "{display:none!important}";
  }).join("\n");
  var style = document.createElement("style");
  style.id = HIDE_CSS_ID;
  style.textContent = rules;
  document.head.appendChild(style);
}
function startUI(rpcCall, ctx, sessionInfo) {
  "use strict";
  if (window.kaoriPreviewInjected) return;
  window.kaoriPreviewInjected = true;
  var panel = null;
  var treeEl = null;
  var viewEl = null;
  var currentSessionId = null;
  var currentCwd = null;
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }
  var _sessCache = null;
  var _sessCacheAt = 0;
  function resolveSession() {
    return Promise.resolve().then(function() {
      if (!sessionInfo) return null;
      if (_sessCache && Date.now() - _sessCacheAt < 5e3) return _sessCache;
      return sessionInfo().then(function(info) {
        if (info) {
          _sessCache = info;
          _sessCacheAt = Date.now();
        }
        return info;
      });
    }).then(function(info) {
      if (info && info.cwd) {
        currentSessionId = info.sessionId || currentSessionId;
        currentCwd = info.cwd;
        return { sessionId: info.sessionId, cwd: info.cwd };
      }
      return null;
    });
  }
  function findFrame() {
    var overlay = document.querySelector("[data-shell-overlay]");
    if (overlay && overlay.parentElement) return overlay.parentElement;
    var root = document.getElementById("root");
    if (!root) return null;
    var found = null;
    (function walk(el) {
      if (found) return;
      var s = getComputedStyle(el);
      var cols = s.gridTemplateColumns.split(" ").filter(function(x) {
        return x.trim() !== "";
      }).length;
      if (s.display === "grid" && cols >= 2 && (s.height === "100%" || el.clientHeight > 300)) {
        found = el;
        return;
      }
      for (var i = 0; i < el.children.length; i++) walk(el.children[i]);
    })(root);
    return found;
  }
  function findSidebar(frame) {
    if (!frame || !frame.children.length) return null;
    var best = null;
    var bestLeft = Infinity;
    for (var i = 0; i < frame.children.length; i++) {
      var col = frame.children[i];
      var rect = col.getBoundingClientRect();
      if (rect.width > 0 && rect.width < 420 && rect.left < bestLeft) {
        bestLeft = rect.left;
        best = col;
      }
    }
    if (best) return best;
    for (var j = 0; j < frame.children.length; j++) {
      var c = frame.children[j];
      var r = c.getBoundingClientRect();
      if (r.width > 0 && r.width < 420 && c.querySelector("button")) return c;
    }
    return null;
  }
  function insertRowToggle(sidebar) {
    var host = null;
    var templateBtn = null;
    var addBtn = sidebar.querySelector('button[aria-label="\u6DFB\u52A0\u5DE5\u4F5C\u533A"], button[aria-label="Add workspace"]');
    if (addBtn) {
      templateBtn = addBtn;
      var ha = addBtn.parentElement;
      if (ha) {
        var sec = ha.parentElement;
        if (sec && getComputedStyle(sec).display === "flex" && sec.clientHeight > 0 && sec.clientHeight <= 44) {
          host = sec;
        } else {
          host = ha;
        }
      }
    }
    if (!host) {
      var all = sidebar.querySelectorAll("button");
      for (var i = 0; i < all.length; i++) {
        var st = getComputedStyle(all[i]);
        if (st.borderRadius === "50%") {
          templateBtn = all[i];
          host = all[i].parentElement;
          break;
        }
      }
    }
    if (!host || !templateBtn) {
      console.warn("[Kaori Preview] no icon row found in sidebar");
      return false;
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = templateBtn.className + " kaori-preview-toggle";
    btn.title = "\u6587\u4EF6\u9884\u89C8";
    btn.setAttribute("aria-label", "\u6587\u4EF6\u9884\u89C8");
    btn.innerHTML = FILE_ICON_SVG;
    btn.addEventListener("click", togglePanel);
    host.appendChild(btn);
    return true;
  }
  function insertRailToggle(sidebar) {
    if (getComputedStyle(sidebar).position === "static") {
      sidebar.style.position = "relative";
    }
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "kaori-preview-toggle kaori-preview-rail";
    btn.title = "\u6587\u4EF6\u9884\u89C8";
    btn.setAttribute("aria-label", "\u6587\u4EF6\u9884\u89C8");
    btn.innerHTML = FILE_ICON_SVG;
    btn.addEventListener("click", togglePanel);
    sidebar.appendChild(btn);
    positionRailToggle(sidebar, btn);
    return true;
  }
  function positionRailToggle(sidebar, btn) {
    var anchor = sidebar.querySelector('button[aria-label="\u641C\u7D22\u4F1A\u8BDD"], button[aria-label="Search sessions"]') || sidebar.querySelector('button[aria-label="\u65B0\u5EFA\u4F1A\u8BDD"], button[aria-label="New session"]');
    if (anchor && btn) {
      var b = anchor.getBoundingClientRect();
      var s = sidebar.getBoundingClientRect();
      btn.style.top = b.bottom - s.top + 10 + "px";
    }
  }
  function needsRelocate(btn, rail, sidebar) {
    if (rail) {
      return !(btn.parentElement === sidebar);
    }
    var p = btn.parentElement;
    if (!p) return true;
    var ps = getComputedStyle(p);
    return !(ps.display === "flex" && ps.flexDirection !== "column");
  }
  function syncToggle() {
    try {
      var frame = findFrame();
      var sidebar = findSidebar(frame);
      if (!sidebar) return;
      var rail = sidebar.clientWidth < 150;
      var existing = sidebar.querySelector(".kaori-preview-toggle");
      if (existing && !needsRelocate(existing, rail, sidebar)) {
        if (rail) positionRailToggle(sidebar, existing);
        return;
      }
      if (existing) existing.remove();
      var ok = rail ? insertRailToggle(sidebar) : insertRowToggle(sidebar);
      console.log("[Kaori Preview] syncToggle: rail=" + rail + " width=" + sidebar.clientWidth + " inserted=" + ok);
    } catch (e) {
      console.warn("[Kaori Preview] syncToggle error:", e);
    }
  }
  function watchToggle(frame) {
    var t = null;
    var animating = false;
    var onTransStart = function(e) {
      if (e && e.propertyName === "grid-template-columns") animating = true;
    };
    var onTransEnd = function(e) {
      if (e && e.propertyName === "grid-template-columns") {
        animating = false;
        clearTimeout(t);
        syncToggle();
      }
    };
    frame.addEventListener("transitionstart", onTransStart, true);
    frame.addEventListener("transitionend", onTransEnd, true);
    new MutationObserver(function() {
      if (animating) return;
      clearTimeout(t);
      t = setTimeout(function() {
        syncToggle();
      }, 60);
    }).observe(frame, { childList: true, subtree: true, attributes: true });
  }
  function rpc(endpoint, payload) {
    return rpcCall(endpoint, payload);
  }
  function previewRpc(endpoint, pathOrPayload) {
    return resolveSession().then(function(session) {
      var payload = typeof pathOrPayload === "string" ? { path: pathOrPayload } : pathOrPayload || {};
      if (session && session.cwd) payload.cwd = session.cwd;
      else if (currentCwd) payload.cwd = currentCwd;
      if (session && session.sessionId) payload.sessionId = session.sessionId;
      else if (currentSessionId) payload.sessionId = currentSessionId;
      return rpc(endpoint, payload);
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function highlightCode(code) {
    var esc = escapeHtml(code);
    esc = esc.replace(/(&lt;!--[\s\S]*?--&gt;|\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)/g, '<span class="kp-tok-comment">$1</span>');
    esc = esc.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span class="kp-tok-string">$1</span>');
    esc = esc.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="kp-tok-num">$1</span>');
    esc = esc.replace(/\b(function|return|const|let|var|if|else|for|while|class|import|export|from|new|async|await|try|catch|throw|switch|case|break|default|typeof|instanceof|extends|super|this|null|undefined|true|false|def|print|lambda|None|True|False|public|private|static|void|int|string|bool|package|interface|enum|type|declare|readonly|yield|delete|in|of|do|continue|goto)\b/g, '<span class="kp-tok-kw">$1</span>');
    return esc;
  }
  function renderMarkdown(src) {
    var lines = src.split("\n");
    var html = "";
    var inCode = false;
    var codeBuf = [];
    var inList = false;
    function closeList() {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();
      if (/^```/.test(trimmed)) {
        if (inCode) {
          html += '<pre class="kp-md-code"><code>' + highlightCode(codeBuf.join("\n")) + "</code></pre>";
          codeBuf = [];
          inCode = false;
        } else {
          closeList();
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeBuf.push(line);
        continue;
      }
      var h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (h) {
        closeList();
        var level = h[1].length;
        html += "<h" + level + ' class="kp-md-h">' + inlineMd(h[2]) + "</h" + level + ">";
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        closeList();
        html += '<hr class="kp-md-hr">';
        continue;
      }
      if (/^>\s?/.test(trimmed)) {
        closeList();
        html += '<blockquote class="kp-md-quote">' + inlineMd(trimmed.replace(/^>\s?/, "")) + "</blockquote>";
        continue;
      }
      if (/^[-*+]\s+/.test(trimmed)) {
        if (!inList) {
          html += '<ul class="kp-md-ul">';
          inList = true;
        }
        html += "<li>" + inlineMd(trimmed.replace(/^[-*+]\s+/, "")) + "</li>";
        continue;
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        if (!inList) {
          html += '<ol class="kp-md-ol">';
          inList = true;
        }
        html += "<li>" + inlineMd(trimmed.replace(/^\d+\.\s+/, "")) + "</li>";
        continue;
      }
      closeList();
      if (trimmed === "") {
        html += '<div class="kp-md-space"></div>';
        continue;
      }
      html += '<p class="kp-md-p">' + inlineMd(line) + "</p>";
    }
    closeList();
    if (inCode) {
      html += '<pre class="kp-md-code"><code>' + highlightCode(codeBuf.join("\n")) + "</code></pre>";
    }
    return html;
  }
  function inlineMd(s) {
    var esc = escapeHtml(s);
    esc = esc.replace(/`([^`]+)`/g, '<code class="kp-md-inline">$1</code>');
    esc = esc.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    esc = esc.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    esc = esc.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a class="kp-md-link" href="$2" target="_blank" rel="noopener">$1</a>');
    return esc;
  }
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1024 / 1024).toFixed(1) + " MB";
  }
  function createPanel() {
    panel = document.createElement("div");
    panel.className = "kaori-preview-panel";
    panel.id = "kaori-preview-panel";
    panel.innerHTML = '<div class="kp-header">  <span class="kp-title">\u{1F4C2} \u6587\u4EF6\u9884\u89C8</span>  <button class="kp-close" type="button" title="\u5173\u95ED">\u2715</button></div><div class="kp-body">  <div class="kp-tree" id="kaori-preview-tree"></div>  <div class="kp-view" id="kaori-preview-view">    <div class="kp-empty">\u9009\u62E9\u5DE6\u4FA7\u6587\u4EF6\u67E5\u770B\u9884\u89C8</div>  </div></div>';
    panel.querySelector(".kp-close").addEventListener("click", closePanel);
    document.body.appendChild(panel);
    treeEl = panel.querySelector("#kaori-preview-tree");
    viewEl = panel.querySelector("#kaori-preview-view");
    return panel;
  }
  function openPanel() {
    if (!panel) createPanel();
    panel.classList.add("open");
    document.body.classList.add("kaori-preview-open");
    refreshTree();
  }
  function closePanel() {
    if (panel) panel.classList.remove("open");
    document.body.classList.remove("kaori-preview-open");
  }
  function togglePanel() {
    if (panel && panel.classList.contains("open")) closePanel();
    else openPanel();
  }
  function refreshTree() {
    if (!treeEl) return;
    treeEl.innerHTML = '<div class="kp-loading">\u52A0\u8F7D\u4E2D\u2026</div>';
    previewRpc("listDir", {}).then(function(res) {
      if (res.error) {
        treeEl.innerHTML = '<div class="kp-error">' + escapeHtml(res.error) + "</div>";
        return;
      }
      renderTree(res.entries || [], res.truncated);
    });
  }
  function renderTree(entries, truncated) {
    treeEl.innerHTML = "";
    if (!entries.length) {
      treeEl.innerHTML = '<div class="kp-empty">\u5DE5\u4F5C\u533A\u4E3A\u7A7A</div>';
      return;
    }
    var root = { name: "", children: [], files: [] };
    var map = { "": root };
    entries.forEach(function(e) {
      var parts = e.path.split("/");
      var parent = root;
      var cur = "";
      for (var i = 0; i < parts.length; i++) {
        cur = cur ? cur + "/" + parts[i] : parts[i];
        if (i === parts.length - 1 && !e.isDir) {
          parent.files.push({ name: parts[i], path: cur });
        } else {
          if (!map[cur]) {
            var node = { name: parts[i], path: cur, children: [], files: [] };
            map[cur] = node;
            parent.children.push(node);
          }
          parent = map[cur];
        }
      }
    });
    function nodeHtml(node, depth) {
      var html = "";
      node.children.forEach(function(child) {
        html += '<div class="kp-dir" style="padding-left:' + (depth * 12 + 4) + 'px"><span class="kp-dir-name">\u{1F4C1} ' + escapeHtml(child.name) + "</span></div>";
        html += nodeHtml(child, depth + 1);
      });
      node.files.forEach(function(f) {
        html += '<div class="kp-file" style="padding-left:' + (depth * 12 + 4) + 'px" data-path="' + escapeHtml(f.path) + '"><span class="kp-file-icon">' + fileIcon(f.name) + '</span><span class="kp-file-name">' + escapeHtml(f.name) + "</span></div>";
      });
      return html;
    }
    treeEl.innerHTML = nodeHtml(root, 0);
    if (truncated) {
      var tip = document.createElement("div");
      tip.className = "kp-empty";
      tip.style.padding = "10px 12px";
      tip.textContent = "\u26A0 \u76EE\u5F55\u8FC7\u6DF1\u6216\u6587\u4EF6\u8FC7\u591A\uFF0C\u5217\u8868\u5DF2\u622A\u65AD";
      treeEl.appendChild(tip);
    }
    treeEl.querySelectorAll(".kp-file").forEach(function(el) {
      el.addEventListener("click", function() {
        treeEl.querySelectorAll(".kp-file").forEach(function(x) {
          x.classList.remove("active");
        });
        el.classList.add("active");
        previewFile(el.getAttribute("data-path"));
      });
    });
  }
  function fileIcon(name2) {
    var ext = (name2.split(".").pop() || "").toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "\u{1F5BC}\uFE0F";
    if (["md", "txt"].includes(ext)) return "\u{1F4C4}";
    if (["js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "css", "html", "json", "yaml", "yml", "sh", "ps1"].includes(ext)) return "\u{1F4DD}";
    return "\u{1F4CE}";
  }
  function previewFile(path) {
    if (!viewEl) return;
    viewEl.innerHTML = '<div class="kp-loading">\u8BFB\u53D6\u4E2D\u2026</div>';
    var ext = (path.split(".").pop() || "").toLowerCase();
    var isImg = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext);
    if (isImg) {
      previewRpc("readImage", path).then(function(res) {
        if (res.error) {
          viewEl.innerHTML = '<div class="kp-error">' + escapeHtml(res.error) + "</div>";
          return;
        }
        viewEl.innerHTML = '<div class="kp-file-head"><span class="kp-file-title">' + escapeHtml(res.name) + '</span><span class="kp-meta">' + formatSize(res.size) + '</span></div><div class="kp-img-wrap"><img class="kp-img" src="' + res.dataUrl + '" alt="' + escapeHtml(path) + '"></div>';
      });
      return;
    }
    previewRpc("readText", path).then(function(res) {
      if (res.error) {
        viewEl.innerHTML = '<div class="kp-error">' + escapeHtml(res.error) + "</div>";
        return;
      }
      var body = "";
      if (ext === "md") {
        body = '<div class="kp-md">' + renderMarkdown(res.content) + "</div>";
      } else if (["js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "css", "html", "json", "yaml", "yml", "sh", "ps1", "sql", "xml"].includes(ext)) {
        body = '<pre class="kp-code"><code>' + highlightCode(res.content) + "</code></pre>";
      } else {
        body = '<pre class="kp-text">' + escapeHtml(res.content) + "</pre>";
      }
      viewEl.innerHTML = '<div class="kp-file-head"><span class="kp-file-title">' + escapeHtml(res.name) + '</span><span class="kp-meta">' + formatSize(res.size) + (res.truncated ? " \xB7 \u5DF2\u622A\u65AD" : "") + "</span></div>" + body;
    });
  }
  function watchSession() {
    try {
      var lastCwd = null;
      var sync = function() {
        resolveSession().then(function(info) {
          if (!info || !info.cwd) return;
          if (info.cwd !== lastCwd) {
            lastCwd = info.cwd;
            currentCwd = info.cwd;
            currentSessionId = info.sessionId || currentSessionId;
            if (panel && panel.classList.contains("open")) refreshTree();
          }
        });
      };
      sync();
      setInterval(function() {
        if (panel && panel.classList.contains("open")) sync();
      }, 2e3);
    } catch (e) {
      console.warn("[Kaori Preview] session watcher skipped:", e);
    }
  }
  function watchModals() {
    try {
      new MutationObserver(function() {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) closePanel();
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {
    }
  }
  function run() {
    var attempts = 0;
    var maxAttempts = 30;
    var timer = setInterval(function() {
      attempts++;
      var frame = findFrame();
      var sidebar = findSidebar(frame);
      if (sidebar) {
        clearInterval(timer);
        syncToggle();
        watchToggle(frame);
        setInterval(syncToggle, 300);
        watchSession();
        watchModals();
        console.log("[Kaori Preview] initialized, sidebar toggle synced (attempt " + attempts + ")");
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        watchSession();
        watchModals();
        console.warn("[Kaori Preview] sidebar not found after " + maxAttempts + " attempts; panel still usable via window.kaoriPreview");
      }
    }, 500);
  }
  ready(run);
  window.kaoriPreview = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    preview: previewFile
  };
}
return module.exports; } });

/**
 * kaori-preview — 客户端
 *
 * 文件预览 UI：
 *   1. 侧边栏底部注入 📂 按钮 → 打开右侧预览面板
 *   2. 面板 = 左侧文件树 + 右侧预览区（宽屏）或上下（窄屏）
 *   3. 点击文件 → 服务端读取 → 按类型渲染（文本/代码/Markdown/图片）
 *
 * 与 Kaori 主题适配：
 *   - 打开面板时给 <body> 打 kaori-preview-open 标记（CSS 隐藏右缘立绘/小猫）
 *   - 复用主题的 --dsw-* 令牌配色，暗色模式自动适配
 *   - 模态浮层打开时自动关闭（避免叠在设置等浮层之上）
 *
 * 模块导出 { name, inject, apply }——由 DSH 客户端运行时加载，
 * apply(ctx) 中通过 ctx.connection.rpc 调用服务端。
 */

export const name = 'kaori-preview-client';

export const inject = ['connection', 'sessions'];

export function apply(ctx) {
  installStyles();
  var rpcCall = function (endpoint, payload) {
    return ctx.connection.rpc.call('/kaori-preview', endpoint, payload || {}).then(function (res) {
      if (res && res.ok === true) return res.value;
      return { error: (res && res.error && res.error.message) || 'RPC failed' };
    }, function (e) {
      return { error: String(e) };
    });
  };
  // 主题适配：获取 hideOnOpen 配置，动态注入「面板打开时隐藏指定选择器」的 CSS。
  // 默认主题无需配置；其他主题（如带立绘/台词的装饰主题）在插件配置里添加选择器即可。
  rpcCall('getConfig', {}).then(function (res) {
    if (res && !res.error && Array.isArray(res.hideOnOpen) && res.hideOnOpen.length > 0) {
      applyHideOnOpenCss(res.hideOnOpen);
    }
  });
  // 提供当前会话信息给 UI：
  // 客户端 sessions 服务是 dsh-client-runtime 的 SessionsRuntime，
  // ctx.sessions.list 是快照 store（getSnapshot() → {ids, byId, current, ...}），
  // byId[current] 记录里带 cwd（SessionSummary 投影）
  var sessionInfo = function () {
    try {
      if (ctx.sessions && ctx.sessions.list && typeof ctx.sessions.list.getSnapshot === 'function') {
        var snap = ctx.sessions.list.getSnapshot();
        var byId = (snap && snap.byId) || {};
        var currentId = snap && snap.current;
        var rec = currentId ? byId[currentId] : null;
        if (rec && rec.cwd) {
          return Promise.resolve({ sessionId: currentId, cwd: rec.cwd });
        }
        // 回退：找一个带 cwd 的会话（最近更新的优先）
        var ids = (snap && snap.ids) || [];
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
    } catch (e) { /* ignore */ }
    return Promise.resolve(null);
  };
  startUI(rpcCall, ctx, sessionInfo);
}

var STYLE_ID = 'kaori-preview-styles';
// 线性文件图标（currentColor 跟随按钮颜色，与系统线条图标风格一致）
var FILE_ICON_SVG = '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 1.5H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5.5L8.5 1.5Z"></path><path d="M8.5 1.5V5.5H13"></path></svg>';
var CSS_TEXT = String.raw`
.kaori-preview-panel{position:fixed;top:0;right:0;bottom:0;width:min(640px,46vw);z-index:1200;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border-left:1px solid var(--dsw-alias-border-l2);box-shadow:-8px 0 24px rgba(26,26,46,.18);transform:translateX(105%);transition:transform .22s ease;font-family:var(--dsw-font-family,system-ui)}
.kaori-preview-panel.open{transform:translateX(0)}
.kp-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;background:var(--dsw-alias-bg-layer-1)}
.kp-title-wrap{display:flex;flex-direction:column;gap:2px;min-width:0}
.kp-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.kp-path{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kp-close{width:26px;height:26px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--dsw-alias-label-tertiary);cursor:pointer;font-size:13px}
.kp-close:hover{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-business-primary)}
.kp-body{display:flex;flex:1;min-height:0}
.kp-tree{width:210px;flex:none;overflow-y:auto;border-right:1px solid var(--dsw-alias-border-l2);padding:6px 0;background:var(--dsw-alias-bg-layer-2)}
.kp-view{flex:1;min-width:0;overflow:auto;padding:14px 16px}
.kp-dir,.kp-file{display:flex;align-items:center;gap:5px;padding:3px 8px;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kp-dir{color:var(--dsw-alias-label-primary);font-weight:500}
.kp-dir-name{font-size:12px}
.kp-dir-arrow{width:12px;flex:none;font-size:10px;color:var(--dsw-alias-label-tertiary)}
.kp-dir:hover{background:var(--dsw-alias-interactive-bg-hover)}
.kp-root{cursor:default}
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
  var style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}

// 根据 hideOnOpen 配置生成「面板打开时隐藏主题装饰」的 CSS（可配置主题适配）
var HIDE_CSS_ID = 'kaori-preview-hide-on-open';
function applyHideOnOpenCss(selectors) {
  var existing = document.getElementById(HIDE_CSS_ID);
  if (existing) existing.remove();
  var rules = selectors.map(function (s) {
    return 'body.kaori-preview-open ' + s + '{display:none!important}';
  }).join('\n');
  var style = document.createElement('style');
  style.id = HIDE_CSS_ID;
  style.textContent = rules;
  document.head.appendChild(style);
}

// ============================================================
// UI 实现（startUI 内，rpcCall 为闭包）
// ============================================================
function startUI(rpcCall, ctx, sessionInfo) {
  'use strict';

  if (window.kaoriPreviewInjected) return;
  window.kaoriPreviewInjected = true;

  var panel = null;
  var treeEl = null;
  var viewEl = null;
  var currentSessionId = null;
  var currentCwd = null;
  var currentRootPath = null;

  // ========== 工具 ==========
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  // 获取当前会话信息（优先用注入的 sessionInfo；5s 缓存避免每次 RPC 都打 session.list）
  var _sessCache = null;
  var _sessCacheAt = 0;
  function resolveSession() {
    return Promise.resolve().then(function () {
      if (!sessionInfo) return null;
      if (_sessCache && Date.now() - _sessCacheAt < 5000) return _sessCache;
      return sessionInfo().then(function (info) {
        if (info) { _sessCache = info; _sessCacheAt = Date.now(); }
        return info;
      });
    }).then(function (info) {
      if (info && info.cwd) {
        currentSessionId = info.sessionId || currentSessionId;
        currentCwd = info.cwd;
        return { sessionId: info.sessionId, cwd: info.cwd };
      }
      return null;
    });
  }

  // 找到 DSH 主框架（grid 布局容器）——优先用稳定属性 data-shell-overlay 定位
  function findFrame() {
    var overlay = document.querySelector('[data-shell-overlay]');
    if (overlay && overlay.parentElement) return overlay.parentElement;
    var root = document.getElementById('root');
    if (!root) return null;
    var found = null;
    (function walk(el) {
      if (found) return;
      var s = getComputedStyle(el);
      var cols = s.gridTemplateColumns.split(' ').filter(function (x) { return x.trim() !== ''; }).length;
      if (s.display === 'grid' && cols >= 2 && (s.height === '100%' || el.clientHeight > 300)) {
        found = el;
        return;
      }
      for (var i = 0; i < el.children.length; i++) walk(el.children[i]);
    })(root);
    return found;
  }

  // 找到侧边栏列：frame 里最靠左、宽度 < 420px 的列（几何判定，
  // 不依赖"列里有没有 button"，也能避开 details 列和注入的浮层）
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
    // 回退：任意含按钮的窄列
    for (var j = 0; j < frame.children.length; j++) {
      var c = frame.children[j];
      var r = c.getBoundingClientRect();
      if (r.width > 0 && r.width < 420 && c.querySelector('button')) return c;
    }
    return null;
  }

  // ========== 侧边栏按钮 ==========
  // 双模式插入：
  //   - wide（展开）：模板克隆系统图标按钮类名，插入图标行（sectionHeader 全宽）
  //   - rail（收起）：插到侧边栏底部，绝对定位悬浮（56px 窄栏放不下第二个图标）
  // MutationObserver 常驻同步：React 重渲染/展开收起切换会抹掉我们插入的 DOM，
  // 监听变化后按当前模式自动重插。

  // wide 模式：插入图标行
  function insertRowToggle(sidebar) {
    var host = null;
    var templateBtn = null;

    // ① 首选：添加工作区按钮（workspace.add，中文/英文文案）→ 其所在行
    var addBtn = sidebar.querySelector('button[aria-label="添加工作区"], button[aria-label="Add workspace"]');
    if (addBtn) {
      templateBtn = addBtn;
      var ha = addBtn.parentElement; // headerActions（overflow:hidden，不能直接插）
      if (ha) {
        var sec = ha.parentElement; // sectionHeader（全宽 flex 行）
        if (sec && getComputedStyle(sec).display === 'flex' && sec.clientHeight > 0 && sec.clientHeight <= 44) {
          host = sec;
        } else {
          host = ha;
        }
      }
    }

    // ② 兜底：任意圆形图标按钮 → 插入其所在行
    if (!host) {
      var all = sidebar.querySelectorAll('button');
      for (var i = 0; i < all.length; i++) {
        var st = getComputedStyle(all[i]);
        if (st.borderRadius === '50%') {
          templateBtn = all[i];
          host = all[i].parentElement;
          break;
        }
      }
    }

    if (!host || !templateBtn) {
      console.warn('[Kaori Preview] no icon row found in sidebar');
      return false;
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = templateBtn.className + ' kaori-preview-toggle';
    btn.title = '文件预览';
    btn.setAttribute('aria-label', '文件预览');
    btn.innerHTML = FILE_ICON_SVG;
    btn.addEventListener('click', togglePanel);
    host.appendChild(btn);
    return true;
  }

  // rail 模式：absolute 定位悬浮在「新建会话」下方（不占流内位置，
  // 不打乱 React 的 children diff，避免展开/收起时系统按钮错乱）
  function insertRailToggle(sidebar) {
    if (getComputedStyle(sidebar).position === 'static') {
      sidebar.style.position = 'relative';
    }
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kaori-preview-toggle kaori-preview-rail';
    btn.title = '文件预览';
    btn.setAttribute('aria-label', '文件预览');
    btn.innerHTML = FILE_ICON_SVG;
    btn.addEventListener('click', togglePanel);
    sidebar.appendChild(btn);
    positionRailToggle(sidebar, btn);
    return true;
  }

  // 计算 rail 按钮的 top：对齐「搜索」按钮底部（图标序列最下方，紧挨着）
  function positionRailToggle(sidebar, btn) {
    var anchor = sidebar.querySelector('button[aria-label="搜索会话"], button[aria-label="Search sessions"]')
      || sidebar.querySelector('button[aria-label="新建会话"], button[aria-label="New session"]');
    if (anchor && btn) {
      var b = anchor.getBoundingClientRect();
      var s = sidebar.getBoundingClientRect();
      btn.style.top = (b.bottom - s.top + 10) + 'px';
    }
  }

  // 保证按钮存在且位置与当前模式匹配
  // 按钮是否在当前模式应有的位置
  //  rail：absolute 挂在 sidebar 上（sidebar 直接子元素）
  //  wide：在 flex 行图标行内（sectionHeader 等）
  function needsRelocate(btn, rail, sidebar) {
    if (rail) {
      return !(btn.parentElement === sidebar);
    }
    var p = btn.parentElement;
    if (!p) return true;
    var ps = getComputedStyle(p);
    return !(ps.display === 'flex' && ps.flexDirection !== 'column');
  }

  function syncToggle() {
    try {
      var frame = findFrame();
      var sidebar = findSidebar(frame);
      if (!sidebar) return;
      var rail = sidebar.clientWidth < 150; // rail ≈56px，wide ≈280px
      var existing = sidebar.querySelector('.kaori-preview-toggle');
      if (existing && !needsRelocate(existing, rail, sidebar)) {
        if (rail) positionRailToggle(sidebar, existing); // 位置可能过时，重算
        return;
      }
      if (existing) existing.remove();
      var ok = rail ? insertRailToggle(sidebar) : insertRowToggle(sidebar);
      console.log('[Kaori Preview] syncToggle: rail=' + rail + ' width=' + sidebar.clientWidth + ' inserted=' + ok);
    } catch (e) {
      console.warn('[Kaori Preview] syncToggle error:', e);
    }
  }

  // 常驻监听：观察稳定的 frame（不绑定 sidebar，避免元素被 React 重建后监听失效），
  // React 重渲染/模式切换抹掉按钮后自动重插。
  // 侧边栏展开/收起有 grid-template-columns 动画（约 200ms），动画期间宽度是过渡值，
  // rail 判断会抖动——所以动画中跳过同步，transitionend 时立即同步，消除切换延迟。
  function watchToggle(frame) {
    var t = null;
    var animating = false;
    var onTransStart = function (e) {
      if (e && e.propertyName === 'grid-template-columns') animating = true;
    };
    var onTransEnd = function (e) {
      if (e && e.propertyName === 'grid-template-columns') {
        animating = false;
        clearTimeout(t);
        syncToggle();
      }
    };
    frame.addEventListener('transitionstart', onTransStart, true);
    frame.addEventListener('transitionend', onTransEnd, true);
    new MutationObserver(function () {
      if (animating) return; // 动画中不动，transitionend 兜底
      clearTimeout(t);
      t = setTimeout(function () { syncToggle(); }, 60);
    }).observe(frame, { childList: true, subtree: true, attributes: true });
  }

  function rpc(endpoint, payload) {
    return rpcCall(endpoint, payload);
  }

  // 统一 RPC 入口：先解析会话（拿 cwd/sessionId），再带 sessionId/cwd 调用
  function previewRpc(endpoint, pathOrPayload) {
    return resolveSession().then(function (session) {
      var payload = typeof pathOrPayload === 'string'
        ? { path: pathOrPayload }
        : (pathOrPayload || {});
      if (session && session.cwd) payload.cwd = session.cwd;
      else if (currentCwd) payload.cwd = currentCwd;
      if (session && session.sessionId) payload.sessionId = session.sessionId;
      else if (currentSessionId) payload.sessionId = currentSessionId;
      return rpc(endpoint, payload);
    });
  }

  // ========== 渲染器 ==========
  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // 简单代码着色（关键词/字符串/注释/数字）
  function highlightCode(code) {
    var esc = escapeHtml(code);
    esc = esc.replace(/(&lt;!--[\s\S]*?--&gt;|\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*)/g, '<span class="kp-tok-comment">$1</span>');
    esc = esc.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, '<span class="kp-tok-string">$1</span>');
    esc = esc.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="kp-tok-num">$1</span>');
    esc = esc.replace(/\b(function|return|const|let|var|if|else|for|while|class|import|export|from|new|async|await|try|catch|throw|switch|case|break|default|typeof|instanceof|extends|super|this|null|undefined|true|false|def|print|lambda|None|True|False|public|private|static|void|int|string|bool|package|interface|enum|type|declare|readonly|yield|delete|in|of|do|continue|goto)\b/g, '<span class="kp-tok-kw">$1</span>');
    return esc;
  }

  // 极简 Markdown 渲染
  function renderMarkdown(src) {
    var lines = src.split('\n');
    var html = '';
    var inCode = false;
    var codeBuf = [];
    var inList = false;

    function closeList() {
      if (inList) { html += '</ul>'; inList = false; }
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var trimmed = line.trim();

      if (/^```/.test(trimmed)) {
        if (inCode) {
          html += '<pre class="kp-md-code"><code>' + highlightCode(codeBuf.join('\n')) + '</code></pre>';
          codeBuf = [];
          inCode = false;
        } else {
          closeList();
          inCode = true;
        }
        continue;
      }
      if (inCode) { codeBuf.push(line); continue; }

      var h = /^(#{1,6})\s+(.*)$/.exec(trimmed);
      if (h) {
        closeList();
        var level = h[1].length;
        html += '<h' + level + ' class="kp-md-h">' + inlineMd(h[2]) + '</h' + level + '>';
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        closeList();
        html += '<hr class="kp-md-hr">';
        continue;
      }
      if (/^>\s?/.test(trimmed)) {
        closeList();
        html += '<blockquote class="kp-md-quote">' + inlineMd(trimmed.replace(/^>\s?/, '')) + '</blockquote>';
        continue;
      }
      if (/^[-*+]\s+/.test(trimmed)) {
        if (!inList) { html += '<ul class="kp-md-ul">'; inList = true; }
        html += '<li>' + inlineMd(trimmed.replace(/^[-*+]\s+/, '')) + '</li>';
        continue;
      }
      if (/^\d+\.\s+/.test(trimmed)) {
        if (!inList) { html += '<ol class="kp-md-ol">'; inList = true; }
        html += '<li>' + inlineMd(trimmed.replace(/^\d+\.\s+/, '')) + '</li>';
        continue;
      }
      closeList();
      if (trimmed === '') { html += '<div class="kp-md-space"></div>'; continue; }
      html += '<p class="kp-md-p">' + inlineMd(line) + '</p>';
    }
    closeList();
    if (inCode) {
      html += '<pre class="kp-md-code"><code>' + highlightCode(codeBuf.join('\n')) + '</code></pre>';
    }
    return html;
  }

  function inlineMd(s) {
    var esc = escapeHtml(s);
    esc = esc.replace(/`([^`]+)`/g, '<code class="kp-md-inline">$1</code>');
    esc = esc.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    esc = esc.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    esc = esc.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a class="kp-md-link" href="$2" target="_blank" rel="noopener">$1</a>');
    return esc;
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  // ========== 面板 ==========
  function createPanel() {
    panel = document.createElement('div');
    panel.className = 'kaori-preview-panel';
    panel.id = 'kaori-preview-panel';
    panel.innerHTML =
      '<div class="kp-header">' +
      '  <div class="kp-title-wrap">' +
      '    <span class="kp-title">📂 文件预览</span>' +
      '    <span class="kp-path" id="kaori-preview-path" title=""></span>' +
      '  </div>' +
      '  <button class="kp-close" type="button" title="关闭">✕</button>' +
      '</div>' +
      '<div class="kp-body">' +
      '  <div class="kp-tree" id="kaori-preview-tree"></div>' +
      '  <div class="kp-view" id="kaori-preview-view">' +
      '    <div class="kp-empty">选择左侧文件查看预览</div>' +
      '  </div>' +
      '</div>';
    panel.querySelector('.kp-close').addEventListener('click', closePanel);
    document.body.appendChild(panel);
    treeEl = panel.querySelector('#kaori-preview-tree');
    viewEl = panel.querySelector('#kaori-preview-view');
    return panel;
  }

  function openPanel() {
    if (!panel) createPanel();
    panel.classList.add('open');
    document.body.classList.add('kaori-preview-open');
    refreshTree();
  }

  function closePanel() {
    if (panel) panel.classList.remove('open');
    document.body.classList.remove('kaori-preview-open');
  }

  function togglePanel() {
    if (panel && panel.classList.contains('open')) closePanel();
    else openPanel();
  }

  // ========== 文件树（懒加载 + 可折叠）==========
  // dirCache: 目录路径 -> 子项数组（已加载缓存）；expanded: 目录路径 -> 是否展开
  var dirCache = {};
  var expanded = {};

  function refreshTree() {
    if (!treeEl) return;
    dirCache = {};
    expanded = {};
    treeEl.innerHTML = '<div class="kp-loading">加载中…</div>';
    previewRpc('listDir', { path: '' }).then(function (res) {
      if (res.error) {
        treeEl.innerHTML = '<div class="kp-error">' + escapeHtml(res.error) + '</div>';
        return;
      }
      // 显示当前根目录路径（服务端返回的 cwd），让用户一眼确认看的是哪个文件夹
      if (res.cwd) {
        currentRootPath = res.cwd;
        var pathEl = panel && panel.querySelector('#kaori-preview-path');
        if (pathEl) { pathEl.textContent = res.cwd; pathEl.title = res.cwd; }
      }
      dirCache[''] = res.entries || [];
      renderTree();
    });
  }

  function nodeHtml(dirPath, depth) {
    var entries = dirCache[dirPath] || [];
    var html = '';
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var pad = depth * 12 + 8;
      if (e.isDir) {
        var open = !!expanded[e.path];
        html += '<div class="kp-dir" style="padding-left:' + pad + 'px" data-path="' + escapeHtml(e.path) + '">' +
          '<span class="kp-dir-arrow">' + (open ? '▾' : '▸') + '</span>' +
          '<span class="kp-dir-name">📁 ' + escapeHtml(e.name) + '</span></div>';
        if (open) {
          if (dirCache[e.path] && dirCache[e.path].length === 0) {
            html += '<div class="kp-empty" style="padding:4px 12px 4px ' + (pad + 20) + 'px">（空）</div>';
          } else {
            html += nodeHtml(e.path, depth + 1);
          }
        }
      } else {
        html += '<div class="kp-file" style="padding-left:' + pad + 'px" data-path="' + escapeHtml(e.path) + '">' +
          '<span class="kp-file-icon">' + fileIcon(e.name) + '</span>' +
          '<span class="kp-file-name">' + escapeHtml(e.name) + '</span></div>';
      }
    }
    return html;
  }

  function renderTree() {
    if (!treeEl) return;
    // 根目录行：显示当前工作区文件夹名，明确树的根
    var rootRow = '';
    if (currentRootPath) {
      var rootName = currentRootPath.split(/[\\/]/).filter(Boolean).pop() || currentRootPath;
      rootRow = '<div class="kp-dir kp-root" style="padding-left:4px;font-weight:700">' +
        '<span class="kp-dir-name">📁 ' + escapeHtml(rootName) + '</span></div>';
    }
    treeEl.innerHTML = rootRow + nodeHtml('', 0);
    bindTreeEvents();
  }

  function findDirRow(path) {
    var found = null;
    treeEl.querySelectorAll('.kp-dir[data-path]').forEach(function (el) {
      if (el.getAttribute('data-path') === path) found = el;
    });
    return found;
  }

  function toggleDir(path) {
    if (expanded[path]) {
      expanded[path] = false;
      renderTree();
      return;
    }
    expanded[path] = true;
    renderTree();
    if (dirCache[path]) return; // 已缓存，直接展开
    var row = findDirRow(path);
    if (row) {
      var loader = document.createElement('div');
      loader.className = 'kp-loading';
      loader.style.padding = '6px 12px';
      loader.textContent = '加载中…';
      row.insertAdjacentElement('afterend', loader);
    }
    previewRpc('listDir', { path: path }).then(function (res) {
      if (res.error) {
        dirCache[path] = [];
        expanded[path] = false;
        console.warn('[Kaori Preview] expand failed:', res.error);
      } else {
        dirCache[path] = res.entries || [];
      }
      renderTree();
    });
  }

  function bindTreeEvents() {
    treeEl.querySelectorAll('.kp-dir[data-path]').forEach(function (el) {
      el.addEventListener('click', function () {
        toggleDir(el.getAttribute('data-path'));
      });
    });
    treeEl.querySelectorAll('.kp-file').forEach(function (el) {
      el.addEventListener('click', function () {
        treeEl.querySelectorAll('.kp-file').forEach(function (x) { x.classList.remove('active'); });
        el.classList.add('active');
        previewFile(el.getAttribute('data-path'));
      });
    });
  }

  function fileIcon(name) {
    var ext = (name.split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return '🖼️';
    if (['md', 'txt'].includes(ext)) return '📄';
    if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'css', 'html', 'json', 'yaml', 'yml', 'sh', 'ps1'].includes(ext)) return '📝';
    return '📎';
  }

  // ========== 预览 ==========
  function previewFile(path) {
    if (!viewEl) return;
    viewEl.innerHTML = '<div class="kp-loading">读取中…</div>';
    var ext = (path.split('.').pop() || '').toLowerCase();
    var isImg = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);

    if (isImg) {
      previewRpc('readImage', path).then(function (res) {
        if (res.error) { viewEl.innerHTML = '<div class="kp-error">' + escapeHtml(res.error) + '</div>'; return; }
        viewEl.innerHTML =
          '<div class="kp-file-head"><span class="kp-file-title">' + escapeHtml(res.name) + '</span>' +
          '<span class="kp-meta">' + formatSize(res.size) + '</span></div>' +
          '<div class="kp-img-wrap"><img class="kp-img" src="' + res.dataUrl + '" alt="' + escapeHtml(path) + '"></div>';
      });
      return;
    }

    previewRpc('readText', path).then(function (res) {
      if (res.error) {
        viewEl.innerHTML = '<div class="kp-error">' + escapeHtml(res.error) + '</div>';
        return;
      }
      var body = '';
      if (ext === 'md') {
        body = '<div class="kp-md">' + renderMarkdown(res.content) + '</div>';
      } else if (['js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'css', 'html', 'json', 'yaml', 'yml', 'sh', 'ps1', 'sql', 'xml'].includes(ext)) {
        body = '<pre class="kp-code"><code>' + highlightCode(res.content) + '</code></pre>';
      } else {
        body = '<pre class="kp-text">' + escapeHtml(res.content) + '</pre>';
      }
      viewEl.innerHTML =
        '<div class="kp-file-head"><span class="kp-file-title">' + escapeHtml(res.name) + '</span>' +
        '<span class="kp-meta">' + formatSize(res.size) + (res.truncated ? ' · 已截断' : '') + '</span></div>' +
        body;
    });
  }

  // ========== 会话切换检测（通过注入的 sessionInfo 感知 cwd 变化）==========
  function watchSession() {
    try {
      var lastCwd = null;
      var sync = function () {
        resolveSession().then(function (info) {
          if (!info || !info.cwd) return;
          if (info.cwd !== lastCwd) {
            lastCwd = info.cwd;
            currentCwd = info.cwd;
            currentSessionId = info.sessionId || currentSessionId;
            if (panel && panel.classList.contains('open')) refreshTree();
          }
        });
      };
      sync();
      // 会话切换没有稳定 DOM 钩子，用轻量轮询感知（每 2s，仅面板打开时有效）
      setInterval(function () {
        if (panel && panel.classList.contains('open')) sync();
      }, 2000);
    } catch (e) {
      console.warn('[Kaori Preview] session watcher skipped:', e);
    }
  }

  // ========== 模态浮层时自动关闭 ==========
  function watchModals() {
    try {
      new MutationObserver(function () {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) closePanel();
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) { /* ignore */ }
  }

  // ========== 启动 ==========
  function run() {
    var attempts = 0;
    var maxAttempts = 30; // 30 × 500ms = 15s，覆盖 SPA 慢加载
    var timer = setInterval(function () {
      attempts++;
      var frame = findFrame();
      var sidebar = findSidebar(frame);
      if (sidebar) {
        clearInterval(timer);
        syncToggle();
        watchToggle(frame);
        // 兜底轮询：observer/transitionend 失效或漏报时也能保证按钮存在
        setInterval(syncToggle, 300);
        watchSession();
        watchModals();
        console.log('[Kaori Preview] initialized, sidebar toggle synced (attempt ' + attempts + ')');
        return;
      }
      if (attempts >= maxAttempts) {
        clearInterval(timer);
        watchSession();
        watchModals();
        console.warn('[Kaori Preview] sidebar not found after ' + maxAttempts + ' attempts; panel still usable via window.kaoriPreview');
      }
    }, 500);
  }

  ready(run);

  // 暴露给主题/外部：window.kaoriPreview
  window.kaoriPreview = {
    open: openPanel,
    close: closePanel,
    toggle: togglePanel,
    preview: previewFile
  };
}

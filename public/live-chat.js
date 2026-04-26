(function () {
  'use strict';

  var SESSION_USER = window.__LIVE_CHAT_SESSION_USER__ || null;
  var MY_USER_ID = window.__LIVE_CHAT_USER_ID__;
  if (!SESSION_USER || MY_USER_ID == null || MY_USER_ID === '') {
    return;
  }

  var WS_PROTO = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  var WS_URL = WS_PROTO + '//' + window.location.host;
  var UI_ROLE = window.__LIVE_CHAT_UI_ROLE__ === 'staff' ? 'staff' : 'customer';

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* 与 lib/linkifyChatText.js 保持一致 */
  function linkifyChatText(text) {
    if (text == null || text === '') return '';
    var s = escapeHtml(String(text));
    s = s.replace(/https?:\/\/[^\s<&]+/gi, function (full) {
      var href = full.replace(/"/g, '%22');
      return '<a class="chat-link" href="' + href + '" target="_blank" rel="noopener noreferrer">' + full + '</a>';
    });
    s = s.replace(/(^|[^\w/])(\/faqs\/\d+)\b/g, function (m, pre, path) {
      return pre + '<a class="chat-link" href="' + path + '" target="_blank" rel="noopener noreferrer">' + path + '</a>';
    });
    return s;
  }

  function fmtTime(ts) {
    var d = new Date(ts);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function msgKind(m) {
    return m.kind || 'customer';
  }

  function isMine(m) {
    return m.userId != null && String(m.userId) === String(MY_USER_ID);
  }

  var root = document.createElement('div');
  root.className = 'live-chat';
  root.setAttribute('aria-live', 'polite');
  var panelTitle = UI_ROLE === 'staff' ? '客服工作台' : '在线客服';
  var fabTitle = UI_ROLE === 'staff' ? '客服工作台' : '在线客服';
  var staffFsBtn =
    UI_ROLE === 'staff'
      ? '<button type="button" class="live-chat__fs" id="live-chat-fs" aria-label="全屏" title="全屏">' +
        '<svg class="live-chat__fs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
        '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75H18m0 0h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25H18m0 0h-4.5m4.5 0v-4.5m0 4.5L15 15M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15"/>' +
        '</svg></button>'
      : '';
  var muteIconOn =
    '<svg class="live-chat__mute-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M11 4.702a.705.705 0 0 0-1.211-.498l-4.579 3.117A2.5 2.5 0 0 0 4 9.117V14.88a2.5 2.5 0 0 0 1.21 2.201l4.579 3.116A.705.705 0 0 0 11 19.298V4.702z"/>' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M16 9a5 5 0 0 1 0 6"/>' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M19.364 5.636a9 9 0 0 1 0 12.728"/>' +
    '</svg>';
  var muteIconOff =
    '<svg class="live-chat__mute-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M11 4.702a.705.705 0 0 0-1.211-.498l-4.579 3.117A2.5 2.5 0 0 0 4 9.117v6.762a2.5 2.5 0 0 0 1.21 2.201l4.579 3.116A.705.705 0 0 0 11 19.298V4.702z"/>' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="m22 9-6 6"/>' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="m16 9 6 6"/>' +
    '</svg>';
  var headerMuteBtn =
    '<button type="button" class="live-chat__mute" id="live-chat-mute" aria-pressed="false" aria-label="新消息提示音已开启，点击静音" title="新消息提示音">' +
    muteIconOn +
    '</button>';
  var staffLayoutOpen =
    UI_ROLE === 'staff'
      ? '<div class="live-chat__body"><aside class="live-chat__sessions" id="live-chat-sessions"><div class="live-chat__sessions-head">会话</div><div class="live-chat__sessions-list" id="live-chat-sessions-list" role="list"></div></aside><div class="live-chat__thread">'
      : '';
  var staffLayoutClose = UI_ROLE === 'staff' ? '</div></div>' : '';

  var kbSection =
    UI_ROLE === 'staff'
      ? '<div class="live-chat__kb" id="live-chat-kb">' +
        '<button type="button" class="live-chat__kb-toggle" id="live-chat-kb-toggle" aria-expanded="false" aria-controls="live-chat-kb-panel">' +
        '引用知识库</button>' +
        '<div class="live-chat__kb-panel" id="live-chat-kb-panel" hidden>' +
        '<div class="live-chat__kb-search">' +
        '<input type="search" id="live-chat-kb-q" class="live-chat__kb-input" placeholder="搜索标题、问题或答案…" maxlength="100" aria-label="搜索知识库">' +
        '<button type="button" class="btn btn-outline btn-sm" id="live-chat-kb-search">搜索</button></div>' +
        '<div class="live-chat__kb-results" id="live-chat-kb-results" aria-live="polite"></div></div></div>'
      : '';
  root.innerHTML =
    '<button type="button" class="live-chat__fab" id="live-chat-fab" aria-expanded="false" aria-controls="live-chat-panel" title="' +
    escapeHtml(fabTitle) +
    '">' +
    '<span class="live-chat__fab-badge" id="live-chat-badge" hidden aria-hidden="true"></span>' +
    '<svg class="live-chat__fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>' +
    '</svg></button>' +
    '<div class="live-chat__panel" id="live-chat-panel" hidden>' +
    '<div class="live-chat__head">' +
    '<div class="live-chat__title-wrap">' +
    '<span class="live-chat__title" id="live-chat-title"></span>' +
    '<span class="live-chat__account-sep" aria-hidden="true">·</span>' +
    '<span class="live-chat__account" id="live-chat-account" title="当前登录账号"></span></div>' +
    '<span class="live-chat__status" id="live-chat-status">连接中…</span>' +
    staffFsBtn +
    headerMuteBtn +
    '<button type="button" class="live-chat__close" id="live-chat-close" aria-label="关闭">×</button></div>' +
    staffLayoutOpen +
    '<div class="live-chat__hint" id="live-chat-hint"></div>' +
    kbSection +
    '<div class="live-chat__msgs" id="live-chat-msgs" role="log"></div>' +
    '<form class="live-chat__form" id="live-chat-form">' +
    '<textarea id="live-chat-input" class="live-chat__input live-chat__input--compose" rows="2" maxlength="2000" placeholder="输入消息…" autocomplete="off" aria-label="消息内容"></textarea>' +
    '<button type="submit" class="live-chat__send btn btn-primary btn-sm">发送</button></form>' +
    staffLayoutClose +
    '</div>';

  document.body.appendChild(root);

  var titleEl = document.getElementById('live-chat-title');
  var accountEl = document.getElementById('live-chat-account');
  var hintEl = document.getElementById('live-chat-hint');
  titleEl.textContent = panelTitle;
  if (accountEl) accountEl.textContent = SESSION_USER;
  if (UI_ROLE === 'staff') {
    hintEl.textContent =
      '左侧选择客户会话后查看历史并回复；新消息按会话隔离。可全屏（Esc 退出）、引用知识库。标题栏喇叭可开关新消息提示音；非当前会话或收起窗口时若有提示音，需先点开过一次聊天以允许浏览器发声。';
  } else {
    hintEl.textContent =
      '您与全体客服对应对话在本会话内；其他用户有独立会话，不会看到彼此内容。聊天记录页含本会话内客服回复。标题栏喇叭可开关新消息提示音；窗口收起或切到后台时，若有提示音需先点开过一次聊天以允许浏览器发声。';
  }

  var fab = document.getElementById('live-chat-fab');
  var panel = document.getElementById('live-chat-panel');
  if (UI_ROLE === 'staff') {
    panel.classList.add('live-chat__panel--staff');
  }
  muteBtnEl = document.getElementById('live-chat-mute');
  if (muteBtnEl) {
    syncMuteButtonUI();
    muteBtnEl.addEventListener('click', function (e) {
      e.stopPropagation();
      primeNotifyAudioFromUserGesture();
      setChatNotifySoundMuted(!isChatNotifySoundMuted());
    });
  }
  var closeBtn = document.getElementById('live-chat-close');
  var statusEl = document.getElementById('live-chat-status');
  var msgsEl = document.getElementById('live-chat-msgs');
  var form = document.getElementById('live-chat-form');
  var input = document.getElementById('live-chat-input');
  var sessionsListEl = UI_ROLE === 'staff' ? document.getElementById('live-chat-sessions-list') : null;
  var activeSessionId = null;
  /** @type {Object<number, number>} */
  var sessionUnread = {};

  var ws = null;
  var reconnectTimer = null;
  var everOpened = false;
  var reconnectFailures = 0;
  var unreadCount = 0;
  var baseTitle = document.title;
  var badgeEl = document.getElementById('live-chat-badge');
  var muteBtnEl = null;

  function isChatNotifySoundMuted() {
    try {
      return window.localStorage && localStorage.getItem('live_chat_sound') === '0';
    } catch (e) {
      return false;
    }
  }

  function syncMuteButtonUI() {
    if (!muteBtnEl) return;
    var muted = isChatNotifySoundMuted();
    muteBtnEl.setAttribute('aria-pressed', muted ? 'true' : 'false');
    muteBtnEl.setAttribute(
      'aria-label',
      muted ? '新消息提示音已静音，点击开启' : '新消息提示音已开启，点击静音'
    );
    muteBtnEl.setAttribute('title', muted ? '提示音：关（点击开启）' : '提示音：开（点击静音）');
    muteBtnEl.classList.toggle('live-chat__mute--muted', muted);
    muteBtnEl.innerHTML = muted ? muteIconOff : muteIconOn;
  }

  function setChatNotifySoundMuted(muted) {
    try {
      if (muted) {
        localStorage.setItem('live_chat_sound', '0');
      } else {
        localStorage.removeItem('live_chat_sound');
      }
    } catch (e) {}
    syncMuteButtonUI();
  }

  function updateBadge() {
    if (!badgeEl) return;
    if (unreadCount <= 0) {
      badgeEl.hidden = true;
      badgeEl.textContent = '';
      fab.removeAttribute('data-unread');
      return;
    }
    badgeEl.hidden = false;
    badgeEl.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    fab.setAttribute('data-unread', '1');
  }

  function staffUnreadTotal() {
    var t = 0;
    for (var k in sessionUnread) {
      if (Object.prototype.hasOwnProperty.call(sessionUnread, k)) t += sessionUnread[k];
    }
    return t;
  }

  function syncStaffFabBadge() {
    if (UI_ROLE !== 'staff') return;
    unreadCount = staffUnreadTotal();
    updateBadge();
  }

  function bumpSessionUnread(sid) {
    sid = Number(sid);
    if (!sid) return;
    sessionUnread[sid] = (sessionUnread[sid] || 0) + 1;
    syncStaffFabBadge();
  }

  function clearSessionUnreadFor(sid) {
    sid = Number(sid);
    if (!sid || !sessionUnread[sid]) return;
    delete sessionUnread[sid];
    syncStaffFabBadge();
  }

  function makeSessionRow(s) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'live-chat__session-row';
    btn.setAttribute('data-session-id', String(s.id));
    var name = s.displayName || s.username || '用户';
    var prev = s.lastPreview || '';
    btn.innerHTML =
      '<span class="live-chat__session-name">' +
      escapeHtml(name) +
      '</span>' +
      '<span class="live-chat__session-preview">' +
      escapeHtml(prev) +
      '</span>';
    btn.addEventListener('click', function () {
      document.querySelectorAll('.live-chat__session-row--active').forEach(function (x) {
        x.classList.remove('live-chat__session-row--active');
      });
      btn.classList.add('live-chat__session-row--active');
      selectStaffSession(s.id);
    });
    return btn;
  }

  function renderSessionsList(sessions) {
    if (!sessionsListEl || !Array.isArray(sessions)) return;
    sessionsListEl.innerHTML = '';
    sessions.forEach(function (s) {
      sessionsListEl.appendChild(makeSessionRow(s));
    });
  }

  function prependSessionRow(s) {
    if (!sessionsListEl) return;
    var existing = sessionsListEl.querySelector('[data-session-id="' + String(s.id) + '"]');
    if (existing) {
      sessionsListEl.removeChild(existing);
    }
    sessionsListEl.insertBefore(makeSessionRow(s), sessionsListEl.firstChild);
  }

  function onSessionActivity(d) {
    if (!sessionsListEl || d.sessionId == null) return;
    var sid = String(d.sessionId);
    var row = sessionsListEl.querySelector('[data-session-id="' + sid + '"]');
    if (!row) return;
    var prevEl = row.querySelector('.live-chat__session-preview');
    if (prevEl && d.lastPreview != null) prevEl.textContent = d.lastPreview;
    sessionsListEl.insertBefore(row, sessionsListEl.firstChild);
  }

  function selectStaffSession(sid) {
    sid = Number(sid);
    if (!sid || !ws || ws.readyState !== WebSocket.OPEN) return;
    clearSessionUnreadFor(sid);
    activeSessionId = sid;
    clearMsgs();
    ws.send(JSON.stringify({ type: 'fetchHistory', sessionId: sid }));
    var sendBtn = form.querySelector('.live-chat__send');
    if (sendBtn) sendBtn.disabled = false;
  }

  function maybeAskNotificationPermission() {
    try {
      if (typeof Notification === 'undefined') return;
      if (sessionStorage.getItem('live_chat_notif_asked')) return;
      sessionStorage.setItem('live_chat_notif_asked', '1');
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (e) {}
  }

  var notifyAudioCtx = null;

  function ensureNotifyAudioContext() {
    if (notifyAudioCtx) return notifyAudioCtx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      notifyAudioCtx = new AC();
      return notifyAudioCtx;
    } catch (e) {
      return null;
    }
  }

  /** 解除浏览器「需用户手势才能发声」限制；在打开面板或点悬浮钮时调用 */
  function primeNotifyAudioFromUserGesture() {
    var ctx = ensureNotifyAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(function () {});
    }
  }

  function playChatNotifySound() {
    if (isChatNotifySoundMuted()) {
      return;
    }

    function scheduleBeeps(ctx) {
      var t0 = ctx.currentTime;
      function one(freq, start, dur, peak) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(peak, start + 0.018);
        g.gain.exponentialRampToValueAtTime(0.001, start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.025);
      }
      one(784, t0, 0.1, 0.1);
      one(988, t0 + 0.11, 0.1, 0.08);
    }

    try {
      var ctx = ensureNotifyAudioContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().then(function () { scheduleBeeps(ctx); }).catch(function () {});
      } else {
        scheduleBeeps(ctx);
      }
    } catch (e) {}
  }

  function alertNewMessage(m) {
    if (isMine(m)) return;
    var panelOpen = !panel.hasAttribute('hidden');
    var sid = m.sessionId != null ? Number(m.sessionId) : null;

    if (UI_ROLE === 'staff') {
      if (sid && sid === activeSessionId && panelOpen && !document.hidden) {
        return;
      }
      if (sid) {
        bumpSessionUnread(sid);
      } else {
        unreadCount++;
        updateBadge();
      }
    } else {
      if (panelOpen && !document.hidden) return;
      unreadCount++;
      updateBadge();
    }

    playChatNotifySound();

    if (document.hidden && baseTitle && document.title.indexOf('【新消息】') !== 0) {
      document.title = '【新消息】' + baseTitle;
    }

    if (typeof Notification === 'function' && Notification.permission === 'granted') {
      var body = m.text.length > 120 ? m.text.slice(0, 117) + '…' : m.text;
      try {
        new Notification('新消息 · ' + m.nick, { body: body, tag: 'lc-' + String(m.id) });
      } catch (e) {}
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && document.title.indexOf('【新消息】') === 0) {
      document.title = baseTitle;
    }
  });

  function setStatus(text, ok) {
    statusEl.textContent = text;
    statusEl.classList.toggle('live-chat__status--ok', !!ok);
  }

  function scrollBottom() {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function appendMessage(m) {
    var mine = isMine(m);
    var kind = msgKind(m);
    var row = document.createElement('div');
    row.className = 'live-chat__row';
    if (mine) row.classList.add('live-chat__row--mine');
    else if (kind === 'staff') row.classList.add('live-chat__row--from-staff');

    var meta = document.createElement('div');
    meta.className = 'live-chat__meta';
    var whoPart = '<span class="live-chat__who">' + escapeHtml(m.nick) + '</span>';
    if (kind === 'staff') {
      whoPart += ' <span class="live-chat__badge">客服</span>';
    } else if (kind === 'customer') {
      whoPart += ' <span class="live-chat__badge live-chat__badge--customer">用户</span>';
    }
    meta.innerHTML = whoPart + ' <span class="live-chat__when">' + escapeHtml(fmtTime(m.ts)) + '</span>';

    var bubble = document.createElement('div');
    bubble.className = 'live-chat__bubble';
    bubble.innerHTML = linkifyChatText(m.text);
    row.appendChild(meta);
    row.appendChild(bubble);
    msgsEl.appendChild(row);
    scrollBottom();
  }

  function clearMsgs() {
    msgsEl.innerHTML = '';
  }

  function showMsgsPlaceholder(text) {
    var p = document.createElement('p');
    p.className = 'live-chat__msgs-placeholder';
    p.textContent = text;
    msgsEl.appendChild(p);
  }

  function applyHistory(list) {
    clearMsgs();
    list.forEach(function (m) {
      if (m.type !== 'msg') return;
      appendMessage(m);
    });
    if (UI_ROLE === 'staff' && (!list || list.length === 0)) {
      showMsgsPlaceholder(
        activeSessionId ? '该会话暂无消息。' : '请先在左侧选择一个客户会话，再查看历史与回复。'
      );
    }
  }

  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    try {
      ws = new WebSocket(WS_URL);
    } catch (e) {
      setStatus('无法连接', false);
      scheduleReconnect();
      return;
    }

    setStatus('连接中…', false);

    ws.onopen = function () {
      everOpened = true;
      reconnectFailures = 0;
      setStatus('已连接', true);
      if (UI_ROLE === 'staff') {
        activeSessionId = null;
        clearMsgs();
        document.querySelectorAll('.live-chat__session-row--active').forEach(function (x) {
          x.classList.remove('live-chat__session-row--active');
        });
        var sendBtn0 = form.querySelector('.live-chat__send');
        if (sendBtn0) sendBtn0.disabled = true;
        sessionUnread = {};
        syncStaffFabBadge();
      }
    };

    ws.onclose = function () {
      if (!everOpened) {
        setStatus('需登录后才能使用聊天', false);
        return;
      }
      reconnectFailures++;
      if (reconnectFailures > 12) {
        setStatus('无法保持连接，请刷新页面', false);
        return;
      }
      setStatus('已断开，重连中…', false);
      scheduleReconnect();
    };

    ws.onerror = function () {
      if (!everOpened) {
        setStatus('连接失败（请确认已登录）', false);
      } else {
        setStatus('连接异常', false);
      }
    };

    ws.onmessage = function (ev) {
      var data;
      try {
        data = JSON.parse(ev.data);
      } catch (e) {
        return;
      }
      if (data.type === 'sessionsSnapshot' && UI_ROLE === 'staff') {
        renderSessionsList(data.sessions);
        return;
      }
      if (data.type === 'sessionCreated' && UI_ROLE === 'staff') {
        if (data.session) prependSessionRow(data.session);
        return;
      }
      if (data.type === 'sessionActivity' && UI_ROLE === 'staff') {
        onSessionActivity(data);
        return;
      }
      if (data.type === 'history' && Array.isArray(data.messages)) {
        if (data.staffSelectSession) {
          applyHistory([]);
          return;
        }
        if (
          UI_ROLE === 'staff' &&
          data.sessionId != null &&
          Number(data.sessionId) !== Number(activeSessionId)
        ) {
          return;
        }
        applyHistory(data.messages);
        return;
      }
      if (data.type === 'msg') {
        if (UI_ROLE === 'staff') {
          var msid = data.sessionId != null ? Number(data.sessionId) : null;
          if (msid && msid === activeSessionId) {
            appendMessage(data);
          }
          alertNewMessage(data);
        } else {
          appendMessage(data);
          alertNewMessage(data);
        }
      }
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(function () {
      reconnectTimer = null;
      connect();
    }, 2500);
  }

  function exitChatFullscreen() {
    root.classList.remove('live-chat--fullscreen');
    document.body.classList.remove('live-chat-no-scroll');
  }

  function toggle(open) {
    var isOpen = open != null ? open : panel.hasAttribute('hidden');
    if (isOpen) {
      primeNotifyAudioFromUserGesture();
      maybeAskNotificationPermission();
      if (UI_ROLE === 'staff') {
        if (activeSessionId) clearSessionUnreadFor(activeSessionId);
      } else {
        unreadCount = 0;
      }
      updateBadge();
      if (document.title.indexOf('【新消息】') === 0) {
        document.title = baseTitle;
      }
      panel.removeAttribute('hidden');
      fab.setAttribute('aria-expanded', 'true');
      input.focus();
    } else {
      exitChatFullscreen();
      panel.setAttribute('hidden', '');
      fab.setAttribute('aria-expanded', 'false');
    }
  }

  fab.addEventListener('click', function () {
    primeNotifyAudioFromUserGesture();
    toggle();
  });
  closeBtn.addEventListener('click', function () {
    toggle(false);
  });

  if (UI_ROLE === 'staff') {
    var fsBtn = document.getElementById('live-chat-fs');
    var fsIconExpand =
      '<svg class="live-chat__fs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75H18m0 0h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25H18m0 0h-4.5m4.5 0v-4.5m0 4.5L15 15M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15"/>' +
      '</svg>';
    var fsIconCollapse =
      '<svg class="live-chat__fs-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' +
      '<path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15h4.5M9 15l5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0 4.5l5.25 5.25"/>' +
      '</svg>';

    function syncFsIcon(isFs) {
      if (!fsBtn) return;
      fsBtn.innerHTML = isFs ? fsIconCollapse : fsIconExpand;
      fsBtn.setAttribute('aria-label', isFs ? '退出全屏' : '全屏');
      fsBtn.setAttribute('title', isFs ? '退出全屏' : '全屏');
    }

    fsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isFs = root.classList.contains('live-chat--fullscreen');
      if (!isFs) {
        if (panel.hasAttribute('hidden')) {
          toggle(true);
        }
        root.classList.add('live-chat--fullscreen');
        document.body.classList.add('live-chat-no-scroll');
        syncFsIcon(true);
        scrollBottom();
        input.focus();
      } else {
        exitChatFullscreen();
        syncFsIcon(false);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!root.classList.contains('live-chat--fullscreen')) return;
      exitChatFullscreen();
      syncFsIcon(false);
    });
  }

  if (UI_ROLE === 'staff') {
    var sendInit = form.querySelector('.live-chat__send');
    if (sendInit) sendInit.disabled = true;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    if (UI_ROLE === 'staff' && !activeSessionId) return;
    var payload = { type: 'msg', text: text };
    if (UI_ROLE === 'staff') payload.sessionId = activeSessionId;
    ws.send(JSON.stringify(payload));
    input.value = '';
  });

  var MAX_MSG = 2000;

  function appendToCompose(fragment) {
    var el = input;
    var v = el.value || '';
    var start = typeof el.selectionStart === 'number' ? el.selectionStart : v.length;
    var end = typeof el.selectionEnd === 'number' ? el.selectionEnd : v.length;
    var next = v.slice(0, start) + fragment + v.slice(end);
    if (next.length > MAX_MSG) {
      next = next.slice(0, MAX_MSG);
    }
    el.value = next;
    el.focus();
    try {
      var pos = Math.min(start + fragment.length, next.length);
      el.setSelectionRange(pos, pos);
    } catch (err) {}
  }

  if (UI_ROLE === 'staff') {
    var kbToggle = document.getElementById('live-chat-kb-toggle');
    var kbPanel = document.getElementById('live-chat-kb-panel');
    var kbQ = document.getElementById('live-chat-kb-q');
    var kbSearchBtn = document.getElementById('live-chat-kb-search');
    var kbResults = document.getElementById('live-chat-kb-results');

    kbToggle.addEventListener('click', function () {
      var open = kbPanel.hasAttribute('hidden');
      if (open) {
        kbPanel.removeAttribute('hidden');
        kbToggle.setAttribute('aria-expanded', 'true');
        kbQ.focus();
      } else {
        kbPanel.setAttribute('hidden', '');
        kbToggle.setAttribute('aria-expanded', 'false');
      }
    });

    function renderKbError(msg) {
      kbResults.innerHTML = '<p class="live-chat__kb-empty">' + escapeHtml(msg) + '</p>';
    }

    function runKbSearch() {
      var q = (kbQ.value || '').trim();
      if (!q) {
        kbResults.innerHTML = '';
        return;
      }
      kbResults.innerHTML = '<p class="live-chat__kb-empty">搜索中…</p>';
      fetch('/chat/api/kb-search?q=' + encodeURIComponent(q), { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('请求失败');
          return r.json();
        })
        .then(function (data) {
          var list = data.faqs || [];
          if (!list.length) {
            kbResults.innerHTML = '<p class="live-chat__kb-empty">未找到匹配条目。</p>';
            return;
          }
          kbResults.innerHTML = '';
          list.forEach(function (f) {
            var absUrl = window.location.origin + f.path;
            var card = document.createElement('div');
            card.className = 'live-chat__kb-item';
            var title = document.createElement('div');
            title.className = 'live-chat__kb-item-title';
            title.textContent = f.title;
            var sub = document.createElement('div');
            sub.className = 'live-chat__kb-item-sub';
            sub.textContent = f.question || '';
            var ex = document.createElement('div');
            ex.className = 'live-chat__kb-item-excerpt';
            ex.textContent = f.excerpt || '';

            var actions = document.createElement('div');
            actions.className = 'live-chat__kb-actions';

            var bLink = document.createElement('button');
            bLink.type = 'button';
            bLink.className = 'btn btn-outline btn-sm';
            bLink.textContent = '插入链接';
            bLink.addEventListener('click', function () {
              var block = '【知识库】' + f.title + '\n' + absUrl + '\n';
              appendToCompose(block);
            });

            var bSum = document.createElement('button');
            bSum.type = 'button';
            bSum.className = 'btn btn-outline btn-sm';
            bSum.textContent = '插入摘要';
            bSum.addEventListener('click', function () {
              var body = (f.excerpt && f.excerpt.trim()) || f.question || '';
              var block =
                '【知识库】' + f.title + '\n' + body + '\n\n详情：' + absUrl + '\n';
              appendToCompose(block);
            });

            var aOpen = document.createElement('a');
            aOpen.href = f.path;
            aOpen.target = '_blank';
            aOpen.rel = 'noopener noreferrer';
            aOpen.className = 'btn btn-ghost btn-sm';
            aOpen.textContent = '打开';

            actions.appendChild(bLink);
            actions.appendChild(bSum);
            actions.appendChild(aOpen);

            card.appendChild(title);
            if (f.question) card.appendChild(sub);
            if (f.excerpt) card.appendChild(ex);
            card.appendChild(actions);
            kbResults.appendChild(card);
          });
        })
        .catch(function () {
          renderKbError('搜索失败，请稍后重试。');
        });
    }

    kbSearchBtn.addEventListener('click', runKbSearch);
    kbQ.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        runKbSearch();
      }
    });
  }

  connect();
})();

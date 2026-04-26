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
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
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
    '<span class="live-chat__title" id="live-chat-title"></span>' +
    '<span class="live-chat__status" id="live-chat-status">连接中…</span>' +
    '<button type="button" class="live-chat__close" id="live-chat-close" aria-label="关闭">×</button></div>' +
    '<div class="live-chat__hint" id="live-chat-hint"></div>' +
    '<div class="live-chat__nick-row"><label class="live-chat__label" for="live-chat-nick">账号</label>' +
    '<input type="text" id="live-chat-nick" class="live-chat__nick" maxlength="32" readonly autocomplete="username"></div>' +
    '<div class="live-chat__msgs" id="live-chat-msgs" role="log"></div>' +
    '<form class="live-chat__form" id="live-chat-form">' +
    '<input type="text" id="live-chat-input" class="live-chat__input" maxlength="2000" placeholder="输入消息…" autocomplete="off" aria-label="消息内容">' +
    '<button type="submit" class="live-chat__send btn btn-primary btn-sm">发送</button></form></div>';

  document.body.appendChild(root);

  var titleEl = document.getElementById('live-chat-title');
  var hintEl = document.getElementById('live-chat-hint');
  titleEl.textContent = panelTitle;
  if (UI_ROLE === 'staff') {
    hintEl.textContent =
      '客服工作台：管理员与客服账号均可在此接待用户；单房间多人可见，展示名为登录账号，记录已写入数据库。首次打开可授权桌面通知以便收新消息提示。';
  } else {
    hintEl.textContent =
      '单房间：所有登录用户可见相同记录，均以账号名显示。记录已落盘。可授权通知以接收新消息。';
  }

  var fab = document.getElementById('live-chat-fab');
  var panel = document.getElementById('live-chat-panel');
  var closeBtn = document.getElementById('live-chat-close');
  var statusEl = document.getElementById('live-chat-status');
  var msgsEl = document.getElementById('live-chat-msgs');
  var form = document.getElementById('live-chat-form');
  var input = document.getElementById('live-chat-input');
  var nickInput = document.getElementById('live-chat-nick');

  nickInput.value = SESSION_USER;
  nickInput.title = '登录账号';

  var ws = null;
  var reconnectTimer = null;
  var everOpened = false;
  var reconnectFailures = 0;
  var unreadCount = 0;
  var baseTitle = document.title;
  var badgeEl = document.getElementById('live-chat-badge');

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

  function alertNewMessage(m) {
    if (isMine(m)) return;
    var panelOpen = !panel.hasAttribute('hidden');
    if (panelOpen && !document.hidden) return;

    unreadCount++;
    updateBadge();

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
    bubble.textContent = m.text;
    row.appendChild(meta);
    row.appendChild(bubble);
    msgsEl.appendChild(row);
    scrollBottom();
  }

  function clearMsgs() {
    msgsEl.innerHTML = '';
  }

  function applyHistory(list) {
    clearMsgs();
    list.forEach(function (m) {
      if (m.type !== 'msg') return;
      appendMessage(m);
    });
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
      if (data.type === 'history' && Array.isArray(data.messages)) {
        applyHistory(data.messages);
        return;
      }
      if (data.type === 'msg') {
        appendMessage(data);
        alertNewMessage(data);
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

  function toggle(open) {
    var isOpen = open != null ? open : panel.hasAttribute('hidden');
    if (isOpen) {
      maybeAskNotificationPermission();
      unreadCount = 0;
      updateBadge();
      if (document.title.indexOf('【新消息】') === 0) {
        document.title = baseTitle;
      }
      panel.removeAttribute('hidden');
      fab.setAttribute('aria-expanded', 'true');
      input.focus();
    } else {
      panel.setAttribute('hidden', '');
      fab.setAttribute('aria-expanded', 'false');
    }
  }

  fab.addEventListener('click', function () {
    toggle();
  });
  closeBtn.addEventListener('click', function () {
    toggle(false);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'msg', text: text }));
    input.value = '';
  });

  connect();
})();

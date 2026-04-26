const WebSocket = require('ws');
const db = require('../db/database');

const MAX_TEXT = 2000;
const HISTORY_CAP = 200;

const getSessionByCustomer = db.prepare('SELECT * FROM chat_sessions WHERE customer_user_id = ?');
const insertSession = db.prepare('INSERT INTO chat_sessions (customer_user_id) VALUES (?)');
const touchSessionStmt = db.prepare('UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?');
const selectSessionById = db.prepare('SELECT id FROM chat_sessions WHERE id = ?');

const insertMsg = db.prepare(`
  INSERT INTO chat_messages (kind, user_id, username, text, session_id)
  VALUES (@kind, @user_id, @username, @text, @session_id)
`);

const selectHistoryBySession = db.prepare(`
  SELECT id,
         kind,
         user_id AS userId,
         username AS nick,
         text,
         session_id AS sessionId,
         CAST(strftime('%s', created_at) AS INTEGER) * 1000 AS ts
  FROM chat_messages
  WHERE session_id = ?
  ORDER BY id DESC
  LIMIT ?
`);

const selectMsgById = db.prepare(`
  SELECT id,
         kind,
         user_id AS userId,
         username AS nick,
         text,
         session_id AS sessionId,
         CAST(strftime('%s', created_at) AS INTEGER) * 1000 AS ts
  FROM chat_messages
  WHERE id = ?
`);

function getOrCreateSession(customerUserId) {
  const existing = getSessionByCustomer.get(customerUserId);
  if (existing) return { ...existing, isNew: false };
  insertSession.run(customerUserId);
  const row = getSessionByCustomer.get(customerUserId);
  return { ...row, isNew: true };
}

function rowToClientMessage(row) {
  return {
    type: 'msg',
    id: row.id,
    kind: row.kind,
    userId: row.userId,
    nick: row.nick,
    text: row.text,
    ts: row.ts,
    sessionId: row.sessionId != null ? row.sessionId : null,
  };
}

function loadHistoryForSession(sessionId) {
  const rows = selectHistoryBySession.all(sessionId, HISTORY_CAP);
  return rows.reverse().map(rowToClientMessage);
}

function buildSessionsSnapshot() {
  const rows = db
    .prepare(
      `SELECT s.id,
              s.customer_user_id,
              s.updated_at,
              u.username,
              COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS display_name,
              (SELECT text FROM chat_messages WHERE session_id = s.id ORDER BY id DESC LIMIT 1) AS last_text
       FROM chat_sessions s
       JOIN users u ON u.id = s.customer_user_id
       ORDER BY s.updated_at DESC, s.id DESC`
    )
    .all();
  return rows.map((r) => ({
    id: r.id,
    customerUserId: r.customer_user_id,
    username: r.username,
    displayName: r.display_name,
    updatedAt: r.updated_at,
    lastPreview: r.last_text ? String(r.last_text).slice(0, 80) : '',
  }));
}

function senderFromSessionUser(u) {
  if (!u) return null;
  if (u.role === 'admin' || u.role === 'support') {
    return { kind: 'staff', username: u.username, userId: u.id };
  }
  return { kind: 'customer', username: u.username, userId: u.id };
}

function attachLiveChat(httpServer, sessionMiddleware) {
  const wss = new WebSocket.Server({ noServer: true });
  /** @type {Map<number, Set<import('ws')>>} */
  const sessionRooms = new Map();
  /** @type {Set<import('ws')>>} */
  const staffSockets = new Set();

  function allSessionIds() {
    return db.prepare('SELECT id FROM chat_sessions').all().map((r) => r.id);
  }

  function addToRoom(sessionId, ws) {
    if (!sessionRooms.has(sessionId)) sessionRooms.set(sessionId, new Set());
    sessionRooms.get(sessionId).add(ws);
    if (!ws._chatRooms) ws._chatRooms = new Set();
    ws._chatRooms.add(sessionId);
  }

  function removeFromAllRooms(ws) {
    if (!ws._chatRooms) return;
    for (const sid of ws._chatRooms) {
      const set = sessionRooms.get(sid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) sessionRooms.delete(sid);
      }
    }
    ws._chatRooms.clear();
  }

  function roomBroadcast(sessionId, payloadObj) {
    const set = sessionRooms.get(sessionId);
    if (!set) return;
    const raw = JSON.stringify(payloadObj);
    for (const client of set) {
      if (client.readyState === WebSocket.OPEN) client.send(raw);
    }
  }

  function broadcastToStaff(obj) {
    const raw = JSON.stringify(obj);
    for (const s of staffSockets) {
      if (s.readyState === WebSocket.OPEN) s.send(raw);
    }
  }

  function attachStaffToAllSessionRooms(ws) {
    for (const sid of allSessionIds()) {
      addToRoom(sid, ws);
    }
  }

  function handleConnection(ws) {
    const user = ws.chatUser;
    const isStaff = user.role === 'admin' || user.role === 'support';

    ws.on('close', () => {
      removeFromAllRooms(ws);
      if (ws.chatRole === 'staff') staffSockets.delete(ws);
    });

    if (isStaff) {
      ws.chatRole = 'staff';
      ws.activeSessionId = null;
      staffSockets.add(ws);
      attachStaffToAllSessionRooms(ws);
      ws.send(JSON.stringify({ type: 'sessionsSnapshot', sessions: buildSessionsSnapshot() }));
      ws.send(
        JSON.stringify({
          type: 'history',
          messages: [],
          sessionId: null,
          staffSelectSession: true,
        })
      );
    } else {
      ws.chatRole = 'customer';
      const session = getOrCreateSession(user.id);
      ws.chatSessionId = session.id;
      addToRoom(session.id, ws);
      if (session.isNew) {
        for (const staffWs of staffSockets) {
          addToRoom(session.id, staffWs);
        }
        broadcastToStaff({
          type: 'sessionCreated',
          session: {
            id: session.id,
            customerUserId: user.id,
            username: user.username,
            displayName: (user.full_name && String(user.full_name).trim()) || user.username,
            updatedAt: session.updated_at,
            lastPreview: '',
          },
        });
      }
      const hist = loadHistoryForSession(session.id);
      ws.send(JSON.stringify({ type: 'history', messages: hist, sessionId: session.id }));
    }

    ws.on('message', (buf) => {
      if (!ws.chatUser) return;
      let data;
      try {
        data = JSON.parse(buf.toString());
      } catch {
        return;
      }

      if (data.type === 'fetchHistory' && ws.chatRole === 'staff') {
        const sid = parseInt(String(data.sessionId), 10);
        if (!sid || !selectSessionById.get(sid)) return;
        ws.activeSessionId = sid;
        const messages = loadHistoryForSession(sid);
        ws.send(JSON.stringify({ type: 'history', messages, sessionId: sid }));
        return;
      }

      if (data.type !== 'msg' || typeof data.text !== 'string') return;
      const text = data.text.trim().slice(0, MAX_TEXT);
      if (!text) return;

      if (ws.chatRole === 'staff') {
        const sessionId = parseInt(String(data.sessionId), 10);
        if (!sessionId || !selectSessionById.get(sessionId)) return;
        const s = senderFromSessionUser(ws.chatUser);
        if (!s) return;
        let info;
        try {
          info = insertMsg.run({
            kind: s.kind,
            user_id: s.userId,
            username: s.username,
            text,
            session_id: sessionId,
          });
        } catch {
          return;
        }
        touchSessionStmt.run(sessionId);
        const row = selectMsgById.get(info.lastInsertRowid);
        if (!row) return;
        const clientMsg = rowToClientMessage(row);
        roomBroadcast(sessionId, clientMsg);
        broadcastToStaff({
          type: 'sessionActivity',
          sessionId,
          lastPreview: text.slice(0, 80),
          updatedAt: new Date().toISOString(),
        });
        return;
      }

      if (ws.chatRole === 'customer') {
        const sessionId = ws.chatSessionId;
        if (!sessionId) return;
        const s = senderFromSessionUser(ws.chatUser);
        if (!s) return;
        let info;
        try {
          info = insertMsg.run({
            kind: s.kind,
            user_id: s.userId,
            username: s.username,
            text,
            session_id: sessionId,
          });
        } catch {
          return;
        }
        touchSessionStmt.run(sessionId);
        const row = selectMsgById.get(info.lastInsertRowid);
        if (!row) return;
        const clientMsg = rowToClientMessage(row);
        roomBroadcast(sessionId, clientMsg);
        broadcastToStaff({
          type: 'sessionActivity',
          sessionId,
          lastPreview: text.slice(0, 80),
          updatedAt: new Date().toISOString(),
        });
      }
    });
  }

  httpServer.on('upgrade', (request, socket, head) => {
    if (request.headers.upgrade !== 'websocket') return;
    socket.on('error', () => {});
    sessionMiddleware(request, {}, () => {
      const user = request.session && request.session.user;
      if (!user) {
        socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.chatUser = user;
        handleConnection(ws);
      });
    });
  });

  return wss;
}

module.exports = { attachLiveChat, buildSessionsSnapshot };

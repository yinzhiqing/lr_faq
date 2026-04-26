const WebSocket = require('ws');
const db = require('../db/database');

const MAX_TEXT = 2000;
const HISTORY_CAP = 120;

const insertMsg = db.prepare(`
  INSERT INTO chat_messages (kind, user_id, username, text)
  VALUES (@kind, @user_id, @username, @text)
`);

const selectHistory = db.prepare(`
  SELECT id,
         kind,
         user_id AS userId,
         username AS nick,
         text,
         CAST(strftime('%s', created_at) AS INTEGER) * 1000 AS ts
  FROM chat_messages
  ORDER BY id DESC
  LIMIT ?
`);

function rowToClientMessage(row) {
  return {
    type: 'msg',
    id: row.id,
    kind: row.kind,
    userId: row.userId,
    nick: row.nick,
    text: row.text,
    ts: row.ts,
  };
}

function loadHistory() {
  const rows = selectHistory.all(HISTORY_CAP);
  return rows.reverse().map(rowToClientMessage);
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

  function broadcast(payload) {
    const raw = JSON.stringify(payload);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(raw);
    });
  }

  function handleConnection(ws) {
    ws.send(JSON.stringify({ type: 'history', messages: loadHistory() }));

    ws.on('message', (buf) => {
      if (!ws.chatUser) return;
      let data;
      try {
        data = JSON.parse(buf.toString());
      } catch {
        return;
      }
      if (data.type !== 'msg' || typeof data.text !== 'string') return;
      const text = data.text.trim().slice(0, MAX_TEXT);
      if (!text) return;

      const s = senderFromSessionUser(ws.chatUser);
      if (!s) return;
      const { kind, username, userId } = s;

      let info;
      try {
        info = insertMsg.run({
          kind,
          user_id: userId,
          username,
          text,
        });
      } catch (e) {
        return;
      }

      const row = db
        .prepare(
          `SELECT id, kind, user_id AS userId, username AS nick, text,
                  CAST(strftime('%s', created_at) AS INTEGER) * 1000 AS ts
           FROM chat_messages WHERE id = ?`
        )
        .get(info.lastInsertRowid);

      if (!row) return;
      broadcast(rowToClientMessage(row));
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

module.exports = { attachLiveChat };

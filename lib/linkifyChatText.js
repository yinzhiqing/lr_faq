function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 聊天记录展示：转义后把 http(s) 链接与 /faqs/:id 转为可点击 <a>。
 */
function linkifyChatText(text) {
  if (text == null || text === '') return '';
  let s = escapeHtml(String(text));

  s = s.replace(/https?:\/\/[^\s<&]+/gi, (full) => {
    const href = full.replace(/"/g, '%22');
    return `<a class="chat-link" href="${href}" target="_blank" rel="noopener noreferrer">${full}</a>`;
  });

  s = s.replace(/(^|[^\w/])(\/faqs\/\d+)\b/g, (m, pre, path) => {
    return `${pre}<a class="chat-link" href="${path}" target="_blank" rel="noopener noreferrer">${path}</a>`;
  });

  return s;
}

module.exports = { linkifyChatText };

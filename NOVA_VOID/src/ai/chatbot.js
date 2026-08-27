function normalizeJid(value = '') {
  return String(value).trim().toLowerCase().replace(/:\d+(?=@)/, '');
}

/**
 * Normalizes a jid to a comparable value. WhatsApp may address the bot through
 * its phone-number JID, an Alternate LID (…@lid), or a device-suffixed variant.
 */
function ownIdentities(botJid, botLid) {
  const ids = new Set();
  for (const id of [botJid, botLid]) {
    const jid = normalizeJid(id);
    if (jid) ids.add(jid);
  }
  // LID lookups map a phone-number JID to its LID (…@lid); when both are
  // known we additionally recognize the "…@lid" flavor of the number.
  for (const id of [botJid, botLid]) {
    if (!id) continue;
    const num = String(id).split('@')[0].split(':')[0];
    if (num) ids.add(`${num}@lid`);
  }
  return ids;
}

/**
 * Determines whether an incoming WhatsApp message explicitly addresses NOVA_VOID.
 * The transport adapter supplies the normalized message context so this module
 * stays independent of a particular Baileys version.
 */
export function isChatbotTrigger(message, botJid, botLid) {
  if (!message || !botJid) return false;

  const own = ownIdentities(botJid, botLid);
  const mentioned = (message.mentionedJids ?? []).some((jid) => own.has(normalizeJid(jid)));
  const repliedToBot = own.has(normalizeJid(message.quotedParticipant));

  return mentioned || repliedToBot;
}

/**
 * Removes bot-addressment artifacts from the prompt text.
 * WhatsApp renders mentions as "@DisplayName" (not "@number"), so when the
 * message was a direct mention we also drop leading @tokens; plain numbers
 * are stripped regardless.
 */
export function stripBotMention(text = '', botJid, { mentioned = false } = {}) {
  let out = String(text ?? '').trim();
  if (!out) return '';
  if (botJid) {
    const number = String(botJid).split('@')[0].split(':')[0];
    if (number) out = out.replace(new RegExp(`@${number}\\b`, 'g'), '');
  }
  if (mentioned) out = out.replace(/^(?:@\S+\s*)+/, '');
  return out.trim();
}

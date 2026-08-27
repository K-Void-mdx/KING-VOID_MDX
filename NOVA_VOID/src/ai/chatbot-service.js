import { isChatbotTrigger, stripBotMention } from './chatbot.js';
import { AIProviderError } from './provider.js';
import { formatWhatsAppCode, splitCodeBlocks } from './format-code.js';
import * as wa from '../ui/wa-style.js';


/**
 * Handles one potential chatbot turn.
 * Returns true only when a reply was sent.
 * `force` is set for DMs where every message is a prompt (no mention needed).
 * `sendCode` sends code to the chat as a document (.py/.txt) for easy copying.
 */
export async function handleChatbotMessage({ message, botJid, botLid, enabled, ai, reply, sendCode, force = false }) {
  if (!enabled || message.isFromBot) return false;
  if (!force && !isChatbotTrigger(message, botJid, botLid)) return false;

  const mentioned = (message.mentionedJids ?? []).some((jid) => {
    const norm = String(jid).toLowerCase().replace(/:\d+(?=@)/, '');
    return [botJid, botLid].some((id) => id && norm === String(id).toLowerCase().replace(/:\d+(?=@)/, ''));
  });
  const prompt = stripBotMention(message.text, botJid, { mentioned });
  if (!prompt) return false;

  let answer;
  try {
    answer = await ai.chat({
      userJid: message.senderJid,
      scope: message.chatJid,
      prompt,
    });
  } catch (error) {
    // Priority chain: real provider → trained knowledge → honest card — for
    // not-configured, crashed and quota-exhausted providers alike.
    const known = typeof ai.answerFromKnowledge === 'function' ? ai.answerFromKnowledge(prompt) : null;
    if (known) {
      await reply(wa.knowledgeAnswer(known.content));
      return true;
    }
    if (!(error instanceof AIProviderError)) {
      console.error(`[CHATBOT] provider error: ${error?.message ?? error}`);
    }
    await reply([wa.header(), '', '🧠 *_AI NOT CONFIGURED_*', '', 'No external AI provider is available right now.', '', wa.row('Status', 'OFFLINE FALLBACK'), '', wa.footer()].join('\n'));
    return true;
  }

  // Prefer a copyable code file when the answer contains fenced code.
  if (sendCode) {
    const { explanation, code, fileName } = splitCodeBlocks(answer);
    if (code) {
      const caption = explanation
        ? formatWhatsAppCode(explanation)
        : 'Here is your code — tap to copy.';
      await reply(caption);
      await sendCode({ code, fileName });
      return true;
    }
  }

  await reply(formatWhatsAppCode(answer));
  return true;
}

import { isChatbotTrigger, stripBotMention } from './chatbot.js';
import { AIProviderError } from './provider.js';
import * as wa from '../ui/wa-style.js';


/**
 * Handles one potential chatbot turn.
 * Returns true only when a reply was sent.
 */
export async function handleChatbotMessage({ message, botJid, enabled, ai, reply }) {
  if (!enabled || message.isFromBot) return false;
  if (!isChatbotTrigger(message, botJid)) return false;

  const mentioned = (message.mentionedJids ?? [])
    .some((jid) => String(jid).toLowerCase().replace(/:\d+(?=@)/, '') === String(botJid).toLowerCase().replace(/:\d+(?=@)/, ''));
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

  await reply(answer);
  return true;
}

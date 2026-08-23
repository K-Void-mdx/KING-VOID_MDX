import { isChatbotTrigger, stripBotMention } from './chatbot.js';
import { AIProviderError } from './provider.js';

const NOT_CONFIGURED = /no ai providers are configured/i;

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
    // The bot must always acknowledge an explicit mention — never stay silent.
    if (error instanceof AIProviderError && NOT_CONFIGURED.test(error.message)) {
      const known = typeof ai.answerFromKnowledge === 'function' ? ai.answerFromKnowledge(prompt) : null;
      if (known) {
        await reply(`From my knowledge base:\n${known.content}`);
        return true;
      }
      await reply(
        'NOVA_VOID MDX here. No AI provider is connected yet, and my knowledge base has nothing on that. ' +
        'The owner can connect a provider or teach me with .train.'
      );
      return true;
    }
    await reply("I couldn't process that right now. Please try again in a moment.");
    return true;
  }

  await reply(answer);
  return true;
}

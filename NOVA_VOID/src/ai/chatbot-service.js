import { isChatbotTrigger, stripBotMention } from './chatbot.js';

export async function handleChatbotMessage({ message, botJid, enabled, ai, reply }) {
  if (!enabled || message.isFromBot) return false;
  if (!isChatbotTrigger(message, botJid)) return false;

  const prompt = stripBotMention(message.text, botJid);
  if (!prompt) return false;

  const answer = await ai.chat({
    userJid: message.senderJid,
    scope: message.chatJid,
    prompt,
  });
  await reply(answer);
  return true;
}

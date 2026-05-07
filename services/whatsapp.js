import axios from 'axios';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v19.0';

export function createWhatsAppClient(userConfig) {
  const PHONE_ID = userConfig.phoneNumberId;
  const TOKEN = userConfig.accessToken;

  async function sendMessage(text, to) {
    await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
      },
      { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
    );
  }

  function formatDue(due) {
    if (!due) return '📅 No deadline';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(due);
    dueDate.setHours(0, 0, 0, 0);
    const diff = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
    const dateStr = dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    if (diff < 0) return `📅 ${dateStr}  ⚠️ ${Math.abs(diff)} day(s) overdue!`;
    if (diff === 0) return `📅 ${dateStr}  🔴 Due today!`;
    if (diff <= 3) return `📅 ${dateStr}  🟠 ${diff} day(s) left`;
    return `📅 ${dateStr}  🟢 ${diff} day(s) left`;
  }

  async function sendTaskCard(task, index, total, to) {
    const story = task.userStory.length > 55
      ? task.userStory.slice(0, 52) + '...'
      : task.userStory;
    const storyLabel = task.userStoryRef ? `Story #${task.userStoryRef}` : 'Story';

    const msg =
      `📋 *Task ${index + 1} of ${total}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏢 *Project:* ${task.project}\n` +
      `🎯 *Epic:* ${task.epic}\n` +
      `📖 *${storyLabel}:* ${story}\n` +
      `🔹 *Task:* ${task.subject}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *Task Status:* ${task.status}\n` +
      `📝 *Story Status:* ${task.userStoryStatus}\n` +
      `${formatDue(task.due)}\n\n` +
      `What do you want to do?\n` +
      `1️⃣ Post a comment\n` +
      `2️⃣ Change status\n` +
      `3️⃣ Next task\n` +
      (index > 0 ? `4️⃣ Previous task` : '');
    await sendMessage(msg, to);
  }

  return { sendMessage, sendTaskCard };
}

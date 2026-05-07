import { getCredentialsByPhone, getSession, saveSession } from '@/lib/pocketbase';
import { decrypt } from '@/lib/crypto';
import { createTaigaClient } from '@/services/taiga';
import { createWhatsAppClient } from '@/services/whatsapp';
import { enhanceComment } from '@/services/gemini';
import PRE_COMMENTS from '@/utils/precomments';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request) {
  const body = await request.json();

  const entry = body?.entry?.[0];
  const change = entry?.changes?.[0];
  const msg = change?.value?.messages?.[0];
  if (!msg || msg.type !== 'text') return new Response('ok', { status: 200 });

  const from = msg.from;
  const msgId = msg.id;
  const text = msg.text.body.trim();
  let session = null;
  let taiga = null;

  try {
    // Look up this user's credentials in PocketBase
    let cred = null;
    try {
      cred = await getCredentialsByPhone(from);
    } catch (_) {}

    if (!cred) {
      const wa = createWhatsAppClient({
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.ACCESS_TOKEN,
      });
      await wa.sendMessage(
        `👋 You are not registered yet. Visit ${process.env.NEXT_PUBLIC_SITE_URL} to connect your Taiga account.`,
        from
      );
      return new Response('ok', { status: 200 });
    }

    const userConfig = {
      taigaUsername: cred.taiga_username,
      taigaPassword: decrypt(cred.taiga_password_enc),
      taigaBaseUrl: cred.taiga_base_url,
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: process.env.ACCESS_TOKEN,
    };

    taiga = createTaigaClient(userConfig, session.taigaToken || null);
    const wa = createWhatsAppClient(userConfig);

    // Load session from PocketBase
    const sessionRecord = await getSession(from);
    session = sessionRecord
      ? { step: sessionRecord.step, ...(sessionRecord.data || {}) }
      : { step: 'idle', tasks: [], taskIndex: 0, currentTask: null };

    // Deduplicate: skip if this message was already processed
    if (session.lastMsgId === msgId) {
      return new Response('ok', { status: 200 });
    }
    session.lastMsgId = msgId;

    console.log(`📩 From ${from} [step: ${session.step}]: ${text}`);

    // ── END: resets from any step ──
    if (text.toLowerCase() === 'end') {
      session.step = 'idle';
      session.tasks = [];
      session.taskIndex = 0;
      session.currentTask = null;
      await wa.sendMessage('👋 Session ended. Type *tasks* whenever you want to start again.', from);
    }

    // ── IDLE ──
    else if (session.step === 'idle') {
      if (text.toLowerCase() === 'tasks') {
        await wa.sendMessage('🔄 Fetching your tasks from Taiga...', from);
        const tasks = await taiga.getMyTasks();
        if (!tasks.length) {
          await wa.sendMessage('✅ No open tasks assigned to you right now!', from);
        } else {
          session.step = 'task_action';
          session.tasks = tasks;
          session.taskIndex = 0;
          session.currentTask = tasks[0];
          await wa.sendMessage(`🗂 You have *${tasks.length} task(s)*. Let's go through them one by one:`, from);
          await wa.sendTaskCard(tasks[0], 0, tasks.length, from);
        }
      } else {
        await wa.sendMessage('👋 Hi! Type *tasks* to see your Taiga tasks.', from);
      }
    }

    // ── TASK ACTION: 1 comment, 2 status, 3 next, 4 prev ──
    else if (session.step === 'task_action') {
      if (text === '1') {
        await wa.sendMessage(
          '✏️ Type your comment (rough is fine, AI will enhance it):\n\nOr type *pre* for pre-loaded comments.\n\n0️⃣ Back',
          from
        );
        session.step = 'awaiting_comment';
      } else if (text === '2') {
        await wa.sendMessage('What do you want to change?\n\n1. Task status\n2. Story status\n\n0️⃣ Back', from);
        session.step = 'awaiting_status_type';
      } else if (text === '3') {
        const nextIndex = session.taskIndex + 1;
        const next = session.tasks[nextIndex];
        if (next) {
          session.taskIndex = nextIndex;
          session.currentTask = next;
          await wa.sendTaskCard(next, nextIndex, session.tasks.length, from);
        } else {
          await wa.sendMessage('✅ All tasks reviewed! Type *tasks* to start again.', from);
          session.step = 'idle';
        }
      } else if (text === '4') {
        const prevIndex = session.taskIndex - 1;
        const prev = session.tasks[prevIndex];
        if (prev) {
          session.taskIndex = prevIndex;
          session.currentTask = prev;
          await wa.sendTaskCard(prev, prevIndex, session.tasks.length, from);
        } else {
          await wa.sendMessage('You are already on the first task.', from);
        }
      } else {
        await wa.sendMessage('Please reply with 1, 2, or 3.', from);
      }
    }

    // ── AWAITING STATUS TYPE ──
    else if (session.step === 'awaiting_status_type') {
      if (text === '0') {
        session.step = 'task_action';
        await wa.sendTaskCard(session.currentTask, session.taskIndex, session.tasks.length, from);
      } else if (text === '1') {
        const statuses = await taiga.getTaskStatuses(session.currentTask.projectId);
        const lines = statuses.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
        await wa.sendMessage(`Choose new *task* status:\n\n${lines}\n\n0️⃣ Back`, from);
        session.step = 'awaiting_status';
        session.statuses = statuses;
        session.statusType = 'task';
      } else if (text === '2') {
        const statuses = await taiga.getUserStoryStatuses(session.currentTask.projectId);
        const lines = statuses.map((s, i) => `${i + 1}. ${s.name}`).join('\n');
        await wa.sendMessage(`Choose new *story* status:\n\n${lines}\n\n0️⃣ Back`, from);
        session.step = 'awaiting_status';
        session.statuses = statuses;
        session.statusType = 'story';
      } else {
        await wa.sendMessage('Reply 1 for task status, 2 for story status, or 0 to go back.', from);
      }
    }

    // ── AWAITING COMMENT ──
    else if (session.step === 'awaiting_comment') {
      if (text === '0') {
        session.step = 'task_action';
        await wa.sendTaskCard(session.currentTask, session.taskIndex, session.tasks.length, from);
      } else if (text.toLowerCase() === 'pre') {
        const lines = PRE_COMMENTS.map((c, i) => `${i + 1}. ${c}`).join('\n');
        await wa.sendMessage(`Choose a pre-loaded comment:\n\n${lines}`, from);
        session.step = 'awaiting_pre_choice';
      } else {
        await wa.sendMessage(
          `Your comment:\n"${text}"\n\nWhat next?\nA. ✨ Enhance with AI\nB. Post as-is\n\n0️⃣ Back`,
          from
        );
        session.step = 'comment_action';
        session.roughComment = text;
      }
    }

    // ── COMMENT ACTION ──
    else if (session.step === 'comment_action') {
      if (text === '0') {
        session.step = 'task_action';
        await wa.sendTaskCard(session.currentTask, session.taskIndex, session.tasks.length, from);
      } else if (text.toUpperCase() === 'A') {
        await wa.sendMessage('⏳ Enhancing your comment with AI...', from);
        const enhanced = await enhanceComment(session.roughComment);
        await wa.sendMessage(
          `✨ Enhanced version:\n"${enhanced}"\n\nReply *yes* to post or *no* to cancel.\n\n0️⃣ Back`,
          from
        );
        session.step = 'confirm_enhanced';
        session.enhancedComment = enhanced;
      } else if (text.toUpperCase() === 'B') {
        await taiga.postComment(session.currentTask.id, session.roughComment);
        await wa.sendMessage('✅ Comment posted!', from);
        await moveToNext(session, wa, from);
      } else {
        await wa.sendMessage('Please reply A, B or 0 to go back.', from);
      }
    }

    // ── CONFIRM ENHANCED ──
    else if (session.step === 'confirm_enhanced') {
      if (text === '0') {
        session.step = 'task_action';
        await wa.sendTaskCard(session.currentTask, session.taskIndex, session.tasks.length, from);
      } else if (text.toLowerCase() === 'yes') {
        await taiga.postComment(session.currentTask.id, session.enhancedComment);
        await wa.sendMessage('✅ Enhanced comment posted!', from);
        await moveToNext(session, wa, from);
      } else if (text.toLowerCase() === 'no') {
        await wa.sendMessage('❌ Cancelled.', from);
        session.step = 'task_action';
        await wa.sendTaskCard(session.currentTask, session.taskIndex, session.tasks.length, from);
      } else {
        await wa.sendMessage('Reply *yes*, *no* or *0* to go back.', from);
      }
    }

    // ── PRE-COMMENT CHOICE ──
    else if (session.step === 'awaiting_pre_choice') {
      if (text === '0') {
        session.step = 'task_action';
        await wa.sendTaskCard(session.currentTask, session.taskIndex, session.tasks.length, from);
      } else {
        const idx = parseInt(text) - 1;
        if (idx >= 0 && idx < PRE_COMMENTS.length) {
          const chosen = PRE_COMMENTS[idx];
          await taiga.postComment(session.currentTask.id, chosen);
          await wa.sendMessage(`✅ Posted: "${chosen}"`, from);
          await moveToNext(session, wa, from);
        } else {
          await wa.sendMessage(`Please reply 1–${PRE_COMMENTS.length} or 0 to go back.`, from);
        }
      }
    }

    // ── STATUS CHANGE ──
    else if (session.step === 'awaiting_status') {
      if (text === '0') {
        session.step = 'task_action';
        await wa.sendTaskCard(session.currentTask, session.taskIndex, session.tasks.length, from);
      } else {
        const idx = parseInt(text) - 1;
        const chosen = session.statuses?.[idx];
        if (chosen) {
          if (session.statusType === 'story') {
            await taiga.changeUserStoryStatus(
              session.currentTask.userStoryId,
              chosen.id,
              session.currentTask.userStoryVersion
            );
            session.currentTask = { ...session.currentTask, userStoryStatus: chosen.name };
            session.tasks[session.taskIndex] = session.currentTask;
            await wa.sendMessage(`✅ Story status changed to "${chosen.name}"`, from);
          } else {
            await taiga.changeTaskStatus(
              session.currentTask.id,
              chosen.id,
              session.currentTask.version
            );
            session.currentTask = { ...session.currentTask, status: chosen.name };
            session.tasks[session.taskIndex] = session.currentTask;
            await wa.sendMessage(`✅ Task status changed to "${chosen.name}"`, from);
          }
          await moveToNext(session, wa, from);
        } else {
          await wa.sendMessage('Invalid choice. Reply with a number from the list or 0 to go back.', from);
        }
      }
    }

  } catch (err) {
    console.error('❌ Error handling message:', err.message);
    try {
      const wa = createWhatsAppClient({
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        accessToken: process.env.ACCESS_TOKEN,
      });
      await wa.sendMessage('Something went wrong. Please try again.', from);
    } catch (_) {}
  } finally {
    if (session) {
      if (taiga) {
        session.taigaToken = taiga.getTokenSnapshot();
      }
      const { step, ...rest } = session;
      try {
        await saveSession(from, step, rest);
      } catch (e) {
        console.error('❌ Failed to save session:', e.message);
      }
    }
  }

  return new Response('ok', { status: 200 });
}

async function moveToNext(session, wa, from) {
  const nextIndex = session.taskIndex + 1;
  const next = session.tasks[nextIndex];
  if (next) {
    session.taskIndex = nextIndex;
    session.currentTask = next;
    session.step = 'task_action';
    await wa.sendTaskCard(next, nextIndex, session.tasks.length, from);
  } else {
    session.step = 'idle';
    await wa.sendMessage('✅ All tasks done for now! Type *tasks* anytime to check again.', from);
  }
}

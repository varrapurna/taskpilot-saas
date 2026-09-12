import { getCredentialsByPhone, getSession, saveSession } from '@/server/database/pocketbase';
import { decrypt } from '@/server/security/crypto';
import { createTaigaClient } from '@/server/integrations/taiga';
import { createWhatsAppClient } from '@/server/integrations/whatsapp';
import { verifyMetaWebhookSignature } from '@/server/whatsapp/meta-signature';
import { getMetaWhatsAppConfig } from '@/server/whatsapp/meta-config';

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const META_APP_SECRET = process.env.META_APP_SECRET;
const ISSUE_PAGE_SIZE = 5;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === VERIFY_TOKEN) return new Response(challenge, { status: 200 });
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-hub-signature-256');
  if (!verifyMetaWebhookSignature(rawBody, signature, META_APP_SECRET)) {
    console.warn('Rejected webhook with an invalid Meta signature.');
    return new Response('Unauthorized', { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  const msg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!msg || !['text', 'interactive'].includes(msg.type)) return new Response('ok', { status: 200 });

  const from = msg.from;
  const msgId = msg.id;
  const text = getMessageValue(msg);
  if (!text) return new Response('ok', { status: 200 });
  const command = text.toLowerCase();
  let session = null;
  let taiga = null;

  try {
    let credentials = null;
    try {
      credentials = await getCredentialsByPhone(from);
    } catch (_) {}

    const wa = createWhatsAppClient(getMetaWhatsAppConfig());
    if (!credentials) {
      await wa.sendMessage(
        `You are not connected yet. Visit ${process.env.NEXT_PUBLIC_SITE_URL} to connect Taiga.`,
        from
      );
      return new Response('ok', { status: 200 });
    }

    session = await loadSession(from);
    taiga = createTaigaClient({
      taigaUsername: credentials.taiga_username,
      taigaPassword: decrypt(credentials.taiga_password_enc),
      taigaBaseUrl: credentials.taiga_base_url,
    }, session.taigaToken || null);

    if (session.lastMsgId === msgId) return new Response('ok', { status: 200 });
    session.lastMsgId = msgId;

    // Home is always safe: users never need to remember a hidden command.
    if ((session.step === 'idle' && ['hi', 'hello'].includes(command)) || ['menu', 'home'].includes(command)) {
      session.welcomeShown = true;
      resetWorkState(session);
      await wa.sendHome(from);
    } else if (command === 'end') {
      resetWorkState(session);
      await wa.sendMessage('Session ended. Send *hi* whenever you want to return.', from);
    } else if (session.step === 'idle') {
      await handleHomeChoice(command, session, taiga, wa, from);
    } else if (session.step === 'choose_task_project') {
      await handleProjectChoice(command, 'task', session, wa, from);
    } else if (session.step === 'task_action') {
      await handleTaskAction(command, session, taiga, wa, from);
    } else if (session.step === 'awaiting_task_comment') {
      await handleTaskComment(text, session, taiga, wa, from);
    } else if (session.step === 'awaiting_task_status') {
      await handleTaskStatus(command, session, taiga, wa, from);
    } else if (session.step === 'choose_issue_project') {
      await handleProjectChoice(command, 'issue', session, wa, from);
    } else if (session.step === 'issue_list') {
      await handleIssueListChoice(command, session, wa, from);
    } else if (session.step === 'issue_action') {
      await handleIssueAction(command, session, taiga, wa, from);
    } else if (session.step === 'awaiting_issue_status') {
      await handleIssueStatus(command, session, taiga, wa, from);
    } else if (session.step === 'awaiting_issue_assignee') {
      await handleIssueAssignee(command, session, wa, from);
    } else if (session.step === 'confirm_issue_assignee') {
      await confirmIssueAssignee(command, session, taiga, wa, from);
    } else if (session.step === 'awaiting_issue_comment') {
      await handleIssueComment(text, session, taiga, wa, from);
    } else {
      resetWorkState(session);
      await wa.sendHome(from);
    }
  } catch (error) {
    console.error('Error handling WhatsApp message:', error.response?.status, error.message);
    try {
      const wa = createWhatsAppClient(getMetaWhatsAppConfig());
      await wa.sendMessage(friendlyError(error), from);
    } catch (_) {}
  } finally {
    if (session) {
      if (taiga) session.taigaToken = taiga.getTokenSnapshot();
      const { step, ...data } = session;
      try {
        await saveSession(from, step, data);
      } catch (error) {
        console.error('Failed to save WhatsApp session:', error.message);
      }
    }
  }

  return new Response('ok', { status: 200 });
}

async function loadSession(from) {
  const saved = await getSession(from);
  return saved
    ? { step: saved.step, ...(saved.data || {}) }
    : { step: 'idle', kind: null, projects: [], activeProjectIndex: null, activeIndex: 0, issuePage: 0 };
}

function resetWorkState(session) {
  session.step = 'idle';
  session.kind = null;
  session.projects = [];
  session.activeProjectIndex = null;
  session.activeIndex = 0;
  session.issuePage = 0;
  session.statusPage = 0;
  session.assigneePage = 0;
  delete session.statuses;
  delete session.members;
  delete session.pendingAssignee;
}

function groupByProject(items) {
  const groups = new Map();
  for (const item of items) {
    const key = String(item.projectId);
    if (!groups.has(key)) groups.set(key, { id: item.projectId, name: item.project, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function getProject(session) {
  return session.projects?.[session.activeProjectIndex] || null;
}

function getCurrentItem(session) {
  return getProject(session)?.items?.[session.activeIndex] || null;
}

function numberChoice(command) {
  return /^\d+$/.test(command) ? Number(command) : null;
}

function getMessageValue(message) {
  if (message.type === 'text') return message.text?.body?.trim() || '';
  return message.interactive?.button_reply?.id || message.interactive?.list_reply?.id || '';
}

async function handleHomeChoice(command, session, taiga, wa, from) {
  if (command === '1' || command === 'tasks' || command === 'task' || command === 'home_tasks') {
    await loadProjects('task', session, taiga, wa, from);
  } else if (command === '2' || command === 'issues' || command === 'issue' || command === 'home_issues') {
    await loadProjects('issue', session, taiga, wa, from);
  } else {
    await wa.sendHome(from);
  }
}

async function loadProjects(kind, session, taiga, wa, from) {
  await wa.sendMessage(kind === 'task' ? 'Checking your tasks…' : 'Checking your issues…', from);
  const items = kind === 'task' ? await taiga.getMyTasks() : await taiga.getMyIssues();
  const projects = groupByProject(items);
  if (!projects.length) {
    await wa.sendMessage(kind === 'task' ? 'No open tasks are assigned to you right now.' : 'No open issues are assigned to you right now.', from);
    resetWorkState(session);
    return;
  }

  session.kind = kind;
  session.projects = projects;
  session.activeProjectIndex = null;
  session.activeIndex = 0;
  session.issuePage = 0;
  session.step = kind === 'task' ? 'choose_task_project' : 'choose_issue_project';
  await wa.sendProjectPicker(kind, projects, from);
}

async function handleProjectChoice(command, kind, session, wa, from) {
  if (command === '0' || command === 'task_projects') {
    resetWorkState(session);
    await wa.sendHome(from);
    return;
  }

  const interactiveProject = new RegExp(`^${kind}_project_(\\d+)$`).exec(command);
  const choice = numberChoice(command);
  const index = interactiveProject ? Number(interactiveProject[1]) : (choice === null ? -1 : choice - 1);
  const project = session.projects?.[index];
  if (!project) {
    await wa.sendMessage('Choose a project number, or reply 0 for Home.', from);
    return;
  }

  session.activeProjectIndex = index;
  session.activeIndex = 0;
  session.issuePage = 0;
  if (kind === 'task') {
    session.step = 'task_action';
    await wa.sendTaskCard(project.items[0], 0, project.items.length, from);
  } else {
    session.step = 'issue_list';
    await wa.sendIssueList(project, project.items, 0, from);
  }
}

async function showTask(session, wa, from) {
  const project = getProject(session);
  const task = getCurrentItem(session);
  if (!project || !task) {
    session.step = 'choose_task_project';
    await wa.sendProjectPicker('task', session.projects, from);
    return;
  }
  session.step = 'task_action';
  await wa.sendTaskCard(task, session.activeIndex, project.items.length, from);
}

async function handleTaskAction(command, session, taiga, wa, from) {
  const project = getProject(session);
  if (!project) return handleProjectChoice('0', 'task', session, wa, from);

  if (command === '0') {
    session.step = 'choose_task_project';
    await wa.sendProjectPicker('task', session.projects, from);
  } else if (command === '1' || command === 'task_comment') {
    session.step = 'awaiting_task_comment';
    await wa.sendMessage('Send your comment.\n0. Back', from);
  } else if (command === '2' || command === 'task_status') {
    const statuses = await taiga.getTaskStatuses(project.id);
    session.statuses = statuses;
    session.statusPage = 0;
    session.step = 'awaiting_task_status';
    await wa.sendStatusPicker('task', statuses, 0, from);
  } else if (command === '3' || command === 'task_next') {
    if (session.activeIndex + 1 >= project.items.length) {
      session.step = 'choose_task_project';
      await wa.sendMessage(`You have reviewed all tasks in ${project.name}.`, from);
      await wa.sendProjectPicker('task', session.projects, from);
    } else {
      session.activeIndex += 1;
      await showTask(session, wa, from);
    }
  } else if ((command === '4' || command === 'task_previous') && session.activeIndex > 0) {
    session.activeIndex -= 1;
    await showTask(session, wa, from);
  } else {
    await wa.sendMessage('Reply 1, 2, 3, 4, or 0.', from);
  }
}

async function handleTaskComment(text, session, taiga, wa, from) {
  if (text === '0') return showTask(session, wa, from);
  const task = getCurrentItem(session);
  await taiga.postComment(task.id, text);
  await wa.sendMessage('Comment posted.', from);
  await showTask(session, wa, from);
}

async function handleTaskStatus(command, session, taiga, wa, from) {
  if (command === '0' || command === 'task_status_back') return showTask(session, wa, from);
  if (command === 'task_status_next' && (session.statusPage + 1) * 7 < session.statuses.length) {
    session.statusPage += 1;
    await wa.sendStatusPicker('task', session.statuses, session.statusPage, from);
    return;
  }
  if (command === 'task_status_previous' && session.statusPage > 0) {
    session.statusPage -= 1;
    await wa.sendStatusPicker('task', session.statuses, session.statusPage, from);
    return;
  }
  const interactiveStatus = /^task_status_(\d+)$/.exec(command);
  const choice = numberChoice(command);
  const selected = interactiveStatus
    ? session.statuses?.[Number(interactiveStatus[1])]
    : session.statuses?.[choice - 1];
  if (!selected) {
    await wa.sendMessage('Choose a status number, or reply 0 to go back.', from);
    return;
  }
  const task = getCurrentItem(session);
  const updated = await taiga.changeTaskStatus(task.id, selected.id, task.version);
  task.status = updated.status_extra_info?.name || selected.name;
  task.version = updated.version ?? task.version;
  await wa.sendMessage(`Task status changed to ${task.status}.`, from);
  if (selected.isClosed) {
    await removeCurrentItem('task', session, wa, from);
    return;
  }
  await showTask(session, wa, from);
}

async function showIssueList(session, wa, from) {
  const project = getProject(session);
  if (!project) {
    session.step = 'choose_issue_project';
    await wa.sendProjectPicker('issue', session.projects, from);
    return;
  }
  session.step = 'issue_list';
  await wa.sendIssueList(project, project.items, session.issuePage, from);
}

async function showIssue(session, wa, from) {
  const project = getProject(session);
  const issue = getCurrentItem(session);
  if (!project || !issue) return showIssueList(session, wa, from);
  session.step = 'issue_action';
  await wa.sendIssueCard(issue, session.activeIndex, project.items.length, from);
}

async function handleIssueListChoice(command, session, wa, from) {
  const project = getProject(session);
  if (!project) return showIssueList(session, wa, from);
  if (command === '0' || command === 'issue_projects') {
    session.step = 'choose_issue_project';
    await wa.sendProjectPicker('issue', session.projects, from);
    return;
  }

  const choice = numberChoice(command);
  const start = session.issuePage * ISSUE_PAGE_SIZE;
  const interactiveIssue = /^issue_select_(\d+)$/.exec(command);
  if (interactiveIssue && project.items[Number(interactiveIssue[1])]) {
    session.activeIndex = Number(interactiveIssue[1]);
    await showIssue(session, wa, from);
  } else if (choice >= 1 && choice <= ISSUE_PAGE_SIZE && project.items[start + choice - 1]) {
    session.activeIndex = start + choice - 1;
    await showIssue(session, wa, from);
  } else if ((choice === 6 || command === 'issue_next_page') && start + ISSUE_PAGE_SIZE < project.items.length) {
    session.issuePage += 1;
    await showIssueList(session, wa, from);
  } else if ((choice === 7 || command === 'issue_previous_page') && session.issuePage > 0) {
    session.issuePage -= 1;
    await showIssueList(session, wa, from);
  } else {
    await wa.sendMessage('Choose an issue number, 6 or 7 for pages, or 0 for Projects.', from);
  }
}

async function handleIssueAction(command, session, taiga, wa, from) {
  const issue = getCurrentItem(session);
  const project = getProject(session);
  if (!issue || !project) return showIssueList(session, wa, from);

  if (command === '0' || command === 'issue_list') {
    session.issuePage = Math.floor(session.activeIndex / ISSUE_PAGE_SIZE);
    await showIssueList(session, wa, from);
  } else if (command === '1' || command === 'issue_status') {
    const statuses = await taiga.getIssueStatuses(project.id);
    session.statuses = statuses;
    session.statusPage = 0;
    session.step = 'awaiting_issue_status';
    await wa.sendStatusPicker('issue', statuses, 0, from);
  } else if (command === '2' || command === 'issue_reassign') {
    const members = await taiga.getProjectMembers(project.id);
    if (!members.length) {
      await wa.sendMessage('No project members are available for reassignment.', from);
      return showIssue(session, wa, from);
    }
    session.members = members;
    session.assigneePage = 0;
    session.step = 'awaiting_issue_assignee';
    await wa.sendAssigneePicker(issue, members, 0, from);
  } else if (command === '3' || command === 'issue_comment') {
    session.step = 'awaiting_issue_comment';
    await wa.sendMessage('Send your comment.\n0. Back', from);
  } else if (command === '4' || command === 'issue_next') {
    if (session.activeIndex + 1 >= project.items.length) {
      session.issuePage = Math.floor(session.activeIndex / ISSUE_PAGE_SIZE);
      await wa.sendMessage(`You have reviewed all issues in ${project.name}.`, from);
      await showIssueList(session, wa, from);
    } else {
      session.activeIndex += 1;
      await showIssue(session, wa, from);
    }
  } else if ((command === '5' || command === 'issue_previous') && session.activeIndex > 0) {
    session.activeIndex -= 1;
    await showIssue(session, wa, from);
  } else {
    await wa.sendMessage('Reply 1, 2, 3, 4, 5, or 0.', from);
  }
}

async function handleIssueStatus(command, session, taiga, wa, from) {
  if (command === '0' || command === 'issue_status_back') return showIssue(session, wa, from);
  if (command === 'issue_status_next' && (session.statusPage + 1) * 7 < session.statuses.length) {
    session.statusPage += 1;
    await wa.sendStatusPicker('issue', session.statuses, session.statusPage, from);
    return;
  }
  if (command === 'issue_status_previous' && session.statusPage > 0) {
    session.statusPage -= 1;
    await wa.sendStatusPicker('issue', session.statuses, session.statusPage, from);
    return;
  }
  const interactiveStatus = /^issue_status_(\d+)$/.exec(command);
  const choice = numberChoice(command);
  const selected = interactiveStatus
    ? session.statuses?.[Number(interactiveStatus[1])]
    : session.statuses?.[choice - 1];
  if (!selected) {
    await wa.sendMessage('Choose a status number, or reply 0 to go back.', from);
    return;
  }
  const issue = getCurrentItem(session);
  const updated = await taiga.changeIssueStatus(issue.id, selected.id, issue.version);
  issue.status = updated.status_extra_info?.name || selected.name;
  issue.version = updated.version ?? issue.version;
  await wa.sendMessage(`Issue status changed to ${issue.status}.`, from);
  if (selected.isClosed) {
    await removeCurrentItem('issue', session, wa, from);
    return;
  }
  await showIssue(session, wa, from);
}

async function handleIssueAssignee(command, session, wa, from) {
  if (command === '0' || command === 'issue_assignee_back') return showIssue(session, wa, from);
  if (command === 'issue_assignee_next' && (session.assigneePage + 1) * 7 < session.members.length) {
    session.assigneePage += 1;
    await wa.sendAssigneePicker(getCurrentItem(session), session.members, session.assigneePage, from);
    return;
  }
  if (command === 'issue_assignee_previous' && session.assigneePage > 0) {
    session.assigneePage -= 1;
    await wa.sendAssigneePicker(getCurrentItem(session), session.members, session.assigneePage, from);
    return;
  }
  const interactiveMember = /^issue_assignee_(\d+)$/.exec(command);
  const choice = numberChoice(command);
  const member = interactiveMember
    ? session.members?.[Number(interactiveMember[1])]
    : session.members?.[choice - 1];
  if (!member) {
    await wa.sendMessage('Choose a member number, or reply 0 to go back.', from);
    return;
  }
  session.pendingAssignee = member;
  session.step = 'confirm_issue_assignee';
  await wa.sendButtons(`Reassign this issue to ${member.name}?`, [
    { id: 'confirm_reassign', title: 'Confirm' },
    { id: 'cancel_reassign', title: 'Cancel' },
  ], from);
}

async function confirmIssueAssignee(command, session, taiga, wa, from) {
  if (command === '0' || command === 'cancel_reassign') return showIssue(session, wa, from);
  if (command !== '1' && command !== 'confirm_reassign') {
    await wa.sendMessage('Reply 1 to confirm, or 0 to cancel.', from);
    return;
  }
  const issue = getCurrentItem(session);
  const member = session.pendingAssignee;
  const updated = await taiga.assignIssue(issue.id, member.id, issue.version);
  issue.version = updated.version ?? issue.version;
  delete session.pendingAssignee;
  await wa.sendMessage(`Issue reassigned to ${member.name}.`, from);
  await removeCurrentItem('issue', session, wa, from);
}

async function handleIssueComment(text, session, taiga, wa, from) {
  if (text === '0') return showIssue(session, wa, from);
  const issue = getCurrentItem(session);
  await taiga.postIssueComment(issue.id, text);
  await wa.sendMessage('Comment posted.', from);
  await showIssue(session, wa, from);
}

async function removeCurrentItem(kind, session, wa, from) {
  const project = getProject(session);
  if (!project) {
    resetWorkState(session);
    await wa.sendHome(from);
    return;
  }

  project.items.splice(session.activeIndex, 1);
  if (!project.items.length) {
    session.projects.splice(session.activeProjectIndex, 1);
    session.activeProjectIndex = null;
    session.activeIndex = 0;
    session.issuePage = 0;
    if (!session.projects.length) {
      resetWorkState(session);
      await wa.sendMessage('You have no more open work in this view.', from);
      await wa.sendHome(from);
      return;
    }
    session.step = kind === 'task' ? 'choose_task_project' : 'choose_issue_project';
    await wa.sendProjectPicker(kind, session.projects, from);
    return;
  }

  session.activeIndex = Math.min(session.activeIndex, project.items.length - 1);
  if (kind === 'task') {
    await showTask(session, wa, from);
  } else {
    session.issuePage = Math.floor(session.activeIndex / ISSUE_PAGE_SIZE);
    await showIssueList(session, wa, from);
  }
}

function friendlyError(error) {
  if (error.response?.status === 409) return 'This item changed in Taiga. Send *hi* and open it again before making another change.';
  if (error.response?.status === 403) return 'Taiga did not allow that action for your account.';
  return 'Something went wrong. Please try again or send *hi* to start over.';
}

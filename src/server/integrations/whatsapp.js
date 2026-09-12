import axios from 'axios';

function getWhatsAppApiUrl() {
  const version = process.env.META_GRAPH_API_VERSION;
  if (!/^v\d+\.\d+$/.test(version || '')) {
    throw new Error('META_GRAPH_API_VERSION must be set to an active Graph API version, for example v24.0.');
  }
  return `https://graph.facebook.com/${version}`;
}

function formatDue(due) {
  if (!due) return 'No deadline';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(due);
  dueDate.setHours(0, 0, 0, 0);
  const diff = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
  const date = dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  if (diff < 0) return `${date} · ${Math.abs(diff)}d overdue`;
  if (diff === 0) return `${date} · Due today`;
  return `${date} · ${diff}d left`;
}

function truncate(value, maxLength = 58) {
  if (!value) return 'Untitled';
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function createWhatsAppClient(userConfig) {
  const PHONE_ID = userConfig.phoneNumberId;
  const TOKEN = userConfig.accessToken;

  async function sendMessage(text, to) {
    try {
      await axios.post(
        `${getWhatsAppApiUrl()}/${PHONE_ID}/messages`,
        { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
        { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const providerError = error.response?.data?.error;
      console.error('WhatsApp send failed:', {
        status: error.response?.status,
        code: providerError?.code,
        type: providerError?.type,
        message: providerError?.message,
      });
      throw error;
    }
  }

  async function sendInteractiveList(text, button, rows, to) {
    try {
      await axios.post(
        `${getWhatsAppApiUrl()}/${PHONE_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'list',
            body: { text },
            action: { button, sections: [{ title: 'TaskPilot', rows }] },
          },
        },
        { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const providerError = error.response?.data?.error;
      console.error('WhatsApp interactive list send failed:', {
        status: error.response?.status,
        code: providerError?.code,
        message: providerError?.message,
      });
      throw error;
    }
  }

  async function sendButtons(text, buttons, to) {
    try {
      await axios.post(
        `${getWhatsAppApiUrl()}/${PHONE_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text },
            action: { buttons: buttons.map((button) => ({ type: 'reply', reply: button })) },
          },
        },
        { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      const providerError = error.response?.data?.error;
      console.error('WhatsApp interactive button send failed:', {
        status: error.response?.status,
        code: providerError?.code,
        message: providerError?.message,
      });
      throw error;
    }
  }

  async function sendHome(to) {
    await sendButtons('TaskPilot\n\nWhat would you like to manage?', [
      { id: 'home_tasks', title: 'My tasks' },
      { id: 'home_issues', title: 'My issues' },
    ], to);
  }

  async function sendProjectPicker(kind, projects, to) {
    const label = kind === 'issue' ? 'issues' : 'tasks';
    if (projects.length <= 10) {
      await sendInteractiveList(
        `Your open ${label}\n\nChoose a project.`,
        'Projects',
        projects.map((project, index) => ({
          id: `${kind}_project_${index}`,
          title: truncate(project.name, 24),
          description: `${project.items.length} open ${label}`,
        })),
        to
      );
      return;
    }
    const lines = projects.map((project, index) => `${index + 1}. ${truncate(project.name, 40)} · ${project.items.length}`).join('\n');
    await sendMessage(`Your open ${label}\n\n${lines}\n\nChoose a project number.\n0. Home`, to);
  }

  async function sendTaskCard(task, index, total, to) {
    const rows = [
      { id: 'task_comment', title: 'Comment', description: 'Add an update' },
      { id: 'task_status', title: 'Change status', description: 'Update this task' },
      { id: 'task_next', title: 'Next task', description: 'Stay in this project' },
    ];
    if (index > 0) rows.push({ id: 'task_previous', title: 'Previous task', description: 'Go back one task' });
    rows.push({ id: 'task_projects', title: 'Projects', description: 'Choose another project' });
    await sendInteractiveList(
      `${task.project} · ${index + 1} of ${total}\n\n${truncate(task.subject, 110)}\n${task.status}\n${formatDue(task.due)}`,
      'Actions',
      rows,
      to
    );
  }

  async function sendStatusPicker(kind, statuses, page, to) {
    const pageSize = 7;
    const start = page * pageSize;
    const visible = statuses.slice(start, start + pageSize);
    const rows = visible.map((status, index) => ({
      id: `${kind}_status_${start + index}`,
      title: truncate(status.name, 24),
      description: status.isClosed ? 'Closes this item' : 'Open status',
    }));
    if (start + pageSize < statuses.length) rows.push({ id: `${kind}_status_next`, title: 'More statuses', description: 'Show more choices' });
    if (page > 0) rows.push({ id: `${kind}_status_previous`, title: 'Previous statuses', description: 'Show earlier choices' });
    rows.push({ id: `${kind}_status_back`, title: 'Back', description: 'Keep the current status' });
    await sendInteractiveList('Choose a new status.', 'Statuses', rows, to);
  }

  async function sendAssigneePicker(issue, members, page, to) {
    const pageSize = 7;
    const start = page * pageSize;
    const visible = members.slice(start, start + pageSize);
    const rows = visible.map((member, index) => ({
      id: `issue_assignee_${start + index}`,
      title: truncate(member.name, 24),
      description: 'Assign this issue',
    }));
    if (start + pageSize < members.length) rows.push({ id: 'issue_assignee_next', title: 'More people', description: 'Show more project members' });
    if (page > 0) rows.push({ id: 'issue_assignee_previous', title: 'Previous people', description: 'Show earlier members' });
    rows.push({ id: 'issue_assignee_back', title: 'Back', description: 'Keep the current assignee' });
    await sendInteractiveList(`Reassign #${issue.ref} to:`, 'People', rows, to);
  }

  async function sendIssueList(project, issues, page, to) {
    const pageSize = 5;
    const start = page * pageSize;
    const visible = issues.slice(start, start + pageSize);
    const hasNext = start + pageSize < issues.length;
    const rows = visible.map((issue, index) => ({
      id: `issue_select_${start + index}`,
      title: truncate(`#${issue.ref} ${issue.subject}`, 24),
      description: truncate(issue.status, 72),
    }));
    if (hasNext) rows.push({ id: 'issue_next_page', title: 'More issues', description: 'Show the next five' });
    if (page > 0) rows.push({ id: 'issue_previous_page', title: 'Previous page', description: 'Show earlier issues' });
    rows.push({ id: 'issue_projects', title: 'Projects', description: 'Choose another project' });
    await sendInteractiveList(
      `${project.name}\nIssues ${start + 1}–${Math.min(start + pageSize, issues.length)} of ${issues.length}`,
      'View issues',
      rows,
      to
    );
  }

  async function sendIssueCard(issue, index, total, to) {
    const metadata = [issue.type, issue.priority, issue.severity].filter(Boolean).join(' · ');
    const rows = [
      { id: 'issue_status', title: 'Change status', description: 'Update this issue' },
      { id: 'issue_reassign', title: 'Reassign', description: 'Choose a project member' },
      { id: 'issue_comment', title: 'Comment', description: 'Add an update' },
      { id: 'issue_next', title: 'Next issue', description: 'Stay in this project' },
    ];
    if (index > 0) rows.push({ id: 'issue_previous', title: 'Previous issue', description: 'Go back one issue' });
    rows.push({ id: 'issue_list', title: 'Issue list', description: 'Return to the list' });
    await sendInteractiveList(
      `${issue.project} · ${index + 1} of ${total}\n\n#${issue.ref} ${truncate(issue.subject, 100)}\n${issue.status}${metadata ? `\n${metadata}` : ''}\n${formatDue(issue.due)}`,
      'Actions',
      rows,
      to
    );
  }

  return {
    sendMessage,
    sendButtons,
    sendHome,
    sendProjectPicker,
    sendTaskCard,
    sendStatusPicker,
    sendAssigneePicker,
    sendIssueList,
    sendIssueCard,
  };
}

import { getMhSession, saveMhSession } from '@/server/database/mhconnekt';
import { createMhConnektClient, getMhAccessToken } from '@/server/integrations/mhconnekt';

const TASKS_PER_PAGE = 6;
const MAX_ENTRIES = 8;
const DURATIONS = [
  ['15 min', 15], ['30 min', 30], ['45 min', 45], ['1 hour', 60],
  ['1½ hours', 90], ['2 hours', 120], ['3 hours', 180], ['4 hours', 240],
];
const OTHER_CATEGORIES = ['Meeting', 'Planning', 'Support / bug fix', 'Admin work'];

function today() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function endOfWeek() {
  const date = new Date(`${today()}T12:00:00Z`);
  const daysUntilSunday = (7 - date.getUTCDay()) % 7;
  date.setUTCDate(date.getUTCDate() + daysUntilSunday);
  return date.toISOString().slice(0, 10);
}

function startOfWeek() {
  const date = new Date(`${today()}T12:00:00Z`);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

function truncate(value, length = 24) {
  const text = String(value || 'Untitled task');
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return `${hours}h ${mins}m`;
}

function directTasks(project, records) {
  return records
    .filter((record) => record?.assignment && record?.task?.id)
    .filter((record) => !/completed|closed/i.test(record.assignment.employee_status || record.task.status || ''))
    .map((record) => ({
      projectId: project.Project_id,
      projectName: project.Project_name,
      taskId: record.task.id,
      name: record.task.name || 'Untitled task',
      status: record.assignment.employee_status || record.task.status || 'Open',
    }));
}

function resetTimesheet(session) {
  delete session.tasks;
  delete session.taskPage;
  delete session.selected;
  delete session.otherCategory;
  delete session.entries;
}

function totalMinutes(entries = []) {
  return entries.reduce((total, entry) => total + Number(entry.minutes || 0), 0);
}

async function showHome(session, wa, from) {
  resetTimesheet(session);
  session.step = 'home';
  await wa.sendButtons('MH Connekt\n\nWhat would you like to do?', [
    { id: 'mh_fill_time', title: 'Fill time' },
    { id: 'mh_my_week', title: 'My week' },
    { id: 'mh_punch', title: 'Punch in/out' },
  ], from);
}

async function showTaskPicker(session, wa, from, intro = 'Choose the task you worked on today.') {
  const tasks = session.tasks || [];
  const page = Math.max(0, Number(session.taskPage || 0));
  const start = page * TASKS_PER_PAGE;
  const rows = tasks.slice(start, start + TASKS_PER_PAGE).map((task, offset) => ({
    id: `mh_task_${start + offset}`,
    title: truncate(task.name),
    description: truncate(`${task.projectName} · ${task.status}`, 72),
  }));
  if (start + TASKS_PER_PAGE < tasks.length) rows.push({ id: 'mh_tasks_next', title: 'More tasks', description: 'Show more assigned tasks' });
  if (page > 0) rows.push({ id: 'mh_tasks_previous', title: 'Previous tasks', description: 'Show earlier tasks' });
  rows.push({ id: 'mh_other', title: 'Other work', description: 'Meeting, planning, support, or admin' });
  rows.push({ id: 'mh_home', title: 'Home', description: 'Cancel this timesheet' });
  session.step = 'choose_task';
  await wa.sendInteractiveList(intro, 'My tasks', rows, from);
}

async function loadTasks(session, mh, wa, from) {
  const projects = await mh.getProjects();
  const settled = await Promise.allSettled(projects.map(async (project) => directTasks(project, await mh.getTasks(project.Project_id))));
  session.tasks = settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  session.taskPage = 0;
  session.entries = session.entries || [];
  if (!session.tasks.length) {
    session.step = 'home';
    await wa.sendButtons('No open tasks are assigned to you right now.', [{ id: 'mh_home', title: 'Home' }], from);
    return;
  }
  await showTaskPicker(session, wa, from);
}

async function showDurationPicker(session, wa, from) {
  const task = session.selected;
  if (!task) return showTaskPicker(session, wa, from);
  const category = session.otherCategory ? `\nWork type: ${session.otherCategory}` : '';
  session.step = 'choose_duration';
  await wa.sendInteractiveList(
    `${truncate(task.name, 80)}\n${task.projectName}${category}\n\nHow long did you work?`,
    'Time',
    [
      ...DURATIONS.map(([label], index) => ({ id: `mh_duration_${index}`, title: label, description: 'Add to today' })),
      { id: 'mh_task_back', title: 'Choose another task', description: 'Go back' },
    ],
    from,
  );
}

async function showReview(session, wa, from) {
  const entries = session.entries || [];
  if (!entries.length) return showTaskPicker(session, wa, from);
  const lines = entries.map((entry, index) => {
    const detail = entry.otherCategory ? ` · ${entry.otherCategory}` : '';
    return `${index + 1}. ${truncate(entry.name, 48)}\n${entry.projectName}${detail} — ${formatDuration(entry.minutes)}`;
  });
  const buttons = [];
  if (entries.length < MAX_ENTRIES) buttons.push({ id: 'mh_add_another', title: 'Add another' });
  buttons.push({ id: 'mh_save_draft', title: 'Save draft' });
  buttons.push({ id: 'mh_submit', title: 'Submit' });
  session.step = 'review';
  await wa.sendButtons(`Review today\n\n${lines.join('\n\n')}\n\nTotal: ${formatDuration(totalMinutes(entries))}`, buttons, from);
}

function addEntry(session, minutes) {
  const selected = session.selected;
  const category = session.otherCategory || '';
  const existing = (session.entries || []).find((entry) => entry.taskId === selected.taskId && entry.otherCategory === category);
  if (existing) existing.minutes += minutes;
  else session.entries.push({ ...selected, minutes, otherCategory: category });
  delete session.selected;
  delete session.otherCategory;
}

async function saveEntries(session, mh, status) {
  const locationInfo = await mh.getWorkLocationInfo();
  const workMode = typeof locationInfo?.work_mode === 'string' ? locationInfo.work_mode.trim() : '';
  if (!workMode) throw new Error('We could not confirm your MH Connekt work mode. Open MH Connekt and try again.');

  const grouped = new Map();
  for (const entry of session.entries || []) {
    const entries = grouped.get(entry.projectId) || [];
    entries.push({
      Task_id: entry.taskId,
      Project_id: entry.projectId,
      Date: `${today()}T12:00:00+05:30`,
      hrs: Math.floor(entry.minutes / 60),
      min: entry.minutes % 60,
      Activities: entry.name,
      Activity_Description: entry.otherCategory || '',
      work_mode: workMode,
    });
    grouped.set(entry.projectId, entries);
  }
  const projects = [...grouped.entries()];
  const results = await Promise.allSettled(projects.map(([projectId, entries]) => mh.createTimesheet(projectId, entries, status)));
  return {
    savedProjectIds: projects.filter((_, index) => results[index].status === 'fulfilled').map(([projectId]) => projectId),
    failedProjectIds: projects.filter((_, index) => results[index].status === 'rejected').map(([projectId]) => projectId),
  };
}

async function showWeek(mh, session, wa, from) {
  const data = await mh.getTimesheets(startOfWeek(), endOfWeek());
  const entries = data?.timesheets || [];
  const drafts = entries.filter((entry) => entry.Timesheet_status === 'Draft');
  const submitted = entries.filter((entry) => entry.Timesheet_status === 'Submitted');
  const minutes = entries.reduce((total, entry) => total + (Number(entry.hrs || 0) * 60) + Number(entry.min || 0), 0);
  session.step = 'home';
  await wa.sendButtons(`This week\n\n${entries.length} time entries\n${drafts.length} draft · ${submitted.length} submitted\n${formatDuration(minutes)} logged`, [
    { id: 'mh_fill_time', title: 'Fill time' },
    { id: 'mh_home', title: 'Home' },
  ], from);
}

export async function handleMhConnektMessage({ from, command, connection, wa, msgId }) {
  const stored = await getMhSession(from);
  const session = stored ? { step: stored.step, ...(stored.data || {}) } : { step: 'idle' };
  if (session.lastMsgId === msgId) return;
  session.lastMsgId = msgId;
  const mh = createMhConnektClient(await getMhAccessToken(connection));

  if (['hi', 'hello', 'menu', 'home', 'mh_home'].includes(command) || session.step === 'idle') {
    await showHome(session, wa, from);
  } else if (command === 'mh_my_week') {
    await showWeek(mh, session, wa, from);
  } else if (command === 'mh_fill_time') {
    const working = await mh.getWorkingHours(today(), today());
    if ((working?.working_hours || []).some((day) => day.date === today() && day.type === 'leave')) {
      session.step = 'home';
      await wa.sendButtons('You are on leave today. No timesheet is needed.', [{ id: 'mh_home', title: 'Home' }], from);
    } else {
      resetTimesheet(session);
      await loadTasks(session, mh, wa, from);
    }
  } else if (command === 'mh_tasks_next') {
    session.taskPage = Number(session.taskPage || 0) + 1;
    await showTaskPicker(session, wa, from);
  } else if (command === 'mh_tasks_previous') {
    session.taskPage = Math.max(0, Number(session.taskPage || 0) - 1);
    await showTaskPicker(session, wa, from);
  } else if (command === 'mh_other') {
    session.step = 'choose_other_category';
    await wa.sendInteractiveList('What type of work was it?', 'Other work', [
      ...OTHER_CATEGORIES.map((category, index) => ({ id: `mh_other_category_${index}`, title: category, description: 'Choose an assigned task next' })),
      { id: 'mh_task_back', title: 'Back', description: 'Choose a normal task' },
    ], from);
  } else if (/^mh_other_category_\d+$/.test(command)) {
    const category = OTHER_CATEGORIES[Number(command.split('_').pop())];
    if (!category) await showTaskPicker(session, wa, from);
    else {
      session.otherCategory = category;
      session.taskPage = 0;
      await showTaskPicker(session, wa, from, `${category}\n\nChoose the assigned task to file this work against.`);
    }
  } else if (/^mh_task_\d+$/.test(command)) {
    const task = session.tasks?.[Number(command.split('_').pop())];
    if (!task) await showTaskPicker(session, wa, from, 'That task is no longer available. Choose again.');
    else {
      session.selected = task;
      await showDurationPicker(session, wa, from);
    }
  } else if (command === 'mh_task_back') {
    delete session.selected;
    delete session.otherCategory;
    await showTaskPicker(session, wa, from);
  } else if (/^mh_duration_\d+$/.test(command)) {
    const choice = DURATIONS[Number(command.split('_').pop())];
    if (!session.selected || !choice) await showTaskPicker(session, wa, from, 'Choose a task first.');
    else {
      addEntry(session, choice[1]);
      await showReview(session, wa, from);
    }
  } else if (command === 'mh_add_another' && (session.entries || []).length < MAX_ENTRIES) {
    session.taskPage = 0;
    await showTaskPicker(session, wa, from, 'Add another task or work type.');
  } else if ((command === 'mh_save_draft' || command === 'mh_submit') && (session.entries || []).length) {
    const status = command === 'mh_submit' ? 'Submitted' : 'Draft';
    const outcome = await saveEntries(session, mh, status);
    const savedEntries = session.entries.filter((entry) => outcome.savedProjectIds.includes(entry.projectId));
    const failedEntries = session.entries.filter((entry) => outcome.failedProjectIds.includes(entry.projectId));
    if (failedEntries.length) {
      session.entries = failedEntries;
      await wa.sendMessage(`Saved ${savedEntries.length} item${savedEntries.length === 1 ? '' : 's'}. ${failedEntries.length} item${failedEntries.length === 1 ? '' : 's'} could not be saved. Review and try those again.`, from);
      await showReview(session, wa, from);
      const { step, ...data } = session;
      await saveMhSession(from, step, data);
      return;
    }
    const count = savedEntries.length;
    const logged = formatDuration(totalMinutes(savedEntries));
    resetTimesheet(session);
    session.step = 'home';
    await wa.sendButtons(`${status === 'Submitted' ? 'Submitted' : 'Draft saved'}\n\n${count} items · ${logged}`, [
      { id: 'mh_fill_time', title: 'Fill time' },
      { id: 'mh_my_week', title: 'My week' },
      { id: 'mh_home', title: 'Home' },
    ], from);
  } else if (command === 'mh_punch') {
    session.step = 'home';
    await wa.sendButtons('Punch in/out will be added after we capture the official MH request at the office.', [{ id: 'mh_home', title: 'Home' }], from);
  } else {
    await showHome(session, wa, from);
  }

  const { step, ...data } = session;
  await saveMhSession(from, step, data);
}

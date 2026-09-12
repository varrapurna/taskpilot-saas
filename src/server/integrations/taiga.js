import axios from 'axios';

export function createTaigaClient(userConfig, cachedToken) {
  const BASE = userConfig.taigaBaseUrl;
  let authToken = cachedToken?.token || null;
  let userId = cachedToken?.userId || null;

  async function login() {
    const res = await axios.post(`${BASE}/auth`, {
      type: 'normal',
      username: userConfig.taigaUsername,
      password: userConfig.taigaPassword,
    });
    authToken = res.data.auth_token;
    userId = res.data.id;
    return authToken;
  }

  function getHeaders() {
    return {
      Authorization: `Bearer ${authToken}`,
      // Never quietly show just Taiga's first result page.
      'x-disable-pagination': 'true',
    };
  }

  function getTokenSnapshot() {
    return { token: authToken, userId };
  }

  async function withAuth(fn) {
    if (!authToken) await login();
    try {
      return await fn();
    } catch (err) {
      if (err.response?.status === 401) {
        authToken = null;
        await login();
        return fn();
      }
      throw err;
    }
  }

  async function getMyTasks() {
    return withAuth(async () => {
      const res = await axios.get(
        `${BASE}/tasks?assigned_to=${userId}&status__is_closed=false`,
        { headers: getHeaders() }
      );

      return res.data.map((task) => ({
        id: task.id,
        ref: task.ref,
        subject: task.subject,
        status: task.status_extra_info?.name || 'Unknown',
        due: task.due_date || null,
        project: task.project_extra_info?.name || 'Unknown project',
        projectId: task.project,
        version: task.version,
      }));
    });
  }

  async function getMyIssues() {
    return withAuth(async () => {
      const res = await axios.get(
        `${BASE}/issues?assigned_to=${userId}&status__is_closed=false`,
        { headers: getHeaders() }
      );

      return res.data.map((issue) => ({
        id: issue.id,
        ref: issue.ref,
        subject: issue.subject,
        status: issue.status_extra_info?.name || 'Unknown',
        priority: issue.priority_extra_info?.name || null,
        severity: issue.severity_extra_info?.name || null,
        type: issue.type_extra_info?.name || issue.issue_type_extra_info?.name || null,
        due: issue.due_date || null,
        project: issue.project_extra_info?.name || 'Unknown project',
        projectId: issue.project,
        version: issue.version,
      }));
    });
  }

  async function postComment(taskId, comment) {
    return withAuth(async () => {
      const res = await axios.post(`${BASE}/history/task/${taskId}`, { comment }, { headers: getHeaders() });
      return res.data;
    });
  }

  async function postIssueComment(issueId, comment) {
    return withAuth(async () => {
      const res = await axios.post(`${BASE}/history/issue/${issueId}`, { comment }, { headers: getHeaders() });
      return res.data;
    });
  }

  async function changeTaskStatus(taskId, newStatusId, version) {
    return withAuth(async () => {
      const res = await axios.patch(
        `${BASE}/tasks/${taskId}`,
        { status: newStatusId, version },
        { headers: getHeaders() }
      );
      return res.data;
    });
  }

  async function changeIssueStatus(issueId, newStatusId, version) {
    return withAuth(async () => {
      const res = await axios.patch(
        `${BASE}/issues/${issueId}`,
        { status: newStatusId, version },
        { headers: getHeaders() }
      );
      return res.data;
    });
  }

  async function assignIssue(issueId, assigneeId, version) {
    return withAuth(async () => {
      const res = await axios.patch(
        `${BASE}/issues/${issueId}`,
        { assigned_to: assigneeId, version },
        { headers: getHeaders() }
      );
      return res.data;
    });
  }

  async function getTaskStatuses(projectId) {
    return withAuth(async () => {
      const res = await axios.get(`${BASE}/task-statuses?project=${projectId}`, { headers: getHeaders() });
      return res.data.map((status) => ({ id: status.id, name: status.name, isClosed: Boolean(status.is_closed) }));
    });
  }

  async function getIssueStatuses(projectId) {
    return withAuth(async () => {
      const res = await axios.get(`${BASE}/issue-statuses?project=${projectId}`, { headers: getHeaders() });
      return res.data.map((status) => ({ id: status.id, name: status.name, isClosed: Boolean(status.is_closed) }));
    });
  }

  async function getProjectMembers(projectId) {
    return withAuth(async () => {
      const res = await axios.get(`${BASE}/memberships?project=${projectId}`, { headers: getHeaders() });
      return res.data
        .map((membership) => ({
          id: membership.user,
          name: membership.full_name || membership.username || membership.email || 'Unnamed member',
        }))
        .filter((member) => member.id);
    });
  }

  return {
    getMyTasks,
    getMyIssues,
    postComment,
    postIssueComment,
    changeTaskStatus,
    changeIssueStatus,
    assignIssue,
    getTaskStatuses,
    getIssueStatuses,
    getProjectMembers,
    getTokenSnapshot,
  };
}

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
    return { Authorization: `Bearer ${authToken}` };
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
        return await fn();
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

      const storyIds = [...new Set(res.data.filter(t => t.user_story).map(t => t.user_story))];
      const storyData = {};
      await Promise.all(storyIds.map(async (storyId) => {
        try {
          const s = await axios.get(`${BASE}/userstories/${storyId}`, { headers: getHeaders() });
          storyData[storyId] = {
            epic: s.data.epics?.[0]?.subject || s.data.epic_extra_info?.subject || 'No epic',
            status: s.data.status_extra_info?.name || 'Unknown',
            version: s.data.version,
          };
        } catch (_) {
          storyData[storyId] = { epic: 'No epic', status: 'Unknown', version: 1 };
        }
      }));

      return res.data.map(task => ({
        id: task.id,
        ref: task.ref,
        subject: task.subject,
        status: task.status_extra_info?.name || 'Unknown',
        due: task.due_date || null,
        userStory: task.user_story_extra_info?.subject || 'No user story',
        userStoryRef: task.user_story_extra_info?.ref || null,
        userStoryId: task.user_story,
        userStoryStatus: storyData[task.user_story]?.status || 'Unknown',
        userStoryVersion: storyData[task.user_story]?.version || 1,
        epic: storyData[task.user_story]?.epic || 'No epic',
        project: task.project_extra_info?.name || 'Unknown project',
        projectId: task.project,
        version: task.version,
      }));
    });
  }

  async function postComment(taskId, comment) {
    return withAuth(() =>
      axios.post(`${BASE}/history/task/${taskId}`, { comment }, { headers: getHeaders() })
    );
  }

  async function changeTaskStatus(taskId, newStatusId, version) {
    return withAuth(() =>
      axios.patch(`${BASE}/tasks/${taskId}`, { status: newStatusId, version }, { headers: getHeaders() })
    );
  }

  async function changeUserStoryStatus(storyId, newStatusId, version) {
    return withAuth(() =>
      axios.patch(`${BASE}/userstories/${storyId}`, { status: newStatusId, version }, { headers: getHeaders() })
    );
  }

  async function getTaskStatuses(projectId) {
    return withAuth(async () => {
      const res = await axios.get(`${BASE}/task-statuses?project=${projectId}`, { headers: getHeaders() });
      return res.data.map(s => ({ id: s.id, name: s.name }));
    });
  }

  async function getUserStoryStatuses(projectId) {
    return withAuth(async () => {
      const res = await axios.get(`${BASE}/userstory-statuses?project=${projectId}`, { headers: getHeaders() });
      return res.data.map(s => ({ id: s.id, name: s.name }));
    });
  }

  return {
    getMyTasks, postComment, changeTaskStatus,
    changeUserStoryStatus, getTaskStatuses, getUserStoryStatuses,
    getTokenSnapshot,
  };
}

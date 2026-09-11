import 'server-only';

import { createAdminClient } from '@/server/database/pocketbase';

function pocketBaseDate(date) {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function toUserSummary(record) {
  return {
    id: record.id,
    name: record.name || 'Unnamed user',
    email: record.email,
    role: record.role === 'admin' ? 'admin' : 'user',
    verified: Boolean(record.verified),
    created: record.created,
    lastLoginAt: record.last_login_at || null,
  };
}

export async function getAdminOverview() {
  const pb = await createAdminClient();
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(now.getDate() - 7);
  const monthAgo = new Date(now);
  monthAgo.setDate(now.getDate() - 30);

  // PocketBase automatically cancels matching requests from the same client.
  // These list queries all target the users collection, so run them in order
  // instead of using Promise.all. This keeps every metric reliable.
  const allUsers = await pb.collection('users').getList(1, 1);
  const verifiedUsers = await pb.collection('users').getList(1, 1, { filter: 'verified = true' });
  const newUsers = await pb.collection('users').getList(1, 1, {
    filter: `created >= "${pocketBaseDate(weekAgo)}"`,
  });
  const activeUsers = await pb.collection('users').getList(1, 1, {
    filter: `last_login_at >= "${pocketBaseDate(monthAgo)}"`,
  });
  const recentUsers = await pb.collection('users').getList(1, 25, { sort: '-created' });

  return {
    metrics: {
      totalUsers: allUsers.totalItems,
      verifiedUsers: verifiedUsers.totalItems,
      newUsersThisWeek: newUsers.totalItems,
      activeUsersLast30Days: activeUsers.totalItems,
    },
    users: recentUsers.items.map(toUserSummary),
  };
}

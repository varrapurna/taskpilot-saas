import DashboardClient from '../_components/DashboardClient';

// Vercel only renders this shell. The authenticated dashboard data comes from
// the AWS API, where PocketBase's private credentials remain server-only.
export default function DashboardPage() {
  return <DashboardClient />;
}

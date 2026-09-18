import DashboardPage from "./DashboardPage";
import { ORDERS_PERMISSION_ID } from "@/constant";

/**
 * The landing screen.
 *
 * Staff who can work on orders land on the dashboard; everyone else still gets
 * the welcome message they got before. The gate is the Orders permission
 * because that is exactly what the analytics endpoints require — showing the
 * dashboard to someone without it would render five cards of 403s.
 *
 * Read from localStorage rather than redux: CheckAuthority writes it before
 * these children ever render, and the sidebar slice only carries the nav items
 * the user is allowed to see, not the raw permission map.
 */
const canSeeDashboard = () => {
  try {
    const stored = localStorage.getItem("permissions");
    if (!stored) return false;

    const permissions = JSON.parse(stored) as Record<string, string> | null;
    return Boolean(permissions && ORDERS_PERMISSION_ID in permissions);
  } catch {
    // A corrupt or unparseable entry is not a reason to break the page.
    return false;
  }
};

export default function HomeWelcomePage() {
  if (canSeeDashboard()) return <DashboardPage />;

  return (
    <div className="w-full flex items-center justify-center">
      <div className="text-center">
        <h2 className="font-semibold text-2xl">Welcome To Admin Panel</h2>
        <h2 className="text-sm text-gray-500">
          Get the necessary permission from the admin to access the admin panel
          options.
        </h2>
      </div>
    </div>
  );
}

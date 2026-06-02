import { Topbar } from "@/components/Topbar";
import { Dashboard } from "@/components/Dashboard";

export default function Page() {
  return (
    <div className="min-h-screen">
      <Topbar />
      <Dashboard />
    </div>
  );
}

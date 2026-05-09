import { Metadata } from "next";

export const metadata: Metadata = { title: "Admin Settings | AI Sales" };

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Admin Settings</h1>
      <p className="text-muted-foreground">Shop settings, currency, logo, and API keys will appear here — Sprint 01.</p>
    </div>
  );
}

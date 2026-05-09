import { Metadata } from "next";

export const metadata: Metadata = { title: "Settings | AI Sales" };

export default function SellerSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Settings</h1>
      <p className="text-muted-foreground">Profile and notification settings will appear here — Sprint 01.</p>
    </div>
  );
}

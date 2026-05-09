import { Metadata } from "next";
import ResetPasswordForm from "./reset-password-form";

export const metadata: Metadata = { title: "Reset Password | AI Sales" };

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}

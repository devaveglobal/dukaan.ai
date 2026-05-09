import { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Login | AI Sales" };

export default function LoginPage() {
  return <LoginForm />;
}

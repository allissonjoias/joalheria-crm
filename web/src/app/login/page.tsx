import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-creme-200">
          <div className="text-alisson-700">Carregando...</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { authEnabled, getFirebaseAuth } from "@/lib/firebase";

interface Session {
  userLabel?: string;
  signOut?: () => void;
}

/**
 * Pide acceso con Firebase Auth cuando las variables NEXT_PUBLIC_FIREBASE_* están definidas.
 * Sin ellas deja pasar (modo demostración).
 */
export function AuthGate({ children }: { children: (s: Session) => React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!authEnabled);

  useEffect(() => {
    if (!authEnabled) return;
    return onAuthStateChanged(getFirebaseAuth(), (u) => {
      setUser(u);
      setReady(true);
    });
  }, []);

  if (!authEnabled) return <>{children({})}</>;
  if (!ready) return <div className="grid min-h-dvh place-items-center text-ink-2">Verificando sesión…</div>;
  if (!user) return <Login />;
  return (
    <>
      {children({
        userLabel: user.email ?? user.displayName ?? "Sesión iniciada",
        signOut: () => void signOut(getFirebaseAuth()),
      })}
    </>
  );
}

function errorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Correo o contraseña incorrectos. Revisa los datos e inténtalo de nuevo.";
  }
  if (code.includes("too-many-requests")) return "Demasiados intentos. Espera unos minutos antes de volver a intentarlo.";
  if (code.includes("popup-closed")) return "Cerraste la ventana de Google antes de terminar. Inténtalo de nuevo.";
  return "No se pudo iniciar sesión. Revisa tu conexión e inténtalo de nuevo.";
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm overflow-hidden rounded-[3px] bg-surface shadow-[0_2px_8px_rgba(14,14,16,0.2)]">
        <div className="flex h-10 items-center bg-forecast px-4">
          <span className="num text-[12px] font-semibold uppercase tracking-[0.08em] text-white">RAL 5010</span>
        </div>
        <div className="p-6">
          <h1 className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-tight">
            Pronóstico de inventario
          </h1>
          <p className="mt-1 text-ink-2">Inicia sesión para ver el estado de los insumos.</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(() => signInWithEmailAndPassword(getFirebaseAuth(), email, password));
            }}
          >
            <label className="block text-[14px] font-medium">
              Correo
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block h-11 w-full rounded-[3px] border border-ink-2 bg-white px-3"
              />
            </label>
            <label className="block text-[14px] font-medium">
              Contraseña
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block h-11 w-full rounded-[3px] border border-ink-2 bg-white px-3"
              />
            </label>
            {error && (
              <p role="alert" className="rounded-[3px] bg-crit px-3 py-2 text-[14px] font-medium text-white">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-[3px] bg-ink font-semibold text-white hover:bg-forecast disabled:opacity-60"
            >
              {busy ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => signInWithPopup(getFirebaseAuth(), new GoogleAuthProvider()))}
            className="mt-3 h-11 w-full rounded-[3px] border border-ink font-semibold hover:bg-white disabled:opacity-60"
          >
            Entrar con Google
          </button>
        </div>
      </div>
    </main>
  );
}

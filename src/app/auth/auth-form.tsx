"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, Mail, LockKeyhole, UserRound } from "lucide-react";
import {
  register,
  requestPasswordReset,
  signIn,
  updatePassword,
  type AuthActionState,
} from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "login" | "register" | "forgot" | "update";

const initialState: AuthActionState = {};

export function AuthForm({ mode, notice, setupMessage, nextPath = "/app" }: { mode: AuthMode; notice?: string; setupMessage?: string | null; nextPath?: string }) {
  const action = mode === "login"
    ? signIn
    : mode === "register"
      ? register
      : mode === "forgot"
        ? requestPasswordReset
        : updatePassword;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);
  const [oauthError, setOauthError] = useState("");

  async function continueWithGoogle() {
    if (oauthPending || setupMessage) return;
    setOauthPending(true);
    setOauthError("");
    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath || "/app")}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) {
        setOauthError(error.message || "Google sign-in could not start. Try again.");
        setOauthPending(false);
      }
      // On success Supabase redirects the browser away.
    } catch (cause) {
      setOauthError(cause instanceof Error ? cause.message : "Google sign-in is unavailable right now.");
      setOauthPending(false);
    }
  }

  const title = {
    login: "Welcome back",
    register: "Create your study space",
    forgot: "Reset your password",
    update: "Choose a new password",
  }[mode];

  const description = {
    login: "Sign in to pick up where your learning left off.",
    register: "One account for your lectures, courses, and study tools.",
    forgot: "If your email is registered, we’ll send a secure reset link.",
    update: "Choose a new password for your StudyStation account.",
  }[mode];

  return (
    <section className="w-full max-w-[440px] rounded-[28px] border border-[#e8e4ef] bg-white p-6 shadow-[0_24px_80px_rgba(41,31,77,.10)] sm:p-9">
      <p className="text-[10px] font-black uppercase tracking-[.16em] text-[#7259e8]">StudyStation account</p>
      <h1 className="mt-3 text-[28px] font-black tracking-[-1px] text-[#17132d]">{title}</h1>
      <p className="mt-2 text-[13px] leading-6 text-[#777180]">{description}</p>

      {setupMessage && <p className="mt-5 rounded-xl border border-[#f0e4c8] bg-[#fff9e9] px-4 py-3 text-sm leading-5 text-[#80621c]" role="status">{setupMessage}</p>}
      {notice && <p className="mt-5 rounded-xl border border-[#d7eee2] bg-[#effaf4] px-4 py-3 text-sm leading-5 text-[#26684b]" role="status">{notice}</p>}
      {state.success && <p className="mt-5 rounded-xl border border-[#d7eee2] bg-[#effaf4] px-4 py-3 text-sm leading-5 text-[#26684b]" role="status">{state.success}</p>}
      {state.error && <p className="mt-5 rounded-xl border border-[#f2d5d2] bg-[#fff4f2] px-4 py-3 text-sm leading-5 text-[#9b3f38]" role="alert">{state.error}</p>}
      {oauthError && <p className="mt-5 rounded-xl border border-[#f2d5d2] bg-[#fff4f2] px-4 py-3 text-sm leading-5 text-[#9b3f38]" role="alert">{oauthError}</p>}

      {!(mode === "register" && state.success) && !(mode === "forgot" && state.success) && (
        <>
      {(mode === "login" || mode === "register") && (
        <div className="mt-6 space-y-4">
          <button
            type="button"
            onClick={() => void continueWithGoogle()}
            disabled={oauthPending || Boolean(setupMessage)}
            className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#e5e1ec] bg-white px-5 text-sm font-extrabold text-[#302a40] shadow-sm transition hover:bg-[#faf9fd] disabled:cursor-wait disabled:opacity-70"
          >
            {oauthPending ? (
              <><LoaderCircle className="size-4 animate-spin" /> Connecting to Google…</>
            ) : (
              <>
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
                  <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.4c-.3 1.5-1.2 2.8-2.5 3.7v3h4.1c2.4-2.2 3.5-5.5 3.5-8.8z"/>
                  <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-4.1-3c-1.1.8-2.6 1.2-3.8 1.2-2.9 0-5.4-2-6.3-4.6H1.5v3.1C3.5 21.3 7.5 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.7 14.7c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7.2H1.5C.5 9.1 0 10.5 0 12.5s.5 3.4 1.5 5.3l4.2-3.1z"/>
                  <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.5 0 3.5 2.7 1.5 6.7l4.2 3.1C6.6 6.8 9.1 4.8 12 4.8z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.12em] text-[#a29bb0]">
            <span className="h-px flex-1 bg-[#ebe7f1]" />
            or use email
            <span className="h-px flex-1 bg-[#ebe7f1]" />
          </div>
        </div>
      )}
        <form action={formAction} className="mt-4 space-y-4">
          {mode === "register" && (
            <label className="block text-xs font-bold text-[#343047]">
              Your name
              <span className="relative mt-2 block">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#a29baa]" aria-hidden="true" />
                <input name="name" autoComplete="name" required minLength={2} maxLength={100} className="h-12 w-full rounded-xl border border-[#e5e1ec] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#a99aec]" />
              </span>
            </label>
          )}

          {mode !== "update" && (
            <label className="block text-xs font-bold text-[#343047]">
              Email address
              <span className="relative mt-2 block">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#a29baa]" aria-hidden="true" />
                <input name="email" type="email" autoComplete="email" required maxLength={254} className="h-12 w-full rounded-xl border border-[#e5e1ec] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#a99aec]" />
              </span>
            </label>
          )}

          {mode === "login" && <input type="hidden" name="next" value={nextPath} />}

          {(mode === "login" || mode === "register" || mode === "update") && (
            <label className="block text-xs font-bold text-[#343047]">
              {mode === "update" ? "New password" : "Password"}
              <span className="relative mt-2 block">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#a29baa]" aria-hidden="true" />
                <input name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={mode === "login" ? undefined : 8} maxLength={128} className="h-12 w-full rounded-xl border border-[#e5e1ec] bg-white pl-10 pr-12 text-sm outline-none focus:border-[#a99aec]" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#8c8795] hover:bg-[#f3f0f7] hover:text-[#514a66]">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </span>
              {(mode === "register" || mode === "update") && <span className="mt-1.5 block text-[11px] font-medium text-[#8c8795]">Use at least 8 characters.</span>}
            </label>
          )}

          {mode === "update" && (
            <label className="block text-xs font-bold text-[#343047]">
              Confirm new password
              <span className="relative mt-2 block">
                <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#a29baa]" aria-hidden="true" />
                <input name="confirmPassword" type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} className="h-12 w-full rounded-xl border border-[#e5e1ec] bg-white pl-10 pr-12 text-sm outline-none focus:border-[#a99aec]" />
                <button type="button" onClick={() => setShowConfirmPassword((visible) => !visible)} aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"} aria-pressed={showConfirmPassword} className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#8c8795] hover:bg-[#f3f0f7] hover:text-[#514a66]">{showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
              </span>
            </label>
          )}

          <button disabled={pending} className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-5 text-sm font-extrabold text-white shadow-[0_10px_25px_rgba(114,89,232,.23)] transition hover:bg-[#624bda] disabled:cursor-wait disabled:opacity-70">
            {pending ? <><LoaderCircle className="size-4 animate-spin" /> Please wait…</> : <>{mode === "login" ? "Sign in" : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : "Update password"} <ArrowRight className="size-4" /></>}
          </button>
        </form>
        </>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-[#777180]">
        {mode === "login" && <><Link className="hover:text-[#7259e8]" href="/auth/forgot-password">Forgot password?</Link><span>New here? <Link className="font-extrabold text-[#7259e8]" href="/auth/register">Create an account</Link></span></>}
        {mode === "register" && <span>Already have an account? <Link className="font-extrabold text-[#7259e8]" href="/auth/login">Sign in</Link></span>}
        {(mode === "forgot" || mode === "update") && <Link className="font-extrabold text-[#7259e8]" href="/auth/login">Back to sign in</Link>}
      </div>
    </section>
  );
}

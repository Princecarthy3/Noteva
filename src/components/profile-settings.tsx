"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Camera, Check, LoaderCircle, LogOut, Moon, Sun, Trash2, UserRound, X } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { saveProfile } from "@/app/app/profile-actions";
import { createClient } from "@/lib/supabase/client";
import type { ThemePreference } from "@/components/theme-provider";

type ProfileSettingsData = {
  fullName: string;
  email: string;
  programme: string;
  university: string;
  semester: string;
  timezone: string;
  avatarUrl: string | null;
  avatarPath: string;
};

const maxAvatarSize = 5 * 1024 * 1024;
const avatarTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function ProfileSettings({
  profile,
  theme,
  onThemeChange,
}: {
  profile: ProfileSettingsData;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [avatarPath, setAvatarPath] = useState(profile.avatarPath);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [saving, startSaving] = useTransition();
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const initials = profile.fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "ST";
  const avatar = avatarPreview ?? profile.avatarUrl;

  async function chooseAvatar(file?: File) {
    if (!file) return;
    const extension = avatarTypes[file.type];
    if (!extension) {
      setMessage("Choose a JPG, PNG, or WebP image.");
      setMessageIsError(true);
      return;
    }
    if (file.size < 1 || file.size > maxAvatarSize) {
      setMessage("Profile pictures must be smaller than 5 MB.");
      setMessageIsError(true);
      return;
    }

    setAvatarUploading(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sign in again before uploading a profile picture.");
      const path = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("profile-avatars").upload(path, file, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw new Error("Your profile picture could not be uploaded. Check that the profile avatar migration has been applied.");
      setAvatarPath(path);
      setAvatarPreview(URL.createObjectURL(file));
      setMessage("Picture ready. Save your profile to keep this change.");
      setMessageIsError(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your profile picture could not be uploaded.");
      setMessageIsError(true);
    } finally {
      setAvatarUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function removeAvatar() {
    setAvatarPath("");
    setAvatarPreview(null);
    setMessage("Picture removal is ready. Save your profile to apply it.");
    setMessageIsError(false);
  }

  function submitProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("avatarPath", avatarPath);
    setMessage("");
    startSaving(async () => {
      const result = await saveProfile(form);
      setMessage(result.error ?? result.success ?? "Profile update finished.");
      setMessageIsError(Boolean(result.error));
      if (!result.error) {
        setAvatarPreview(null);
        router.refresh();
      }
    });
  }

  async function deleteAccount() {
    setDeleting(true);
    setMessage("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteConfirmation }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Your account could not be deleted.");
      await createClient().auth.signOut();
      router.replace("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your account could not be deleted.");
      setMessageIsError(true);
      setDeleteDialog(false);
    } finally {
      setDeleting(false);
    }
  }

  const inputClass = "mt-1.5 h-11 w-full rounded-xl border border-[#e5e1eb] bg-white px-3 text-sm text-[#302a40] outline-none focus:border-[#a99aed]";

  return <div className="mx-auto max-w-4xl space-y-5">
    <header>
      <p className="text-[10px] font-black uppercase tracking-[.15em] text-[#7259e8]">Your account</p>
      <h1 className="mt-1 text-[25px] font-black tracking-[-1.1px] text-[#17132d] sm:text-[29px]">Profile & settings</h1>
      <p className="mt-1.5 text-[12px] leading-5 text-[#7d7789]">Manage your profile, appearance, and account access.</p>
    </header>

    {message && <p role={messageIsError ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-xs font-semibold ${messageIsError ? "bg-[#fff1ef] text-[#a44e48]" : "bg-[#f1efff] text-[#5b47bd]"}`}>{message}</p>}

    <section className="profile-panel rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-5 border-b border-[#f0edf4] pb-6 sm:flex-row sm:items-center">
        <div className="relative size-[88px] shrink-0">
          {avatar
            ? <Image src={avatar} alt={`${profile.fullName} profile`} width={88} height={88} unoptimized className="size-[88px] rounded-[26px] border border-[#ece8f3] object-cover" />
            : <span className="grid size-[88px] place-items-center rounded-[26px] bg-gradient-to-tr from-[#7259e8] to-[#a18bff] text-2xl font-black text-white">{initials}</span>}
          <button type="button" onClick={() => fileInput.current?.click()} disabled={avatarUploading} aria-label="Upload profile picture" className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-xl border-2 border-white bg-[#7259e8] text-white shadow-sm disabled:opacity-60"><Camera className="size-4" /></button>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void chooseAvatar(event.currentTarget.files?.[0])} />
        </div>
        <div className="min-w-0 flex-1"><h2 className="text-lg font-extrabold text-[#28233a]">{profile.fullName}</h2><p className="mt-1 truncate text-xs text-[#85808d]">{profile.email}</p><p className="mt-2 text-[10px] text-[#9993a0]">JPG, PNG, or WebP · up to 5 MB</p></div>
        {avatar && <button type="button" onClick={removeAvatar} className="self-start rounded-lg px-3 py-2 text-xs font-bold text-[#8c5960] hover:bg-[#fff1f1]">Remove picture</button>}
      </div>

      <form onSubmit={submitProfile} className="pt-6">
        <div className="mb-4 flex items-center gap-2"><UserRound className="size-4 text-[#7259e8]" /><h2 className="text-sm font-extrabold text-[#28233a]">Personal information</h2></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-[#625b6d]">Full name<input name="fullName" required minLength={2} maxLength={100} defaultValue={profile.fullName} className={inputClass} /></label>
          <label className="text-xs font-bold text-[#625b6d]">Email address<input value={profile.email} readOnly className={`${inputClass} cursor-not-allowed bg-[#f8f7fa]`} /><span className="mt-1 block text-[10px] font-normal text-[#9993a0]">Contact support to change your sign-in email.</span></label>
          <label className="text-xs font-bold text-[#625b6d]">Programme or degree<input name="programme" maxLength={160} defaultValue={profile.programme} className={inputClass} placeholder="e.g. Computer Science" /></label>
          <label className="text-xs font-bold text-[#625b6d]">University<input name="university" maxLength={160} defaultValue={profile.university} className={inputClass} placeholder="Your university" /></label>
          <label className="text-xs font-bold text-[#625b6d]">Current semester<input name="semester" maxLength={80} defaultValue={profile.semester} className={inputClass} placeholder="e.g. Semester 2 · 2026" /></label>
          <label className="text-xs font-bold text-[#625b6d]">Timezone<input name="timezone" maxLength={80} defaultValue={profile.timezone || "UTC"} className={inputClass} placeholder="e.g. Africa/Accra" /><span className="mt-1 block text-[10px] font-normal text-[#9993a0]">Use an IANA timezone such as Africa/Accra or America/New_York.</span></label>
        </div>
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-[#f0edf4] pt-5 sm:flex-row sm:items-center sm:justify-between"><a href="/auth/forgot-password" className="text-xs font-bold text-[#7259e8] hover:underline">Change password</a><button type="submit" disabled={saving || avatarUploading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-4 text-xs font-extrabold text-white transition hover:bg-[#8069ed] disabled:opacity-60">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}Save profile</button></div>
      </form>
    </section>

    <section className="profile-panel rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f3f0ff] text-[#7259e8]">{theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}</span><div><h2 className="text-sm font-extrabold text-[#28233a]">Appearance</h2><p className="mt-1 text-xs text-[#85808d]">Choose how StudyStation looks on this device.</p></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label="Color theme">
        {([{ value: "light", label: "Light", Icon: Sun }, { value: "dark", label: "Dark", Icon: Moon }, { value: "system", label: "Use device setting", Icon: UserRound }] as const).map(({ value, label, Icon }) =>
          <button key={value} type="button" onClick={() => onThemeChange(value)} aria-pressed={theme === value} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${theme === value ? "border-[#b9acef] bg-[#f3f0ff] text-[#624bc7]" : "border-[#e9e5ef] text-[#625b6d] hover:bg-[#faf9fc]"}`}><Icon className="size-4" />{label}</button>)}
      </div>
    </section>

    {profile.email?.toLowerCase() === "studystation.support@gmail.com" && (
      <section className="profile-panel rounded-[24px] border border-indigo-200 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-extrabold text-[#28233a]">Admin Command Center</h2>
            </div>
            <p className="mt-1 text-xs text-[#85808d]">Access platform metrics, student accounts, lectures, and system telemetry.</p>
          </div>
          <a
            href="/admin"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#7259e8] px-4 text-xs font-extrabold text-white transition hover:bg-[#8069ed] shrink-0"
          >
            Open Admin Portal
          </a>
        </div>
      </section>
    )}

    <section className="profile-panel rounded-[24px] border border-[#e9e5ef] bg-white p-5 sm:p-7">
      <div><h2 className="text-sm font-extrabold text-[#28233a]">Session & account</h2><p className="mt-1 text-xs text-[#85808d]">Sign out on this device or permanently remove your account.</p></div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <form action={signOut} className="flex-1"><button type="submit" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#e5e1eb] px-4 text-xs font-extrabold text-[#4e485b] transition hover:bg-[#f8f7fa]"><LogOut className="size-4" />Sign out</button></form>
        <button type="button" onClick={() => {setDeleteConfirmation(""); setDeleteDialog(true);}} className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#f0d9d9] px-4 text-xs font-extrabold text-[#a44e48] transition hover:bg-[#fff5f4]"><Trash2 className="size-4" />Delete account</button>
      </div>
    </section>

    {deleteDialog && <div className="fixed inset-0 z-[100] grid place-items-center bg-[#17132d]/55 p-4 backdrop-blur-sm"><section role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" className="w-full max-w-md rounded-[24px] bg-white p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-black uppercase tracking-[.14em] text-[#b14f49]">Permanent action</p><h2 id="delete-account-title" className="mt-1 text-xl font-black text-[#28233a]">Delete your account?</h2></div><button type="button" aria-label="Close" onClick={() => setDeleteDialog(false)} className="grid size-8 place-items-center rounded-lg bg-[#f4f2f7]"><X className="size-4" /></button></div><p className="mt-3 text-xs leading-5 text-[#706a79]">This permanently deletes your StudyStation account and associated study data. This cannot be undone.</p><label className="mt-4 block text-xs font-bold text-[#625b6d]">Type DELETE to confirm<input autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className={inputClass} /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteDialog(false)} className="h-10 rounded-xl px-4 text-xs font-bold text-[#777180]">Cancel</button><button type="button" onClick={() => void deleteAccount()} disabled={deleteConfirmation !== "DELETE" || deleting} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#ae4d48] px-4 text-xs font-extrabold text-white disabled:opacity-50">{deleting && <LoaderCircle className="size-4 animate-spin" />}Permanently delete</button></div></section></div>}
  </div>;
}

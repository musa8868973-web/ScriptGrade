import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Chrome,
  Eye,
  EyeOff,
  Globe2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { authApi, isOffline } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const DEMO_EMAIL = (import.meta.env["VITE_DEMO_EMAIL"] as string) ?? "demo@scriptgrade.pk";
const DEMO_PASSWORD = (import.meta.env["VITE_DEMO_PASSWORD"] as string) ?? "HackathonDemo2026";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const stats = [
  { value: "6M", label: "scripts / year" },
  { value: "80%", label: "time saved" },
  { value: "4", label: "languages" },
];

function strengthOf(pw: string): { label: "Weak" | "Fair" | "Strong"; pct: number; tone: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^\w\s]/.test(pw)) score++;
  if (score <= 1) return { label: "Weak", pct: 30, tone: "bg-alert" };
  if (score <= 3) return { label: "Fair", pct: 65, tone: "bg-warn" };
  return { label: "Strong", pct: 100, tone: "bg-pass" };
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-10 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-royalBlue focus:ring-1 focus:ring-royalBlue";

export function AuthScreen({ initialTab = "signin" }: { initialTab?: "signin" | "signup" }) {
  const [tab, setTab] = useState<"signin" | "signup">(initialTab);
  const [showPw, setShowPw] = useState(false);
  const [pending, setPending] = useState<null | "signin" | "signup" | "demo">(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();

  const [signin, setSignin] = useState({ email: "", password: "", rememberMe: true });
  const [signup, setSignup] = useState({
    fullName: "",
    email: "",
    institution: "",
    role: "teacher" as Role,
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });

  const finish = (token: string, teacher: { id: string; name: string; institution: string }) => {
    setToken(token);
    setUser(teacher);
    toast.success(`Welcome back, ${teacher.name.split(" ")[0]}`, {
      description: "JWT session established · role-based access granted.",
    });
    navigate({ to: "/dashboard" });
  };

  const demoSession = (name: string, institution: string, role: Role = "teacher") => ({
    token: `demo.jwt.${btoa(name).slice(0, 12)}`,
    teacher: { id: "tch_demo", name, institution, role },
  });

  const handleSignIn = async () => {
    const next: Record<string, string> = {};
    if (!emailRe.test(signin.email)) next["email"] = "Enter a valid institutional email";
    if (signin.password.length < 8) next["password"] = "Password must be at least 8 characters";
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending("signin");
    try {
      const res = await authApi.login({ email: signin.email, password: signin.password });
      finish(res.data.access_token, res.data.teacher);
    } catch (error) {
      if (isOffline(error)) {
        const s = demoSession(signin.email.split("@")[0]!, "Offline Demo Institute");
        finish(s.token, s.teacher);
      } else {
        setErrors({ password: "Incorrect password" });
      }
    } finally {
      setPending(null);
    }
  };

  const handleSignUp = async () => {
    const next: Record<string, string> = {};
    if (signup.fullName.trim().length < 2) next["fullName"] = "Enter your full name";
    if (!emailRe.test(signup.email)) next["email"] = "Enter a valid institutional email";
    if (signup.institution.trim().length < 2) next["institution"] = "Enter your institution";
    if (signup.password.length < 8) next["password"] = "Password must be at least 8 characters";
    if (signup.password !== signup.confirmPassword) next["confirmPassword"] = "Passwords do not match";
    if (!signup.agreeToTerms) next["agreeToTerms"] = "You must agree to continue";
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending("signup");
    try {
      const res = await authApi.signup({
        full_name: signup.fullName,
        email: signup.email,
        password: signup.password,
        institution: signup.institution,
        role: signup.role,
      });
      finish(res.data.access_token, res.data.teacher);
    } catch (error) {
      if (isOffline(error)) {
        const s = demoSession(signup.fullName, signup.institution, signup.role);
        finish(s.token, s.teacher);
      } else {
        setErrors({ email: "An account with this email already exists" });
      }
    } finally {
      setPending(null);
    }
  };

  const handleDemo = async () => {
    setPending("demo");
    setSignin({ email: DEMO_EMAIL, password: DEMO_PASSWORD, rememberMe: true });
    try {
      const res = await authApi.login({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      finish(res.data.access_token, res.data.teacher);
    } catch (error) {
      if (isOffline(error)) {
        const s = demoSession("Rohail Khan Shinwari", "Alibaba Cloud Hackathon PK", "exam_controller");
        finish(s.token, s.teacher);
      }
    } finally {
      setPending(null);
    }
  };

  const pw = strengthOf(signup.password);

  return (
    <div className="grid min-h-screen bg-royalBlue lg:grid-cols-[42fr_58fr]">
      {/* ── Brand panel ─────────────────────────────────────── */}
      <section className="relative flex flex-col justify-between overflow-hidden border-b border-white/10 p-8 md:p-12 lg:border-r lg:border-b-0">
        <div className="relative">
          <div className="flex items-center gap-3">
            <img
              src="/ScriptGrade_Logo.png"
              alt="ScriptGrade Logo"
              className="h-10 w-auto object-contain"
            />
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-white">ScriptGrade</p>
              <p className="mono-token text-[0.625rem] text-white/70">
                NLP GRADING &amp; DIAGNOSTICS
              </p>
            </div>
          </div>

          <h1 className="mt-14 max-w-md font-display text-4xl leading-[1.08] font-semibold tracking-tight text-white md:text-[3rem]">
            Grading that <span className="text-amber-300">thinks like a teacher</span> — at
            machine speed.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/80">
            Eight transparent NLP debuggers audit every answer sheet — relevance, negation, synonyms,
            spelling, procedural order, diagrams, density, and rubric aggregation.
          </p>

          <div className="mt-12 flex flex-wrap gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="min-w-[108px] rounded-xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur-xs shadow-sm"
              >
                <p className="font-display text-2xl font-bold tracking-tight text-white">
                  {s.value}
                </p>
                <p className="mt-1 text-[0.6875rem] font-medium text-white/75">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/15 pt-6">
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-white/75">
            <Sparkles size={11} className="text-amber-300" /> Alibaba Cloud · Qwen3.8-Max Powered
          </span>
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-white/75">
            <ShieldCheck size={11} className="text-emerald-400" /> JWT · RBAC secured
          </span>
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-white/75">
            <Globe2 size={11} className="text-sky-300" /> EN · اردو · سنڌي · پنجابی
          </span>
        </div>
      </section>

      {/* ── Form panel (Centered White / Light Cream Card) ─────── */}
      <section className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[440px] rounded-2xl bg-[#FDFBF7] p-8 shadow-xl border border-white/20 spring-in">
          <div role="tablist" className="mb-6 grid grid-cols-2 border-b border-slate-200">
            {(["signin", "signup"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => {
                  setTab(t);
                  setErrors({});
                }}
                className={cn(
                  "-mb-px border-b-2 py-3 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-royalBlue font-semibold text-royalBlue"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {tab === "signin" ? (
            <div className="space-y-4">
              <Labeled label="Institutional Email" error={errors["email"]}>
                <Mail size={15} className="pointer-events-none absolute top-3 left-3 text-slate-400" />
                <input
                  type="email"
                  autoComplete="email"
                  value={signin.email}
                  onChange={(e) => setSignin({ ...signin, email: e.target.value })}
                  placeholder="teacher@university.edu.pk"
                  className={field}
                />
              </Labeled>

              <Labeled label="Password" error={errors["password"]}>
                <Lock size={15} className="pointer-events-none absolute top-3 left-3 text-slate-400" />
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  value={signin.password}
                  onChange={(e) => setSignin({ ...signin, password: e.target.value })}
                  placeholder="••••••••"
                  className={field}
                />
                <button
                  type="button"
                  aria-label={showPw ? "Hide password" : "Show password"}
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-slate-700"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </Labeled>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={signin.rememberMe}
                    onChange={(e) => setSignin({ ...signin, rememberMe: e.target.checked })}
                    className="size-3.5 rounded accent-royalBlue"
                  />
                  Remember me
                </label>
                <button className="font-medium text-royalBlue hover:underline">Forgot?</button>
              </div>

              <PrimaryButton onClick={handleSignIn} loading={pending === "signin"}>
                Sign In
              </PrimaryButton>
            </div>
          ) : (
            <div className="space-y-4">
              <Labeled label="Full Name" error={errors["fullName"]}>
                <User size={15} className="pointer-events-none absolute top-3 left-3 text-slate-400" />
                <input
                  value={signup.fullName}
                  onChange={(e) => setSignup({ ...signup, fullName: e.target.value })}
                  placeholder="Rohail Khan Shinwari"
                  className={field}
                />
              </Labeled>

              <Labeled label="Institutional Email" error={errors["email"]}>
                <Mail size={15} className="pointer-events-none absolute top-3 left-3 text-slate-400" />
                <input
                  type="email"
                  value={signup.email}
                  onChange={(e) => setSignup({ ...signup, email: e.target.value })}
                  placeholder="you@university.edu.pk"
                  className={field}
                />
              </Labeled>

              <Labeled label="Institution" error={errors["institution"]}>
                <Building2 size={15} className="pointer-events-none absolute top-3 left-3 text-slate-400" />
                <input
                  value={signup.institution}
                  onChange={(e) => setSignup({ ...signup, institution: e.target.value })}
                  placeholder="NUST · Islamabad"
                  className={field}
                />
              </Labeled>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Role</label>
                <select
                  value={signup.role}
                  onChange={(e) => setSignup({ ...signup, role: e.target.value as Role })}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-royalBlue focus:ring-1 focus:ring-royalBlue"
                >
                  <option value="teacher">Teacher</option>
                </select>
              </div>

              <Labeled label="Password" error={errors["password"]}>
                <Lock size={15} className="pointer-events-none absolute top-3 left-3 text-slate-400" />
                <input
                  type="password"
                  value={signup.password}
                  onChange={(e) => setSignup({ ...signup, password: e.target.value })}
                  placeholder="••••••••"
                  className={field}
                />
              </Labeled>
              {signup.password && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div className={cn("h-full transition-all", pw.tone)} style={{ width: `${pw.pct}%` }} />
                  </div>
                  <span className="mono-token text-[0.625rem] font-medium text-slate-600">{pw.label}</span>
                </div>
              )}

              <Labeled label="Confirm Password" error={errors["confirmPassword"]}>
                <Lock size={15} className="pointer-events-none absolute top-3 left-3 text-slate-400" />
                <input
                  type="password"
                  value={signup.confirmPassword}
                  onChange={(e) => setSignup({ ...signup, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className={field}
                />
              </Labeled>

              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={signup.agreeToTerms}
                  onChange={(e) => setSignup({ ...signup, agreeToTerms: e.target.checked })}
                  className="mt-0.5 size-3.5 rounded accent-royalBlue"
                />
                I agree to the academic-integrity terms and data-processing policy.
              </label>
              {errors["agreeToTerms"] && <p className="text-xs text-alert">{errors["agreeToTerms"]}</p>}

              <PrimaryButton onClick={handleSignUp} loading={pending === "signup"}>
                Create Account
              </PrimaryButton>
            </div>
          )}

          <div className="my-5 flex items-center gap-3 text-[0.6875rem] font-medium text-slate-400">
            <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Google Workspace", Icon: Chrome },
              { label: "Microsoft 365", Icon: Building2 },
            ].map(({ label, Icon }) => (
              <button
                key={label}
                onClick={() => toast.info(`${label} SSO`, { description: "Mock provider — hackathon build." })}
                className="flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white py-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <button
              onClick={handleDemo}
              disabled={pending === "demo"}
              className="magnetic flex w-full items-center justify-center gap-2 rounded-md bg-royalBlue py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-royalBlue-800 disabled:opacity-60"
            >
              {pending === "demo" ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              Quick Demo Access
            </button>
            <p className="mono-token mt-2 text-center text-[0.625rem] text-slate-500">
              {DEMO_EMAIL} → /dashboard
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Labeled({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">{label}</label>
      <div className="relative">{children}</div>
      {error && <p className="mt-1 text-xs text-alert">{error}</p>}
    </div>
  );
}

function PrimaryButton({
  onClick,
  loading,
  children,
}: {
  onClick: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="magnetic flex w-full items-center justify-center gap-2 rounded-md bg-royalBlue py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-royalBlue-800 disabled:opacity-60"
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

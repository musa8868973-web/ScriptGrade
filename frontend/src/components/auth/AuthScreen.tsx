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
  ScanEye,
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
  "w-full rounded-md border border-input bg-card px-10 py-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-brand";

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
    if (signup.fullName.trim().length < 2) next["fullName"] = "Enter 2–80 characters";
    if (!emailRe.test(signup.email)) next["email"] = "Enter a valid institutional email";
    if (signup.institution.trim().length < 2) next["institution"] = "Enter 2–100 characters";
    if (signup.password.length < 8) next["password"] = "Minimum 8 characters";
    if (signup.password !== signup.confirmPassword) next["confirmPassword"] = "Passwords must match";
    if (!signup.agreeToTerms) next["agreeToTerms"] = "You must accept the terms";
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending("signup");
    try {
      const res = await authApi.signup({
        full_name: signup.fullName,
        email: signup.email,
        institution: signup.institution,
        role: signup.role,
        password: signup.password,
      });
      finish(res.data.access_token, res.data.teacher);
    } catch (error) {
      if (isOffline(error)) {
        const s = demoSession(signup.fullName, signup.institution, signup.role);
        finish(s.token, s.teacher);
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
    <div className="grid min-h-screen lg:grid-cols-[40fr_60fr]">
      {/* ── Brand panel ─────────────────────────────────────── */}
      <section className="relative flex flex-col justify-between overflow-hidden border-r border-border bg-[#EFF6FF] p-8 md:p-12">
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md border border-border">
              <ScanEye size={20} className="text-brand" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">ScriptGrade</p>
              <p className="mono-token text-[0.625rem] text-muted-foreground">
                NLP GRADING &amp; DIAGNOSTICS
              </p>
            </div>
          </div>

          <h1 className="mt-16 max-w-md font-display text-4xl leading-[1.08] font-semibold tracking-tight md:text-[3rem]">
            Grading that <span className="text-gradient-brand">thinks like a teacher</span> — at
            machine speed.
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Eight transparent NLP debuggers audit every answer sheet — relevance, negation, synonyms,
            spelling, procedural order, diagrams, density, and rubric aggregation.
          </p>

          <div className="mt-12 flex flex-wrap gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="min-w-[104px] rounded-lg border border-[#E0F2FE] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.06)]"
              >
                <p className="font-display text-xl font-semibold tracking-tight text-foreground">
                  {s.value}
                </p>
                <p className="mt-1 text-[0.6875rem] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6">
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted-foreground">
            <Sparkles size={11} /> Alibaba Cloud · Qwen3.8-Max Powered
          </span>
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted-foreground">
            <ShieldCheck size={11} /> JWT · RBAC secured
          </span>
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted-foreground">
            <Globe2 size={11} /> EN · اردو · سنڌي · پنجابی
          </span>
        </div>
      </section>

      {/* ── Form panel ──────────────────────────────────────── */}
      <section className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-[420px] spring-in">
          <div role="tablist" className="mb-8 grid grid-cols-2 border-b border-border">
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
                    ? "border-brand text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "signin" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {tab === "signin" ? (
            <div className="space-y-4">
              <Labeled label="Institutional Email" error={errors["email"]}>
                <Mail size={15} className="pointer-events-none absolute top-3 left-3 text-muted-foreground" />
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
                <Lock size={15} className="pointer-events-none absolute top-3 left-3 text-muted-foreground" />
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
                  className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </Labeled>

              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={signin.rememberMe}
                    onChange={(e) => setSignin({ ...signin, rememberMe: e.target.checked })}
                    className="size-3.5 accent-[var(--brand)]"
                  />
                  Remember me
                </label>
                <button className="text-brand hover:underline">Forgot?</button>
              </div>

              <PrimaryButton onClick={handleSignIn} loading={pending === "signin"}>
                Sign In
              </PrimaryButton>
            </div>
          ) : (
            <div className="space-y-4">
              <Labeled label="Full Name" error={errors["fullName"]}>
                <User size={15} className="pointer-events-none absolute top-3 left-3 text-muted-foreground" />
                <input
                  value={signup.fullName}
                  onChange={(e) => setSignup({ ...signup, fullName: e.target.value })}
                  placeholder="Rohail Khan Shinwari"
                  className={field}
                />
              </Labeled>

              <Labeled label="Institutional Email" error={errors["email"]}>
                <Mail size={15} className="pointer-events-none absolute top-3 left-3 text-muted-foreground" />
                <input
                  type="email"
                  value={signup.email}
                  onChange={(e) => setSignup({ ...signup, email: e.target.value })}
                  placeholder="you@university.edu.pk"
                  className={field}
                />
              </Labeled>

              <Labeled label="Institution" error={errors["institution"]}>
                <Building2 size={15} className="pointer-events-none absolute top-3 left-3 text-muted-foreground" />
                <input
                  value={signup.institution}
                  onChange={(e) => setSignup({ ...signup, institution: e.target.value })}
                  placeholder="NUST · Islamabad"
                  className={field}
                />
              </Labeled>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Role</label>
                <select
                  value={signup.role}
                  onChange={(e) => setSignup({ ...signup, role: e.target.value as Role })}
                  className="w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-brand"
                >
                  <option value="teacher">Teacher</option>
                  <option value="department_head">Department Head</option>
                  <option value="exam_controller">Exam Controller</option>
                </select>
              </div>

              <Labeled label="Password" error={errors["password"]}>
                <Lock size={15} className="pointer-events-none absolute top-3 left-3 text-muted-foreground" />
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
                  <div className="h-1 flex-1 overflow-hidden bg-secondary">
                    <div className={cn("h-full transition-all", pw.tone)} style={{ width: `${pw.pct}%` }} />
                  </div>
                  <span className="mono-token text-[0.625rem] text-muted-foreground">{pw.label}</span>
                </div>
              )}

              <Labeled label="Confirm Password" error={errors["confirmPassword"]}>
                <Lock size={15} className="pointer-events-none absolute top-3 left-3 text-muted-foreground" />
                <input
                  type="password"
                  value={signup.confirmPassword}
                  onChange={(e) => setSignup({ ...signup, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className={field}
                />
              </Labeled>

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={signup.agreeToTerms}
                  onChange={(e) => setSignup({ ...signup, agreeToTerms: e.target.checked })}
                  className="mt-0.5 size-3.5 accent-[var(--brand)]"
                />
                I agree to the academic-integrity terms and data-processing policy.
              </label>
              {errors["agreeToTerms"] && <p className="text-xs text-alert">{errors["agreeToTerms"]}</p>}

              <PrimaryButton onClick={handleSignUp} loading={pending === "signup"}>
                Create Account
              </PrimaryButton>
            </div>
          )}

          <div className="my-5 flex items-center gap-3 text-[0.6875rem] text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Google Workspace", Icon: Chrome },
              { label: "Microsoft 365", Icon: Building2 },
            ].map(({ label, Icon }) => (
              <button
                key={label}
                onClick={() => toast.info(`${label} SSO`, { description: "Mock provider — hackathon build." })}
                className="flex items-center justify-center gap-2 rounded-md border border-border py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <button
              onClick={handleDemo}
              disabled={pending === "demo"}
              className="magnetic flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending === "demo" ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
              Quick Demo Access
            </button>
            <p className="mono-token mt-2 text-center text-[0.625rem] text-muted-foreground">
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
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
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
      className="magnetic flex w-full items-center justify-center gap-2 rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

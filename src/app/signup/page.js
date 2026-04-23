"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Suspense } from "react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(redirect ? "student" : "student");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSignup(e) {
    e.preventDefault(); setLoading(true); setError(null);
    if (role === "student" && !consent) { setError("Please agree to the pilot participation terms to continue."); setLoading(false); return; }
    const res = await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, fullName, role }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setLoading(false); return; }
    const supabase = createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) { setError(signInErr.message); setLoading(false); return; }
    if (redirect) { router.push(redirect); return; }
    router.push(role === "professor" ? "/dashboard" : "/feedback/" + data.user.id);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-5xl font-normal text-gray-900 mb-1" style={{ fontFamily: "'Cardo', serif" }}>Veridia</h1>
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</p>
      <p className="text-gray-500 text-sm mb-8">{redirect ? "Create an account to start your oral exam" : "Create your account"}</p>
      <form onSubmit={handleSignup} className="w-full max-w-sm space-y-4">
        <input type="text" placeholder="Full name" value={fullName} onChange={e => setFullName(e.target.value)} required
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        <input type="password" placeholder="Password (min 6 characters)" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        {!redirect && (
          <div className="flex gap-3">
            <button type="button" onClick={() => setRole("professor")}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${role === "professor" ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>Professor</button>
            <button type="button" onClick={() => setRole("student")}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${role === "student" ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-500"}`}>Student</button>
          </div>
        )}

        {(role === "student" || redirect) && (
          <div className="bg-gray-50 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 shrink-0" />
              <span className="text-xs text-gray-600 leading-relaxed">
                I agree to participate in the Veridia pilot program. I understand that my oral exam conversation will be recorded and reviewed by my professor to assess my understanding of the course material. Veridia does not store personal data beyond what is needed to provide this service. I can request the deletion of my data at any time by emailing <a href="mailto:info@veridia.com" className="underline" style={{ color: "#009B4D" }}>info@veridia.com</a>.
              </span>
            </label>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50" style={{ backgroundColor: "#009B4D" }}>
          {loading ? "Creating..." : redirect ? "Create Account & Start Oral Exam" : "Create Account"}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-500">
        Already have an account? <a href={redirect ? `/login?redirect=${encodeURIComponent(redirect)}` : "/login"} className="font-medium" style={{ color: "#009B4D" }}>Sign in</a>
      </p>
    </div>
  );
}

export default function SignupPage() { return <Suspense><SignupForm /></Suspense>; }

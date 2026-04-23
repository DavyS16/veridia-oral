"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { Suspense } from "react";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); setLoading(false); return; }
    if (redirect) { router.push(redirect); return; }
    router.push(data.user?.user_metadata?.role === "professor" ? "/dashboard" : "/feedback/" + data.user.id);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <h1 className="text-5xl font-normal text-gray-900 mb-1" style={{ fontFamily: "'Cardo', serif" }}>Veridia</h1>
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</p>
      <p className="text-gray-500 text-sm mb-8">{redirect ? "Sign in to access your oral exam" : "Sign in to your account"}</p>
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
          className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-white font-semibold disabled:opacity-50" style={{ backgroundColor: "#009B4D" }}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <p className="mt-6 text-sm text-gray-500">
        Don't have an account? <a href={redirect ? `/signup?redirect=${encodeURIComponent(redirect)}` : "/signup"} className="font-medium" style={{ color: "#009B4D" }}>Sign up</a>
      </p>
    </div>
  );
}

export default function LoginPage() { return <Suspense><LoginForm /></Suspense>; }

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace(user.user_metadata?.role === "professor" ? "/dashboard" : "/feedback/" + user.id);
      } else { router.replace("/login"); }
      setLoading(false);
    });
  }, [router]);
  return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">{loading ? "Loading..." : "Redirecting..."}</p></div>;
}

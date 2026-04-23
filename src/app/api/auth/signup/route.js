import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request) {
  const { email, password, fullName, role, studentKey } = await request.json();
  const supabase = createAdminClient();

  const metadata = { full_name: fullName, role: role || "student" };
  if (studentKey) metadata.student_key = studentKey;

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: metadata,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data.user });
}

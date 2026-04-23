import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export async function POST(request) {
  try {
    const body = await request.json();
    const { assignmentId, studentName, studentId: studentUserId, studentExtId, section, transcript, durationSeconds } = body;
    if (!assignmentId || !studentName || !transcript) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.from("submissions").insert({
      assignment_id: assignmentId, student_id: studentUserId || null,
      student_name: studentName, student_ext_id: studentExtId || "",
      section: section || "",
      transcript, duration_seconds: durationSeconds || 0,
    }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (err) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { submissionId, professorScore, professorFeedback, release } = body;
    const supabase = createAdminClient();
    const update = {};
    if (professorScore !== undefined) update.professor_score = professorScore;
    if (professorFeedback !== undefined) update.professor_feedback = professorFeedback;
    if (release !== undefined) update.scores_released = release;
    const { error } = await supabase.from("submissions").update(update).eq("id", submissionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const assignmentId = searchParams.get("assignmentId");
  const studentId = searchParams.get("studentId");
  const supabase = createAdminClient();

  if (assignmentId) {
    const { data } = await supabase.from("submissions").select("*").eq("assignment_id", assignmentId).order("submitted_at", { ascending: false });
    return NextResponse.json((data || []).map(mapSubmission));
  }
  if (studentId) {
    const { data } = await supabase.from("submissions").select("*, assignments(*)").eq("student_id", studentId).eq("scores_released", true).order("submitted_at", { ascending: false });
    return NextResponse.json((data || []).map(d => ({
      ...mapSubmission(d),
      assignment: d.assignments ? { courseName: d.assignments.course_name, assignmentTitle: d.assignments.assignment_title } : null,
    })));
  }
  return NextResponse.json([]);
}

function mapSubmission(d) {
  return {
    id: d.id, assignmentId: d.assignment_id, studentId: d.student_id,
    studentName: d.student_name, studentExtId: d.student_ext_id,
    transcript: d.transcript, durationSeconds: d.duration_seconds, depthScore: d.depth_score,
    summary: d.summary, annotations: d.annotations,
    professorScore: d.professor_score, professorFeedback: d.professor_feedback,
    section: d.section, scoresReleased: d.scores_released, submittedAt: d.submitted_at,
  };
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import crypto from "crypto";

export async function POST(request) {
  try {
    const body = await request.json();
    const { courseName, assignmentTitle, topicsToCover, syllabusText, classMaterialsText, professorGuidance, sections, professorId } = body;
    if (!courseName || !assignmentTitle || !topicsToCover) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = crypto.randomBytes(4).toString("hex");
    const supabase = createAdminClient();

    const { error } = await supabase.from("assignments").insert({
      id,
      professor_id: professorId || null,
      course_name: courseName,
      assignment_title: assignmentTitle,
      topics_to_cover: topicsToCover,
      syllabus_text: (syllabusText || "").slice(0, 10000),
      class_materials_text: (classMaterialsText || "").slice(0, 15000),
      professor_guidance: (professorGuidance || "").slice(0, 3000),
      sections: sections || [],
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ id, url: `/s/${id}` });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const professorId = searchParams.get("professorId");
  const supabase = createAdminClient();

  if (id) {
    const { data, error } = await supabase.from("assignments").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      id: data.id, courseName: data.course_name, assignmentTitle: data.assignment_title,
      topicsToCover: data.topics_to_cover,
      syllabusText: data.syllabus_text, classMaterialsText: data.class_materials_text,
      professorGuidance: data.professor_guidance, sections: data.sections, professorId: data.professor_id, createdAt: data.created_at,
    });
  }

  if (professorId) {
    const { data } = await supabase.from("assignments").select("*").eq("professor_id", professorId).order("created_at", { ascending: false });
    return NextResponse.json((data || []).map(d => ({
      id: d.id, courseName: d.course_name, assignmentTitle: d.assignment_title,
      topicsToCover: d.topics_to_cover, createdAt: d.created_at,
    })));
  }

  return NextResponse.json([]);
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const supabase = createAdminClient();
    await supabase.from("submissions").delete().eq("assignment_id", id);
    const { error } = await supabase.from("assignments").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, courseName, assignmentTitle, topicsToCover, syllabusText, classMaterialsText, professorGuidance, sections } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const supabase = createAdminClient();
    const update = {};
    if (courseName !== undefined) update.course_name = courseName;
    if (assignmentTitle !== undefined) update.assignment_title = assignmentTitle;
    if (topicsToCover !== undefined) update.topics_to_cover = topicsToCover;
    if (syllabusText !== undefined) update.syllabus_text = (syllabusText || "").slice(0, 10000);
    if (classMaterialsText !== undefined) update.class_materials_text = (classMaterialsText || "").slice(0, 15000);
    if (professorGuidance !== undefined) update.professor_guidance = (professorGuidance || "").slice(0, 3000);
    if (sections !== undefined) update.sections = sections;
    const { error } = await supabase.from("assignments").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

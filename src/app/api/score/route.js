import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request) {
  try {
    const body = await request.json();
    const { transcript, assignmentTitle, topicsToCover, classMaterialsText, professorGuidance, submissionId } = body;

    if (!transcript || transcript.length === 0) return NextResponse.json({ error: "No transcript" }, { status: 400 });
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });

    const client = new Anthropic({ apiKey });
    const transcriptText = transcript.map((t, i) => `[${i}] ${t.role === "assistant" ? "Veridia" : "Student"}: ${t.text}`).join("\n\n");
    const topicsList = (topicsToCover || []).join(", ");
    const materialsSection = classMaterialsText ? `\n\nCLASS MATERIALS (lectures, slides, readings) — the authoritative source of truth for what the student was expected to have learned:\n${(classMaterialsText || "").slice(0, 6000)}` : "";
    const guidanceSection = professorGuidance ? `\n\nPROFESSOR'S GUIDANCE on how this conversation should be conducted:\n${professorGuidance}` : "";

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: `You are evaluating a student's understanding of course material based on an oral exam they had with Veridia. This is an oral-only exam: the student did not submit any written work beforehand. Your job is to assess whether the student understands the course material covered in the conversation. You are NOT grading speaking ability. You are only evaluating whether they understand the material.

        ORAL EXAM: ${assignmentTitle || "N/A"}
        TOPICS THE PROFESSOR WANTS COVERED: ${topicsList || "N/A"}${materialsSection}${guidanceSection}

        THE CONVERSATION TRANSCRIPT (each exchange is numbered):
        ${transcriptText}

        SCORING GUIDELINES:
        - Be fair, not harsh. A student who understands the material but expresses it imperfectly should score well. You are evaluating understanding, not eloquence.
        - A score of 5 means the student understood roughly half the material. A score of 7-8 means they understood most of it with minor gaps. Reserve 0-2 for students who clearly did not understand the material. Reserve 9-10 for students who demonstrated complete and precise command.
        - Nervousness, hesitation, and informal language are not signs of poor understanding. Focus on the substance of what the student said, not how confidently they said it.
        - If a student gives a correct but incomplete answer, that is partial understanding, not a failure.

        Produce the following:

        1. DEPTH SCORE (0-10 integer): To what extent does this student understand the course material covered in the exam?
           0 = Could not engage substantively with any topic
           1-2 = Major gaps; failed to explain most key topics
           3-4 = Significant gaps; explained some points but missed important ones
           5-6 = Partial understanding; got the main ideas but struggled with specifics or depth
           7-8 = Strong understanding; explained most topics clearly with only minor gaps
           9 = Excellent; explained everything clearly and accurately with depth
           10 = Complete command; not only explained everything but showed insight beyond the material

        2. ANNOTATED TRANSCRIPT: For each exchange where the student speaks (role = "user"), determine if there is an issue:
           - "inaccuracy": What the student said is factually wrong based on the course material or established knowledge. You MUST state what the student said, what is actually correct (quoting from the course materials when possible), and why it matters. Do not flag matters of interpretation or debate as inaccuracies. Only flag statements that are objectively incorrect.
           - "contradiction": What the student said at this point in the conversation directly contradicts what they said earlier in the same conversation. You MUST quote the specific earlier statement (with its exchange index) that is contradicted. Only flag clear contradictions where the student said X here but said the opposite of X earlier. Do not flag elaborations, clarifications, or shifts that could be reasonably consistent.
           - "evasiveness": The student is avoiding the question, giving non-answers, deflecting, or otherwise dodging a direct request for explanation. Flag this when the student: (1) says "I don't know" or equivalent to a question that the course materials or the exam topics clearly require them to engage with, (2) gives a vague or generic answer when a specific explanation was requested, or (3) changes the subject to avoid a topic they were asked about. Explain specifically what was evaded and what a substantive response would have addressed.
           - null: No issue detected. Most exchanges should be null. Do not over-flag.

           IMPORTANT: Your annotations must justify your score. If you score a student below 10, the gaps that cost them points must be visible in the annotations. A score of 7 means 3 points were lost — the professor should be able to see in the transcript exactly where those points were lost.

           When you flag something, be specific enough that the professor can immediately verify it. Bad example: "The student seemed unsure about this topic." Good example: "The student said 'I don't really remember' when asked to explain the trilemma in exchange 6. The course materials define the trilemma as the impossibility of simultaneously maintaining a fixed exchange rate, free capital movement, and an independent monetary policy."
           Do not flag: minor verbal imprecision, nervousness, informal phrasing, or correct answers that are simply less detailed than one might hope.

           For each flag, include a confidence level: "high" (you are certain this is wrong, contradictory, or evasive) or "medium" (this is likely problematic but could be a matter of interpretation).

        3. NARRATIVE SUMMARY (3-5 sentences): A brief note to the professor explaining the score. Be specific. Reference exact moments from the conversation. If you flagged inaccuracies, contradictions, or evasiveness, mention the most important ones. If the student did well, say what they explained effectively. This should read like a concise, fair teaching assistant's assessment.

        Respond ONLY in this JSON format, no other text:
        {
          "depthScore": 0,
          "summary": "",
          "annotations": [
            {"exchangeIndex": 0, "type": null, "explanation": null, "confidence": null}
          ]
        }

        The annotations array must have one entry for every exchange where the student speaks. Use the transcript index numbers. If no issue, set type, explanation, and confidence to null.`
      }],
    });

    let jsonStr = response.content[0].text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    const result = JSON.parse(jsonStr);

    if (submissionId) {
      const { createAdminClient } = await import("@/lib/supabase-admin");
      const supabase = createAdminClient();
      await supabase.from("submissions").update({
        depth_score: result.depthScore, summary: result.summary, annotations: result.annotations,
      }).eq("id", submissionId);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Scoring error:", err);
    return NextResponse.json({ error: "Scoring failed: " + err.message }, { status: 500 });
  }
}

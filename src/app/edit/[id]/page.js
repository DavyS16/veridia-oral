"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function EditAssignment() {
  const { id: assignmentId } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [courseName, setCourseName] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [topics, setTopics] = useState([""]);
  const [syllabusText, setSyllabusText] = useState("");
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [classMaterialsText, setClassMaterialsText] = useState("");
  const [classMaterialFiles, setClassMaterialFiles] = useState([]);
  const [extractingMaterials, setExtractingMaterials] = useState(false);
  const [professorGuidance, setProfessorGuidance] = useState("");
  const [sections, setSections] = useState([]);
  const syllabusRef = useRef(null);
  const materialsRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.user_metadata?.role !== "professor") { router.replace("/login"); return; }
      setUser(user);
      fetch(`/api/assignments?id=${assignmentId}`).then(r => r.json()).then(a => {
        if (a.professorId !== user.id) { router.replace("/dashboard"); return; }
        setCourseName(a.courseName || "");
        setAssignmentTitle(a.assignmentTitle || "");
        setTopics(a.topicsToCover?.length ? a.topicsToCover : [""]);
        setSyllabusText(a.syllabusText || "");
        setClassMaterialsText(a.classMaterialsText || "");
        setProfessorGuidance(a.professorGuidance || "");
        setSections(a.sections?.length ? a.sections : []);
        if (a.syllabusText) setSyllabusFile({ name: "Previously uploaded" });
        if (a.classMaterialsText) setClassMaterialFiles([{ name: "Previously uploaded materials" }]);
        setLoading(false);
      }).catch(() => { setLoading(false); });
    });
  }, [assignmentId, router]);

  async function handleSyllabus(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setSyllabusFile(file);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/extract", { method: "POST", body: fd });
    if (res.ok) { const d = await res.json(); setSyllabusText(d.text); }
  }

  async function handleMaterials(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setExtractingMaterials(true);
    setClassMaterialFiles(prev => [...prev, ...files]);
    let allText = classMaterialsText;
    for (const file of files) {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: fd });
      if (res.ok) { const d = await res.json(); allText += `\n\n--- ${file.name} ---\n${d.text}`; }
    }
    setClassMaterialsText(allText);
    setExtractingMaterials(false);
  }

  async function handleSave() {
    setSaving(true); setError(null);
    const filtered = topics.filter(c => c.trim());
    if (!courseName || !assignmentTitle || filtered.length === 0) {
      setError("Fill in course name, title, and at least one topic.");
      setSaving(false); return;
    }
    const res = await fetch("/api/assignments", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: assignmentId, courseName, assignmentTitle, topicsToCover: filtered, syllabusText, classMaterialsText, professorGuidance, sections: sections.filter(s => s.name?.trim()) }),
    });
    if (res.ok) { router.push(`/review/${assignmentId}`); }
    else { const d = await res.json(); setError(d.error || "Failed to save"); }
    setSaving(false);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-normal text-gray-900" style={{ fontFamily: "'Cardo', serif" }}>Veridia</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</span>
              <p className="text-gray-500 text-sm">· Edit Exam</p>
            </div>
          </div>
          <a href={`/review/${assignmentId}`} className="text-sm text-gray-400 hover:text-gray-600">← Back to Review</a>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Course Name</label>
            <input value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="e.g., POLS 301"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Exam Title</label>
            <input value={assignmentTitle} onChange={e => setAssignmentTitle(e.target.value)} placeholder="e.g., Midterm Oral — Political Theory"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Syllabus (optional)</label>
            <p className="text-xs text-gray-400 mb-2">Provides general course context.</p>
            {syllabusText && (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">
                <span className="text-green-600">✓</span>
                <span className="flex-1">Syllabus uploaded ({syllabusText.split(/\s+/).length} words)</span>
                <button type="button" onClick={() => { setSyllabusText(""); setSyllabusFile(null); }} className="text-xs text-red-400 hover:text-red-600">Remove</button>
              </div>
            )}
            <div onClick={() => syllabusRef.current?.click()} className="border border-gray-300 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-green-500 hover:bg-green-50">
              <input ref={syllabusRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleSyllabus} />
              <span className="text-sm text-gray-500">{syllabusText ? "Click to replace syllabus" : "Upload PDF, DOCX, or TXT"}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Class Materials</label>
            <p className="text-xs text-gray-400 mb-2">Upload slides, readings, lecture notes. These anchor the oral exam.</p>
            {classMaterialsText && (
              <div className="flex items-center gap-2 text-sm text-gray-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">
                <span className="text-green-600">✓</span>
                <span className="flex-1">Materials uploaded ({classMaterialsText.split(/\s+/).length} words)</span>
                <button type="button" onClick={() => { setClassMaterialsText(""); setClassMaterialFiles([]); }} className="text-xs text-red-400 hover:text-red-600">Remove all</button>
              </div>
            )}
            {classMaterialFiles.length > 0 && (
              <div className="mb-2 space-y-1">
                {classMaterialFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-green-600">✓</span>
                    <span className="flex-1">{f.name}</span>
                  </div>
                ))}
              </div>
            )}
            <div onClick={() => materialsRef.current?.click()}
              className="border border-gray-300 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-green-500 hover:bg-green-50">
              <input ref={materialsRef} type="file" accept=".pdf,.doc,.docx,.txt,.pptx" className="hidden" multiple onChange={handleMaterials} />
              {extractingMaterials ? (
                <div><div className="w-8 h-8 rounded-full bg-green-100 animate-pulse mx-auto mb-2" /><p className="text-sm text-gray-500">Reading materials...</p></div>
              ) : (
                <span className="text-sm text-gray-500">{classMaterialsText ? "Click to add more materials" : "Click to upload (multiple files allowed)"}</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Topics to Cover</label>
            <p className="text-xs text-gray-400 mb-2">The specific topics or concepts Veridia should question students on.</p>
            {topics.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <div className="flex items-center justify-center w-8 h-10 rounded-lg text-xs font-bold text-white shrink-0" style={{ backgroundColor: "#009B4D" }}>{i+1}</div>
                <input value={c} onChange={e => { const u = [...topics]; u[i] = e.target.value; setTopics(u); }} placeholder="e.g., Rawls's original position"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                {topics.length > 1 && <button onClick={() => setTopics(topics.filter((_, j) => j !== i))} className="px-3 text-gray-400 hover:text-red-500">✕</button>}
              </div>
            ))}
            <button onClick={() => setTopics([...topics, ""])} className="text-sm font-medium hover:underline" style={{ color: "#009B4D" }}>+ Add topic</button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Sections (optional)</label>
            <p className="text-xs text-gray-400 mb-2">Add sections and assign a TA email to each. TAs will only see their section's students.</p>
            {sections.map((s, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input value={s.name || ""} onChange={e => { const u = [...sections]; u[i] = {...u[i], name: e.target.value}; setSections(u); }} placeholder="e.g., Section 1"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                <input value={s.taEmail || ""} onChange={e => { const u = [...sections]; u[i] = {...u[i], taEmail: e.target.value}; setSections(u); }} placeholder="TA email (optional)"
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                <button onClick={() => setSections(sections.filter((_, j) => j !== i))} className="px-3 text-gray-400 hover:text-red-500">✕</button>
              </div>
            ))}
            <button onClick={() => setSections([...sections, {name: "", taEmail: ""}])} className="text-sm font-medium hover:underline" style={{ color: "#009B4D" }}>+ Add section</button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Conversation Guidance (optional)</label>
            <p className="text-xs text-gray-400 mb-2">Tell Veridia how you want it to probe your students.</p>
            <textarea value={professorGuidance} onChange={e => setProfessorGuidance(e.target.value)} rows={4}
              placeholder="How should Veridia approach the conversation with your students?"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none" />
          </div>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-3">
            <a href={`/review/${assignmentId}`} className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600 text-center">Cancel</a>
            <button onClick={handleSave} disabled={saving} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: "#009B4D" }}>
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

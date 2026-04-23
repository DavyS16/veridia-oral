"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();

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
  const [creating, setCreating] = useState(false);
  const [createdLink, setCreatedLink] = useState(null);
  const [createdId, setCreatedId] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const syllabusRef = useRef(null);
  const materialsRef = useRef(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.user_metadata?.role !== "professor") { router.replace("/login"); return; }
      setUser(user);
      loadAssignments(user.id);
    });
  }, [router]);

  async function loadAssignments(profId) {
    const res = await fetch(`/api/assignments?professorId=${profId}`);
    if (res.ok) setAssignments(await res.json());
  }

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
      if (res.ok) {
        const d = await res.json();
        allText += `\n\n--- ${file.name} ---\n${d.text}`;
      }
    }
    setClassMaterialsText(allText);
    setExtractingMaterials(false);
  }

  function removeMaterial(idx) {
    setClassMaterialFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    setCreating(true); setError(null);
    const filtered = topics.filter(c => c.trim());
    if (!courseName || !assignmentTitle || filtered.length === 0) {
      setError("Fill in course name, title, and at least one topic.");
      setCreating(false); return;
    }
    const res = await fetch("/api/assignments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseName, assignmentTitle, topicsToCover: filtered, syllabusText, classMaterialsText, professorGuidance, sections: sections.filter(s => s.name?.trim()), professorId: user.id }),
    });
    const data = await res.json();
    if (res.ok) { setCreatedLink(`${window.location.origin}${data.url}`); setCreatedId(data.id); loadAssignments(user.id); }
    else setError(data.error);
    setCreating(false);
  }

  function resetForm() {
    setShowForm(false); setCreatedLink(null); setCreatedId(null);
    setCourseName(""); setAssignmentTitle("");
    setTopics([""]); setSyllabusText(""); setSyllabusFile(null);
    setClassMaterialsText(""); setClassMaterialFiles([]); setProfessorGuidance(""); setSections([]);
  }

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!user) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div>;

  if (createdLink) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ backgroundColor: "#E8F5E9", color: "#009B4D" }}><span className="text-2xl">✓</span></div>
        <h1 className="text-3xl font-normal text-gray-900 mb-2" style={{ fontFamily: "'Cardo', serif" }}>Oral Exam Created</h1>
        <p className="text-gray-500 text-sm mb-8 text-center max-w-md">Share the student link. Open the review dashboard to see results.</p>
        <div className="w-full max-w-lg bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider">Student Link</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-2 overflow-x-auto">{createdLink}</code>
            <button onClick={() => { navigator.clipboard.writeText(createdLink); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg shrink-0" style={{ backgroundColor: "#009B4D" }}>{copied ? "Copied!" : "Copy"}</button>
          </div>
        </div>
        <div className="w-full max-w-lg border-2 rounded-xl p-4 mb-4" style={{ borderColor: "#009B4D", backgroundColor: "#F0FFF4" }}>
          <a href={`/review/${createdId}`} className="inline-block px-5 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ backgroundColor: "#009B4D" }}>Open Review Dashboard →</a>
        </div>
        <button onClick={resetForm} className="text-sm font-medium hover:underline" style={{ color: "#009B4D" }}>Back to dashboard</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-normal text-gray-900" style={{ fontFamily: "'Cardo', serif" }}>Veridia</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</span>
              <p className="text-gray-500 text-sm">· Welcome, {user.user_metadata?.full_name || user.email}</p>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>

        {assignments.length > 0 && !showForm && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Your Oral Exams</h2>
            <div className="space-y-3">
              {assignments.map(a => (
                <div key={a.id} className="flex items-center gap-2 p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  <a href={`/review/${a.id}`} className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{a.assignmentTitle}</div>
                    <div className="text-sm text-gray-500">{a.courseName} · {a.topicsToCover?.length || 0} topics</div>
                  </a>
                  <button onClick={async (e) => {
                    e.preventDefault();
                    if (!confirm(`Delete "${a.assignmentTitle}"? This will also delete all student submissions for this exam.`)) return;
                    await fetch(`/api/assignments?id=${a.id}`, { method: "DELETE" });
                    loadAssignments(user.id);
                  }} className="text-gray-300 hover:text-red-500 text-sm px-2 py-1 shrink-0" title="Delete exam">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showForm ? (
          <button onClick={() => setShowForm(true)} className="w-full py-4 rounded-xl text-white font-semibold text-base" style={{ backgroundColor: "#009B4D" }}>+ Create New Oral Exam</button>
        ) : (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">New Oral Exam</h2>

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
              <div onClick={() => syllabusRef.current?.click()} className="border border-gray-300 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-green-500 hover:bg-green-50">
                <input ref={syllabusRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleSyllabus} />
                {syllabusFile ? <span className="text-sm text-gray-700">✓ {syllabusFile.name}</span> : <span className="text-sm text-gray-500">Upload PDF, DOCX, or TXT</span>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Class Materials</label>
              <p className="text-xs text-gray-400 mb-2">Upload slides, readings, lecture notes, or handouts. These anchor the oral exam — Veridia will question students on this content.</p>
              <div onClick={() => materialsRef.current?.click()}
                className="border border-gray-300 border-dashed rounded-xl p-4 text-center cursor-pointer hover:border-green-500 hover:bg-green-50">
                <input ref={materialsRef} type="file" accept=".pdf,.doc,.docx,.txt,.pptx" className="hidden" multiple onChange={handleMaterials} />
                {extractingMaterials ? (
                  <div><div className="w-8 h-8 rounded-full bg-green-100 animate-pulse mx-auto mb-2" /><p className="text-sm text-gray-500">Reading materials...</p></div>
                ) : (
                  <span className="text-sm text-gray-500">Click to upload (multiple files allowed)</span>
                )}
              </div>
              {classMaterialFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {classMaterialFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-green-600">✓</span>
                      <span className="flex-1">{f.name}</span>
                      <button onClick={() => removeMaterial(i)} className="text-gray-400 hover:text-red-500 text-xs">Remove</button>
                    </div>
                  ))}
                  <p className="text-xs text-gray-400">{classMaterialFiles.length} file{classMaterialFiles.length > 1 ? "s" : ""} uploaded</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Topics to Cover</label>
              <p className="text-xs text-gray-400 mb-2">The specific topics or concepts Veridia should question students on during the 10-minute oral.</p>
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
              <p className="text-xs text-gray-400 mb-2">Tell Veridia how you want it to probe your students. For example: "Spend the first half on the foundational readings, then move to application questions. Push students to explain tensions between competing frameworks. If they give a textbook answer, ask them to apply it to a case not covered in class."</p>
              <textarea value={professorGuidance} onChange={e => setProfessorGuidance(e.target.value)} rows={4}
                placeholder="How should Veridia approach the conversation with your students?"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none" />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-600">Cancel</button>
              <button onClick={handleCreate} disabled={creating} className="flex-1 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: "#009B4D" }}>
                {creating ? "Creating..." : "Create Oral Exam"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

function formatTime(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }
function scoreColor(s) { return s >= 7 ? "#009B4D" : s >= 4 ? "#F57F17" : "#D32F2F"; }

function AnnotatedTranscript({ transcript, annotations }) {
  if (!transcript || transcript.length === 0) return <p className="text-sm text-gray-400">No transcript available.</p>;
  const aMap = {};
  if (annotations) annotations.forEach(a => { if (a.exchangeIndex !== undefined) aMap[a.exchangeIndex] = a; });
  return (
    <div className="space-y-4">
      {transcript.map((t, i) => {
        const ann = aMap[i]; const hasFlag = ann && ann.type;
        const isContra = ann?.type === "contradiction";
        const isIna = ann?.type === "inaccuracy";
        const isEva = ann?.type === "evasiveness";
        const bg = isIna ? "rgba(211,47,47,0.06)" : isContra ? "rgba(245,127,23,0.06)" : isEva ? "rgba(103,58,183,0.06)" : "transparent";
        const bc = isIna ? "#D32F2F" : isContra ? "#F57F17" : isEva ? "#7B1FA2" : "transparent";
        return (
          <div key={i}>
            <div className={`flex gap-3 ${t.role==="assistant"?"":"flex-row-reverse"}`}>
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <span className="text-xs text-gray-300 font-mono">{i}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${t.role==="assistant"?"":"bg-gray-700"}`}
                  style={t.role==="assistant"?{backgroundColor:"#009B4D"}:{}}>{t.role==="assistant"?"V":"S"}</div>
              </div>
              <div className="max-w-2xl">
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${t.role==="assistant"?"bg-white border border-gray-200 text-gray-700 rounded-tl-sm":"text-gray-900 rounded-tr-sm"}`}
                  style={t.role!=="assistant"?{backgroundColor:hasFlag?bg:"#F5F5F5",borderLeft:hasFlag?`3px solid ${bc}`:"none"}:{}}>{t.text}</div>
                {hasFlag && t.role!=="assistant" && (
                  <div className="mt-1.5 ml-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded" style={{
                        backgroundColor: isIna ? "rgba(211,47,47,0.1)" : isEva ? "rgba(103,58,183,0.1)" : "rgba(245,127,23,0.1)",
                        color: isIna ? "#D32F2F" : isEva ? "#7B1FA2" : "#F57F17"
                      }}>
                        {isIna ? "Inaccuracy" : isEva ? "Evasiveness" : "Contradiction"}</span>
                      {ann.confidence==="medium" && <span className="text-xs text-gray-400">(medium confidence)</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{ann.explanation}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Analytics({ submissions }) {
  const scored = submissions.filter(s => s.depthScore != null);
  if (scored.length === 0) return null;
  const scores = scored.map(s => s.professorScore ?? s.depthScore);
  const avg = (scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(1);
  const high = Math.max(...scores);
  const low = Math.min(...scores);
  const buckets = [0,0,0,0,0];
  scores.forEach(s => { if (s<=2) buckets[0]++; else if (s<=4) buckets[1]++; else if (s<=6) buckets[2]++; else if (s<=8) buckets[3]++; else buckets[4]++; });
  const maxBucket = Math.max(...buckets, 1);
  const labels = ["0-2","3-4","5-6","7-8","9-10"];
  const colors = ["#D32F2F","#E65100","#F57F17","#43A047","#009B4D"];

  return (
    <div className="bg-gray-50 rounded-xl p-5 mb-6">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-5">Class Overview</h3>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-2xl font-bold" style={{color:"#009B4D"}}>{avg}</div>
          <div className="text-xs text-gray-400 mt-0.5">Average</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{high}</div>
          <div className="text-xs text-gray-400 mt-0.5">Highest</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{low}</div>
          <div className="text-xs text-gray-400 mt-0.5">Lowest</div>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-800">{scored.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Scored</div>
        </div>
      </div>
      <div className="flex items-end gap-3 h-20">
        {buckets.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-gray-600">{b > 0 ? b : ""}</span>
            <div className="w-full rounded" style={{
              height: b > 0 ? `${Math.max((b/maxBucket)*48, 6)}px` : "2px",
              backgroundColor: b > 0 ? colors[i] : "#E5E5E5",
            }}/>
            <span className="text-xs text-gray-400">{labels[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 pt-4 border-t border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Score Guide</p>
        <div className="flex gap-0">
          {[
            {score:"0", color:"#D32F2F", label:"No understanding"},
            {score:"1-2", color:"#E65100", label:"Major gaps"},
            {score:"3-4", color:"#F57F17", label:"Significant gaps"},
            {score:"5-6", color:"#F9A825", label:"Partial understanding"},
            {score:"7-8", color:"#43A047", label:"Strong understanding"},
            {score:"9", color:"#009B4D", label:"Excellent"},
            {score:"10", color:"#006B3F", label:"Complete command"},
          ].map((s, i) => (
            <div key={i} className="flex-1 text-center">
              <p className="text-xs font-semibold text-gray-700 mt-2">{s.score}</p>
              <p className="text-xs text-gray-400 leading-tight mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const { id: assignmentId } = useParams();
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [editScores, setEditScores] = useState({});
  const [feedbackText, setFeedbackText] = useState({});
  const [saving, setSaving] = useState({});
  const [retrying, setRetrying] = useState({});
  const [sortBy, setSortBy] = useState("date");
  const [filterSection, setFilterSection] = useState("all");
  const [copiedLink, setCopiedLink] = useState(null);
  const [isTA, setIsTA] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || user.user_metadata?.role !== "professor") { router.replace("/login"); return; }
      fetch(`/api/assignments?id=${assignmentId}`).then(r => r.json()).then(a => {
        const isOwner = a.professorId === user.id;
        const userEmail = (user.email || "").toLowerCase().trim();
        const taSection = (a.sections || []).find(s => (s.taEmail || "").toLowerCase().trim() === userEmail);
        if (!isOwner && !taSection) { router.replace("/dashboard"); return; }
        setAssignment(a); setAuthed(true);
        if (taSection && !isOwner) setFilterSection(taSection.name);
        setIsTA(!isOwner && !!taSection);
        fetch(`/api/submissions?assignmentId=${assignmentId}`).then(r => r.json()).then(s => { setSubmissions(s); setLoading(false); });
      }).catch(() => { setLoading(false); });
    });
  }, [assignmentId, router]);

  useEffect(() => {
    if (!authed) return;
    const i = setInterval(async () => { const r = await fetch(`/api/submissions?assignmentId=${assignmentId}`); if (r.ok) setSubmissions(await r.json()); }, 8000);
    return () => clearInterval(i);
  }, [assignmentId, authed]);

  function getScore(idx) { if (editScores[idx] !== undefined) return editScores[idx]; return submissions[idx].professorScore ?? submissions[idx].depthScore ?? 0; }

  async function saveScores(idx) {
    const sub = submissions[idx]; setSaving(p => ({...p,[idx]:true}));
    await fetch("/api/submissions", { method: "PATCH", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ submissionId: sub.id, professorScore: getScore(idx), professorFeedback: feedbackText[idx] ?? sub.professorFeedback ?? "" }) });
    setSaving(p => ({...p,[idx]:false}));
    const r = await fetch(`/api/submissions?assignmentId=${assignmentId}`); if (r.ok) setSubmissions(await r.json());
  }

  async function releaseScores(idx) {
    await fetch("/api/submissions", { method: "PATCH", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ submissionId: submissions[idx].id, release: true }) });
    const r = await fetch(`/api/submissions?assignmentId=${assignmentId}`); if (r.ok) setSubmissions(await r.json());
  }

  async function retryScoring(idx) {
    const sub = submissions[idx]; setRetrying(p => ({...p,[idx]:true}));
    try {
      await fetch("/api/score", { method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          transcript: sub.transcript,
          assignmentTitle: assignment?.assignmentTitle,
          topicsToCover: assignment?.topicsToCover,
          classMaterialsText: assignment?.classMaterialsText,
          professorGuidance: assignment?.professorGuidance,
          submissionId: sub.id,
        }) });
    } catch (err) { console.error("Retry failed:", err); }
    setRetrying(p => ({...p,[idx]:false}));
    setTimeout(async () => { const r = await fetch(`/api/submissions?assignmentId=${assignmentId}`); if (r.ok) setSubmissions(await r.json()); }, 3000);
  }

  function getSorted() {
    let s = [...submissions];
    if (filterSection !== "all") s = s.filter(sub => sub.section === filterSection);
    if (sortBy === "score") s.sort((a,b) => (b.depthScore??-1) - (a.depthScore??-1));
    else if (sortBy === "name") s.sort((a,b) => (a.studentName||"").localeCompare(b.studentName||""));
    return s;
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div>;
  if (!assignment) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600 text-sm">Oral exam not found</p></div>;

  const sorted = getSorted();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-4xl font-normal text-gray-900" style={{fontFamily:"'Cardo',serif"}}>Veridia</h1>
            <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</span>
          </div>
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-600">← Dashboard</a>
        </div>
        <p className="text-gray-500 text-sm mb-6 mt-2">{isTA ? `TA Review — ${filterSection}` : "Professor Review"}</p>

        <div className="bg-gray-50 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{assignment.assignmentTitle}</h2>
              <p className="text-sm text-gray-500">{assignment.courseName}</p>
            </div>
            {!isTA && <a href={`/edit/${assignmentId}`} className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-white hover:text-gray-900 transition-colors">Edit Exam</a>}
          </div>
          <div className="flex items-center gap-6 mt-3">
            <div><span className="text-2xl font-bold" style={{color:"#009B4D"}}>{submissions.length}</span><span className="text-sm text-gray-500 ml-2">completed</span></div>
            <div><span className="text-2xl font-bold" style={{color:"#009B4D"}}>{submissions.filter(s=>s.scoresReleased).length}</span><span className="text-sm text-gray-500 ml-2">released</span></div>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0">Student Link</span>
            <code className="flex-1 text-sm text-gray-700 overflow-x-auto">{typeof window!=="undefined"?window.location.origin:""}/s/{assignmentId}</code>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/s/${assignmentId}`); setCopiedLink("student"); setTimeout(() => setCopiedLink(null), 2000); }}
              className="px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 border border-gray-300 text-gray-600 hover:bg-white">
              {copiedLink === "student" ? "✓ Copied" : "Copy"}
            </button>
          </div>
          {!isTA && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0">TA Link</span>
              <code className="flex-1 text-sm text-gray-700 overflow-x-auto">{typeof window!=="undefined"?window.location.origin:""}/review/{assignmentId}</code>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/review/${assignmentId}`); setCopiedLink("ta"); setTimeout(() => setCopiedLink(null), 2000); }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 border border-gray-300 text-gray-600 hover:bg-white">
                {copiedLink === "ta" ? "✓ Copied" : "Copy"}
              </button>
            </div>
          )}
        </div>

        {assignment.sections && assignment.sections.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-gray-400">Section:</span>
            {isTA ? (
              <span className="text-xs px-3 py-1 rounded-full bg-gray-200 text-gray-800">{filterSection}</span>
            ) : (
              <>
                <button onClick={() => setFilterSection("all")}
                  className={`text-xs px-3 py-1 rounded-full ${filterSection === "all" ? "bg-gray-200 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}>All</button>
                {assignment.sections.map(s => {
                  const name = s.name || s;
                  return (
                    <div key={name} className="flex items-center gap-1">
                      <button onClick={() => setFilterSection(name)}
                        className={`text-xs px-3 py-1 rounded-full ${filterSection === name ? "bg-gray-200 text-gray-800" : "text-gray-400 hover:text-gray-600"}`}>{name}</button>
                      {s.taEmail && (
                        <span className="text-xs text-gray-300" title={`TA: ${s.taEmail}`}>({s.taEmail.split("@")[0]})</span>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {submissions.length > 1 && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-400">Sort by:</span>
            {[{k:"date",l:"Date"},{k:"score",l:"Score"},{k:"name",l:"Name"}].map(s => (
              <button key={s.k} onClick={()=>setSortBy(s.k)}
                className={`text-xs px-3 py-1 rounded-full ${sortBy===s.k?"bg-gray-200 text-gray-800":"text-gray-400 hover:text-gray-600"}`}>{s.l}</button>
            ))}
          </div>
        )}

        <Analytics submissions={submissions} />

        {submissions.length === 0 && <div className="text-center py-16"><p className="text-gray-500 text-sm">No oral exams completed yet.</p></div>}

        <div className="space-y-4">
          {sorted.map((sub, idx) => {
            const realIdx = submissions.indexOf(sub);
            const isExp = expandedIdx === realIdx;
            const hasScore = sub.depthScore != null;
            const displayScore = getScore(realIdx);
            const color = scoreColor(displayScore);

            return (
              <div key={realIdx} className="border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={()=>setExpandedIdx(isExp?null:realIdx)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{backgroundColor:"#009B4D"}}>
                    {sub.studentName?.charAt(0)?.toUpperCase()||"?"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{sub.studentName}</span>
                      {sub.scoresReleased && <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full text-white bg-blue-500">Released</span>}
                    </div>
                    <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                      {sub.studentExtId && <span>ID: {sub.studentExtId}</span>}
                      {sub.section && <span>{sub.section}</span>}
                      <span>{formatTime(sub.durationSeconds)}</span>
                      <span>{sub.transcript?.length||0} exchanges</span>
                    </div>
                  </div>
                  {hasScore ? (
                    <div className="text-right shrink-0">
                      <div className="text-3xl font-bold" style={{color,fontFamily:"'Cardo',serif"}}>{displayScore}<span className="text-base text-gray-400 font-normal">/10</span></div>
                      <div className="text-xs text-gray-400">Depth Score</div>
                    </div>
                  ) : (
                    <div className="text-right shrink-0">
                      <div className="text-sm text-gray-400 animate-pulse">Scoring...</div>
                      <button onClick={(e)=>{e.stopPropagation();retryScoring(realIdx);}} disabled={retrying[realIdx]}
                        className="text-xs text-blue-500 hover:underline mt-1">{retrying[realIdx]?"Retrying...":"Retry"}</button>
                    </div>
                  )}
                  <span className="text-gray-400">{isExp?"▲":"▼"}</span>
                </button>

                {isExp && (
                  <div className="border-t border-gray-100">
                    {hasScore && (
                      <div className="bg-white px-5 py-5 border-b border-gray-100">
                        <div className="mb-6">
                          <div className="flex items-center gap-4 mb-3">
                            <div className="text-center">
                              <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">Depth Score</div>
                              <div className="text-5xl font-bold" style={{fontFamily:"'Cardo',serif",color:scoreColor(getScore(realIdx))}}>
                                {getScore(realIdx)}<span className="text-xl text-gray-400 font-normal">/10</span></div>
                            </div>
                            <div className="flex-1 ml-6">
                              <label className="text-xs text-gray-500 mb-1 block">Adjust score</label>
                              <div className="relative mt-2 mb-1">
                                <div className="absolute top-1/2 left-0 right-0 h-1 bg-gray-200 rounded-full -translate-y-1/2"/>
                                <input type="range" min={0} max={10} step={1} value={getScore(realIdx)}
                                  onChange={e=>setEditScores(p=>({...p,[realIdx]:Number(e.target.value)}))}
                                  className="relative w-full h-2 appearance-none cursor-pointer bg-transparent z-10" style={{accentColor:scoreColor(getScore(realIdx))}}/>
                              </div>
                              <div className="flex justify-between text-xs text-gray-400 mt-1 px-0.5">
                                {[0,1,2,3,4,5,6,7,8,9,10].map(n=>(<span key={n} className={`w-4 text-center ${getScore(realIdx)===n?'font-bold text-gray-700':''}`}>{n}</span>))}
                              </div>
                            </div>
                          </div>
                          {sub.depthScore!=null&&editScores[realIdx]!==undefined&&editScores[realIdx]!==sub.depthScore&&(
                            <p className="text-xs text-gray-400">AI suggested: {sub.depthScore}/10. You adjusted to: {getScore(realIdx)}/10.</p>)}
                        </div>

                        {sub.summary && (
                          <div className="mb-6 bg-gray-50 border-l-4 rounded-r-lg px-4 py-3" style={{borderLeftColor:"#009B4D"}}>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Summary</p>
                            <p className="text-sm text-gray-700 leading-relaxed">{sub.summary}</p>
                          </div>
                        )}

                        <div className="mb-6">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Annotated Transcript</h3>
                          <AnnotatedTranscript transcript={sub.transcript} annotations={sub.annotations}/>
                        </div>

                        <textarea placeholder="Add your notes (optional)" value={feedbackText[realIdx]??sub.professorFeedback??""}
                          onChange={e=>setFeedbackText(p=>({...p,[realIdx]:e.target.value}))}
                          rows={2} className="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"/>

                        <div className="flex gap-3">
                          <button onClick={()=>saveScores(realIdx)} disabled={saving[realIdx]}
                            className="px-5 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{backgroundColor:"#009B4D"}}>
                            {saving[realIdx]?"Saving...":"Save"}</button>
                          {!sub.scoresReleased?(
                            <button onClick={()=>releaseScores(realIdx)} className="px-5 py-2 text-sm font-semibold text-white rounded-lg bg-blue-500">Release to Student</button>
                          ):<span className="px-5 py-2 text-sm text-blue-600 font-semibold">✓ Released</span>}
                        </div>
                      </div>
                    )}
                    {!hasScore && (
                      <div className="bg-gray-50 px-5 py-5">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transcript (scoring in progress...)</h3>
                          <button onClick={()=>retryScoring(realIdx)} disabled={retrying[realIdx]}
                            className="text-xs font-medium text-blue-500 hover:underline">{retrying[realIdx]?"Retrying...":"Retry scoring"}</button>
                        </div>
                        <AnnotatedTranscript transcript={sub.transcript} annotations={null}/>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

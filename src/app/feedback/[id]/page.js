"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

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
            <div className={`flex gap-3 ${t.role === "assistant" ? "" : "flex-row-reverse"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${t.role === "assistant" ? "" : "bg-gray-700"}`}
                style={t.role === "assistant" ? { backgroundColor: "#009B4D" } : {}}>{t.role === "assistant" ? "V" : "You"}</div>
              <div className="max-w-2xl">
                <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${t.role === "assistant" ? "bg-white border border-gray-200 text-gray-700 rounded-tl-sm" : "text-gray-900 rounded-tr-sm"}`}
                  style={t.role !== "assistant" ? { backgroundColor: hasFlag ? bg : "#F5F5F5", borderLeft: hasFlag ? `3px solid ${bc}` : "none" } : {}}>{t.text}</div>
                {hasFlag && t.role !== "assistant" && (
                  <div className="mt-1.5 ml-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: isIna ? "rgba(211,47,47,0.1)" : isEva ? "rgba(103,58,183,0.1)" : "rgba(245,127,23,0.1)",
                          color: isIna ? "#D32F2F" : isEva ? "#7B1FA2" : "#F57F17"
                        }}>
                        {isIna ? "Inaccuracy" : isEva ? "Evasiveness" : "Contradiction"}</span>
                      {ann.confidence === "medium" && <span className="text-xs text-gray-400">(medium confidence)</span>}
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

export default function FeedbackPage() {
  const { id: userId } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace("/login"); return; }
      setUser(user);
      fetch(`/api/submissions?studentId=${user.id}`).then(r => r.json()).then(d => { setSubmissions(d); setLoading(false); });
    });
  }, [router, userId]);

  async function logout() { const supabase = createClient(); await supabase.auth.signOut(); router.push("/login"); }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-normal text-gray-900" style={{ fontFamily: "'Cardo', serif" }}>Veridia</h1>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</span>
              <p className="text-gray-500 text-sm">· Your Feedback</p>
            </div>
          </div>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
        </div>

        {submissions.length === 0 && (
          <div className="text-center py-16"><p className="text-gray-500 text-sm">Your professor has not yet released your oral exam feedback.</p></div>
        )}

        <div className="space-y-6">
          {submissions.map((sub, idx) => {
            const isExp = expandedIdx === idx;
            return (
              <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
                <button onClick={() => setExpandedIdx(isExp ? null : idx)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 text-left">
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{sub.assignment?.assignmentTitle || "Oral Exam"}</div>
                    <div className="text-sm text-gray-500">{sub.assignment?.courseName}</div>
                  </div>
                  <div className="text-sm text-gray-500">Feedback available</div>
                  <span className="text-gray-400">{isExp ? "▲" : "▼"}</span>
                </button>
                {isExp && (
                  <div className="border-t border-gray-100 px-5 py-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4" style={{ fontFamily: "'Cardo', serif" }}>Your Oral Exam</h3>
                    <AnnotatedTranscript transcript={sub.transcript} annotations={sub.annotations} />
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

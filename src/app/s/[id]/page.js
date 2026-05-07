"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Vapi from "@vapi-ai/web";

const VAPI_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
const ASSISTANT_ID = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

function formatTime(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`; }

export default function StudentPage() {
  const { id: assignmentId } = useParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [status, setStatus] = useState("loading");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [speaking, setSpeaking] = useState(null);
  const [volume, setVolume] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [error, setError] = useState(null);
  const [callError, setCallError] = useState(null);
  const [studentKey, setStudentKey] = useState("");
  const [studentPassword, setStudentPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [consent, setConsent] = useState(false);
  const [studentSection, setStudentSection] = useState("");

  const vapiRef = useRef(null);
  const timerRef = useRef(null);
  const transcriptRef = useRef([]);
  const startTimeRef = useRef(0);
  const savedRef = useRef(false);

  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && user.user_metadata?.role === "student") {
        setUser(user);
        setStudentKey(user.user_metadata?.student_key || "");
        setAuthed(true);
      }
    });
    fetch(`/api/assignments?id=${assignmentId}`)
      .then(r => r.ok ? r.json() : Promise.reject("Not found"))
      .then(d => { setAssignment(d); setStatus("auth"); })
      .catch(() => { setLoadErr("Oral exam not found."); setStatus("error"); });
    return () => {
      if (vapiRef.current) try { vapiRef.current.stop(); } catch(e) {}
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [assignmentId, router]);

  async function handleStudentAuth() {
    if (!studentKey.trim() || !studentPassword.trim()) { setAuthError("Enter your Assigned Student Key and password."); return; }
    if (!consent) { setAuthError("Please agree to the pilot participation terms."); return; }
    setAuthLoading(true); setAuthError(null);
    const fakeEmail = `${studentKey.trim().toLowerCase().replace(/\s+/g, "-")}@veridia.local`;
    const supabase = createClient();
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email: fakeEmail, password: studentPassword });
    if (signInData?.user) {
      setUser(signInData.user); setAuthed(true); setStatus("ready"); setAuthLoading(false); return;
    }
    if (signInErr) {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fakeEmail, password: studentPassword, fullName: studentKey.trim(), role: "student", studentKey: studentKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setAuthError(data.error || "Failed to create account."); setAuthLoading(false); return; }
      const { error: signIn2Err } = await supabase.auth.signInWithPassword({ email: fakeEmail, password: studentPassword });
      if (signIn2Err) { setAuthError(signIn2Err.message); setAuthLoading(false); return; }
      const { data: { user: newUser } } = await supabase.auth.getUser();
      setUser(newUser); setAuthed(true); setStatus("ready"); setAuthLoading(false); return;
    }
    setAuthLoading(false);
  }

  async function saveAndScore() {
    if (savedRef.current) return;
    savedRef.current = true;
    const t = transcriptRef.current; if (t.length === 0) return;
    const dur = Math.floor((Date.now() - startTimeRef.current) / 1000);
    try {
      const r = await fetch("/api/submissions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, studentName: studentKey, studentId: user?.id, studentExtId: studentKey, section: studentSection, transcript: t, durationSeconds: dur }),
      });
      const d = await r.json();
      if (d.id) {
        fetch("/api/score", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript: t,
            assignmentTitle: assignment?.assignmentTitle,
            topicsToCover: assignment?.topicsToCover,
            classMaterialsText: assignment?.classMaterialsText,
            professorGuidance: assignment?.professorGuidance,
            submissionId: d.id,
          }),
        }).catch(err => console.error("Scoring failed:", err));
      }
    } catch (err) { console.error("Save failed:", err); }
  }

  async function startCall() {
    if (vapiRef.current) return;
    setStatus("connecting"); setError(null); setCallError(null); setTranscript([]); setSeconds(0); savedRef.current = false;
    try {
      const vapi = new Vapi(VAPI_PUBLIC_KEY);
      vapiRef.current = vapi;
      vapi.on("call-start", () => { setStatus("active"); startTimeRef.current = Date.now(); const t0 = Date.now(); timerRef.current = setInterval(() => setSeconds(Math.floor((Date.now()-t0)/1000)), 1000); });
      vapi.on("call-end", () => {
        setStatus("ended");
        setSpeaking(null);
        if (timerRef.current) clearInterval(timerRef.current);
        vapiRef.current = null;
        saveAndScore();
      });
      vapi.on("speech-start", () => setSpeaking("assistant"));
      vapi.on("speech-end", () => setSpeaking(null));
      vapi.on("volume-level", v => setVolume(v));
      vapi.on("message", msg => { if (msg.type==="transcript"&&msg.transcriptType==="final") setTranscript(p=>[...p,{role:msg.role,text:msg.transcript}]); });
      vapi.on("error", err => {
        console.error("Vapi error:", err);
        const msg = err?.error?.message || err?.errorMsg || "";
        if (msg.includes("Meeting has ended") || msg.includes("ejected")) {
          setCallError("disconnected");
        }
      });

      const topicsList = (assignment.topicsToCover||[]).map((c,i)=>`${i+1}. ${c}`).join("\n");
      await vapi.start(ASSISTANT_ID, {
        variableValues: {
          studentName: studentKey||"there", studentId: studentKey,
          courseName: assignment.courseName, syllabusContext: (assignment.syllabusText||"").slice(0,4000),
          examTitle: assignment.assignmentTitle,
          topicsToCover: topicsList,
          classMaterials: (assignment.classMaterialsText||"").slice(0,8000),
          professorGuidance: assignment.professorGuidance||"",
        },
      });
    } catch (err) { setError("Failed to connect. Check your microphone permissions and try again."); setStatus("ready"); vapiRef.current = null; }
  }

  function endCall() {
    if (vapiRef.current) { try { vapiRef.current.stop(); } catch(e) {} vapiRef.current = null; }
    setStatus("ended"); setSpeaking(null); if (timerRef.current) clearInterval(timerRef.current); saveAndScore();
  }

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div>;
  if (status === "error") return <div className="min-h-screen flex flex-col items-center justify-center"><h1 className="text-2xl" style={{fontFamily:"'Cardo',serif"}}>Veridia</h1><p className="text-red-600 text-sm mt-2">{loadErr}</p></div>;

  if (alreadySubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <h1 className="text-5xl font-normal text-gray-900 mb-1" style={{fontFamily:"'Cardo',serif"}}>Veridia</h1>
        <p className="text-xs uppercase tracking-widest mb-6" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</p>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{backgroundColor:"#E8F5E9",color:"#009B4D"}}><span className="text-2xl">✓</span></div>
        <p className="text-gray-700 font-medium mb-2">You have already completed this oral exam.</p>
        <p className="text-gray-500 text-sm mb-6">Your professor will review your transcript and release feedback.</p>
        <a href={`/feedback/${user?.id}`} className="text-sm font-medium hover:underline" style={{color:"#009B4D"}}>Go to your feedback page →</a>
      </div>
    );
  }

  // AUTH — student enters key + password
  if (status === "auth" && !authed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <h1 className="text-5xl font-normal text-gray-900 mb-1" style={{fontFamily:"'Cardo',serif"}}>Veridia</h1>
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</p>
        {assignment && <p className="text-gray-500 text-sm mb-1">{assignment.courseName}</p>}
        {assignment && <p className="text-gray-900 font-medium mb-6">{assignment.assignmentTitle}</p>}
        <div className="w-full max-w-md space-y-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Assigned Student Key</label>
            <input type="text" placeholder="e.g., STU-001" value={studentKey} onChange={e=>setStudentKey(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <p className="text-xs text-gray-400 mb-1">First time? Choose a password. Returning? Use the same one.</p>
            <input type="password" placeholder="Min 6 characters" value={studentPassword} onChange={e=>setStudentPassword(e.target.value)} minLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
        </div>
        <div className="w-full max-w-md bg-gray-50 rounded-xl p-4 mb-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 shrink-0" />
            <span className="text-xs text-gray-600 leading-relaxed">
              I agree to participate in the Veridia pilot program. I understand that my oral exam conversation will be recorded and reviewed by my professor to assess my understanding of the course material. Veridia does not store personal data beyond what is needed to provide this service. I can request the deletion of my data at any time by emailing <a href="mailto:info@veridia.com" className="underline" style={{ color: "#009B4D" }}>info@veridia.com</a>.
            </span>
          </label>
        </div>
        {authError && <p className="text-red-600 text-sm mb-4 max-w-md">{authError}</p>}
        <button onClick={handleStudentAuth} disabled={authLoading}
          className="w-full max-w-md py-3 rounded-xl text-white font-semibold disabled:opacity-50" style={{backgroundColor:"#009B4D"}}>
          {authLoading ? "Signing in..." : "Continue"}
        </button>
      </div>
    );
  }

  // After auth, if section required, show section picker before "ready"
  if (status === "auth" && authed) { setStatus("ready"); }

  // READY — single "Ready to start the conversation" page
  if (status === "ready") {
    const needsSection = assignment.sections && assignment.sections.length > 0;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <h1 className="text-5xl font-normal text-gray-900 mb-1" style={{fontFamily:"'Cardo',serif"}}>Veridia</h1>
        <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</p>
        <p className="text-gray-500 text-sm mb-1">{assignment.courseName}</p>
        <p className="text-gray-900 font-medium mb-6">{assignment.assignmentTitle}</p>

        {needsSection && (
          <div className="w-full max-w-md mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Your Section</label>
            <select value={studentSection} onChange={e => setStudentSection(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white">
              <option value="">Select your section</option>
              {assignment.sections.map((s, i) => (
                <option key={i} value={s.name || s}>{s.name || s}</option>
              ))}
            </select>
          </div>
        )}

        {assignment.topicsToCover && assignment.topicsToCover.length > 0 && (
          <div className="w-full max-w-md bg-gray-50 rounded-xl p-4 mb-6 text-sm">
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Topics in this exam</p>
            {assignment.topicsToCover.map((c,i) => (
              <div key={i} className="flex items-start gap-2 mb-1">
                <span className="text-xs font-bold text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{backgroundColor:"#009B4D"}}>{i+1}</span>
                <span className="text-sm text-gray-700">{c}</span>
              </div>
            ))}
          </div>
        )}

        <div className="w-full max-w-md bg-gray-50 rounded-xl p-5 mb-6">
          <p className="text-sm font-semibold text-gray-800 mb-3">What to expect</p>
          <div className="space-y-2 text-sm text-gray-600">
            <p>You are about to have a 10-minute voice conversation with Veridia — your oral exam for this course.</p>
            <p>Veridia has the course material. It will ask you to explain, apply, and reason about the topics you've studied.</p>
            <p>This is a conversation, not a quiz. There are no trick questions. If you are unsure about something, say so.</p>
            <p>Your professor will review the full transcript afterwards.</p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">Before you start, make sure:</p>
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500">✓ You are in a quiet space</p>
              <p className="text-xs text-gray-500">✓ Your microphone is working</p>
              <p className="text-xs text-gray-500">✓ You can speak freely for 10 minutes</p>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm p-4 rounded-xl max-w-md mb-6 w-full">{error}</div>}
        <button onClick={() => {
          if (needsSection && !studentSection) {
            setError("Please select your section before continuing.");
            return;
          }
          setError(null);
          startCall();
        }} className="w-full max-w-md py-4 rounded-xl text-white font-semibold" style={{backgroundColor:"#009B4D"}}>
          Start Oral Exam
        </button>
      </div>
    );
  }

  if (status === "connecting") {
    return <div className="min-h-screen flex flex-col items-center justify-center"><div className="w-16 h-16 rounded-full bg-green-100 animate-pulse"/><p className="text-gray-500 text-sm mt-6">Connecting...</p></div>;
  }

  // ENDED
  if (status === "ended") {
    const wasDisconnected = callError === "disconnected" && transcriptRef.current.length < 4;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
          style={{backgroundColor: wasDisconnected ? "#FFF3E0" : "#E8F5E9", color: wasDisconnected ? "#F57F17" : "#009B4D"}}>
          <span className="text-2xl">{wasDisconnected ? "!" : "✓"}</span>
        </div>
        <h1 className="text-3xl font-normal text-gray-900 mb-2" style={{fontFamily:"'Cardo',serif"}}>
          {wasDisconnected ? "Connection Lost" : "Oral Exam Complete"}
        </h1>
        {wasDisconnected ? (
          <div className="max-w-md text-center">
            <p className="text-gray-600 text-sm mb-2">Your exam was interrupted before it could be completed.</p>
            <p className="text-gray-500 text-sm mb-6">If this was unexpected, please contact your professor to arrange another attempt.</p>
          </div>
        ) : (
          <div className="max-w-md text-center">
            <p className="text-gray-500 text-sm mb-2">Duration: {formatTime(seconds)}</p>
            <p className="text-gray-400 text-xs mb-8">Your professor will review the transcript and release your feedback.</p>
          </div>
        )}
        {transcript.length > 0 && !wasDisconnected && (
          <div className="bg-gray-50 rounded-xl p-5 max-w-2xl w-full max-h-96 overflow-y-auto">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Transcript</h2>
            <div className="space-y-3">{transcript.map((t,i) => (
              <div key={i}><span className="text-xs font-semibold" style={{color:t.role==="assistant"?"#009B4D":"#424242"}}>{t.role==="assistant"?"Veridia":studentKey||"Student"}</span><p className="text-sm text-gray-700">{t.text}</p></div>
            ))}</div>
          </div>
        )}
      </div>
    );
  }

  // ACTIVE
  const scale = 1 + volume * 0.3;
  const isA = speaking === "assistant";
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <span className="text-xl" style={{fontFamily:"'Cardo',serif"}}>Veridia</span>
          <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#009B4D", letterSpacing: "0.2em" }}>Oral Exam</span>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
        </div>
        <span className="text-sm text-gray-500 font-mono">{formatTime(seconds)}</span>
        <button onClick={endCall} className="px-4 py-1.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100">End</button>
      </div>
      <div className="text-center py-3"><span className="text-xs text-gray-400">{isA?"Veridia is speaking...":speaking==="user"?"Listening...":""}</span></div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center mb-12">
          <div className="absolute rounded-full transition-all duration-300" style={{width:180,height:180,background:isA?"radial-gradient(circle,rgba(0,155,77,0.12) 0%,transparent 70%)":"radial-gradient(circle,rgba(0,0,0,0.02) 0%,transparent 70%)",transform:`scale(${scale*1.4})`}}/>
          <div className="rounded-full flex items-center justify-center transition-all duration-200" style={{width:90,height:90,background:isA?"linear-gradient(135deg,#009B4D,#006B3F)":"#F5F5F5",transform:`scale(${scale})`,boxShadow:isA?"0 0 40px rgba(0,155,77,0.25)":"none"}}>
            <span className="text-sm font-medium" style={{color:isA?"#fff":"#999"}}>{isA?"V":speaking==="user"?"🎙":""}</span>
          </div>
        </div>
        <div className="w-full max-w-xl px-6 space-y-2 max-h-48 overflow-y-auto">
          {transcript.slice(-4).map((t,i) => (<div key={i} className={`flex ${t.role==="assistant"?"":"justify-end"}`}><div className={`max-w-sm px-4 py-2 rounded-2xl text-sm ${t.role==="assistant"?"bg-gray-100 text-gray-700 rounded-tl-sm":"bg-green-50 text-gray-800 rounded-tr-sm"}`}>{t.text}</div></div>))}
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, CheckCircle2, CircleX, FileUp, Filter, Search, Upload, X } from "lucide-react";
import "./question-bank.css";

const CORE_SUBJECTS = [
  "Bangla 1st Paper", "Bangla 2nd Paper", "English 1st Paper", "English 2nd Paper",
  "Mathematics", "Higher Mathematics", "ICT",
  "Bangladesh and Global Studies", "Religion and Moral Education",
  "Physics", "Chemistry", "Biology"
];

const EMPTY_FILTERS = { board: "All boards", year: "All years", subject: "All subjects", type: "All types", chapter: "", topic: "" };

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (c === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (c === '"') quoted = !quoted;
    else if (c === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && next === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(v => v.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some(v => v.trim())) rows.push(row);
  if (!rows.length) return [];
  const headers = rows.shift().map(v => v.trim());
  return rows.map(values => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""])));
}

function normaliseRow(row) {
  let options = row.options || "";
  if (options) {
    try { options = JSON.parse(options); }
    catch { throw new Error(`Invalid options JSON in question: ${(row.question_text || "").slice(0, 55)}`); }
  } else options = null;
  const numberOrNull = value => value === "" || value == null ? null : Number(value);
  return {
    board: row.board || null,
    year: numberOrNull(row.year),
    subject: row.subject?.trim(),
    chapter: row.chapter?.trim() || null,
    topic: row.topic?.trim() || null,
    paper: row.paper?.trim() || null,
    exam_type: row.exam_type?.trim() || "Board",
    question_type: (row.question_type || "mcq").toLowerCase(),
    question_text: row.question_text?.trim(),
    options,
    correct_answer: row.correct_answer?.trim() || null,
    explanation_bn: row.explanation_bn?.trim() || null,
    explanation_en: row.explanation_en?.trim() || null,
    model_answer_bn: row.model_answer_bn?.trim() || null,
    model_answer_en: row.model_answer_en?.trim() || null,
    marks: numberOrNull(row.marks),
    source_title: row.source_title?.trim() || null,
    source_url: row.source_url?.trim() || null,
    rights_status: row.rights_status?.trim() || "unverified",
    status: "published"
  };
}

export default function QuestionBank({ supabase, session, admin = false }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [search, setSearch] = useState("");
  const [revealed, setRevealed] = useState({});
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [language, setLanguage] = useState("bn");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState("");
  const fileRef = useRef(null);

  async function loadQuestions() {
    setLoading(true);
    let all = [], from = 0, error = null;
    while (true) {
      const result = await supabase.from("ssc_questions")
        .select("*").eq("status", "published")
        .order("subject").order("year", { ascending: false })
        .range(from, from + 999);
      if (result.error) { error = result.error; break; }
      all = all.concat(result.data || []);
      if (!result.data || result.data.length < 1000) break;
      from += 1000;
    }
    if (error) setNotice(error.message);
    setQuestions(all);
    setLoading(false);
  }

  useEffect(() => { loadQuestions(); }, []);

  const boards = useMemo(() => [...new Set(questions.map(q => q.board).filter(Boolean))].sort(), [questions]);
  const years = useMemo(() => [...new Set(questions.map(q => q.year).filter(Boolean))].sort((a,b) => b-a), [questions]);
  const subjects = useMemo(() => [...new Set([...CORE_SUBJECTS, ...questions.map(q => q.subject).filter(Boolean)])].sort(), [questions]);

  const visible = useMemo(() => questions.filter(q => {
    const haystack = [q.question_text, q.chapter, q.topic, q.subject, q.paper, q.explanation_bn, q.explanation_en].join(" ").toLowerCase();
    return (filters.board === "All boards" || q.board === filters.board)
      && (filters.year === "All years" || String(q.year) === filters.year)
      && (filters.subject === "All subjects" || q.subject === filters.subject)
      && (filters.type === "All types" || q.question_type === filters.type)
      && (!filters.chapter || (q.chapter || "").toLowerCase().includes(filters.chapter.toLowerCase()))
      && (!filters.topic || (q.topic || "").toLowerCase().includes(filters.topic.toLowerCase()))
      && (!search.trim() || haystack.includes(search.trim().toLowerCase()));
  }), [questions, filters, search]);

  function updateFilter(key, value) { setFilters(old => ({ ...old, [key]: value })); }

  async function recordAttempt(question, selected, isCorrect, responseText = null) {
    if (!session?.user?.id) return;
    const { error } = await supabase.from("ssc_question_attempts").insert({
      user_id: session.user.id,
      question_id: question.id,
      selected_answer: selected,
      response_text: responseText,
      is_correct: isCorrect
    });
    if (error) setNotice(`Your answer was shown, but attempt could not be saved: ${error.message}`);
  }

  async function chooseOption(question, optionKey) {
    if (feedback[question.id]) return;
    const correct = String(question.correct_answer || "").trim().toUpperCase();
    const isCorrect = optionKey.toUpperCase() === correct || String(question.options?.[optionKey] || "").trim() === String(question.correct_answer || "").trim();
    setAnswers(old => ({ ...old, [question.id]: optionKey }));
    setFeedback(old => ({ ...old, [question.id]: isCorrect ? "correct" : "incorrect" }));
    setRevealed(old => ({ ...old, [question.id]: true }));
    await recordAttempt(question, optionKey, isCorrect);
  }

  async function submitCQ(question) {
    const response = (answers[question.id] || "").trim();
    if (!response) return setNotice("Write your answer first.");
    setRevealed(old => ({ ...old, [question.id]: true }));
    await recordAttempt(question, null, null, response);
  }

  async function importCSV(file) {
    if (!file || !admin) return;
    setImporting(true); setImportReport("");
    try {
      const parsed = parseCSV(await file.text());
      if (!parsed.length) throw new Error("The CSV file is empty.");
      const rows = parsed.map(normaliseRow);
      const required = ["subject", "question_text", "question_type"];
      rows.forEach((r, i) => required.forEach(k => { if (!r[k]) throw new Error(`Row ${i + 2}: missing ${k}.`); }));
      rows.forEach((r, i) => {
        if (!["mcq", "cq", "short"].includes(r.question_type)) throw new Error(`Row ${i + 2}: question_type must be mcq, cq or short.`);
        if (r.question_type === "mcq" && (!r.options || !r.correct_answer)) throw new Error(`Row ${i + 2}: MCQ needs options JSON and correct_answer.`);
      });
      let imported = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const batch = rows.slice(i, i + 200);
        const { error } = await supabase.from("ssc_questions").insert(batch);
        if (error) throw new Error(`Imported ${imported} rows before failure: ${error.message}`);
        imported += batch.length;
        setImportReport(`Importing… ${imported} / ${rows.length}`);
      }
      setImportReport(`${imported} questions imported and published.`);
      await loadQuestions();
    } catch (error) { setImportReport(`Import failed: ${error.message}`); }
    finally { setImporting(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  const text = (bn, en) => language === "bn" ? (bn || en || "ব্যাখ্যা এখনো যোগ করা হয়নি।") : (en || bn || "No explanation has been added yet.");

  return <div className="qb-page">
    <div className="qb-heading">
      <div><div className="qb-eyebrow">UNBLINDED LEARN / SSC</div><h1>Question Bank</h1>
        <p>Board questions, practice sets and chapter-wise preparation — all in one place.</p></div>
      <div className="qb-language"><button className={language === "bn" ? "active" : ""} onClick={() => setLanguage("bn")}>বাংলা</button><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>English</button></div>
    </div>

    <div className="qb-stats"><div><strong>{questions.length}</strong><span>Published questions</span></div><div><strong>{subjects.length}</strong><span>Subjects supported</span></div><div><strong>{boards.length}</strong><span>Boards represented</span></div></div>

    <section className="qb-filter-panel">
      <div className="qb-search"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a question, topic or chapter..."/></div>
      <div className="qb-filters">
        <label>Board<select value={filters.board} onChange={e => updateFilter("board", e.target.value)}><option>All boards</option>{boards.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Year<select value={filters.year} onChange={e => updateFilter("year", e.target.value)}><option>All years</option>{years.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Subject<select value={filters.subject} onChange={e => updateFilter("subject", e.target.value)}><option>All subjects</option>{subjects.map(v => <option key={v}>{v}</option>)}</select></label>
        <label>Question type<select value={filters.type} onChange={e => updateFilter("type", e.target.value)}><option>All types</option><option value="mcq">MCQ</option><option value="cq">Creative (CQ)</option><option value="short">Short answer</option></select></label>
        <label>Chapter<input value={filters.chapter} onChange={e => updateFilter("chapter", e.target.value)} placeholder="Any chapter"/></label>
        <label>Sub-chapter / Topic<input value={filters.topic} onChange={e => updateFilter("topic", e.target.value)} placeholder="Any topic"/></label>
      </div>
      <div className="qb-filter-foot"><span><Filter size={14}/> {visible.length} results</span><button onClick={() => { setFilters(EMPTY_FILTERS); setSearch(""); }}>Clear filters</button></div>
    </section>

    {admin && <section className="qb-import">
      <div className="qb-import-copy"><div className="qb-import-icon"><FileUp size={19}/></div><div><h3>Admin · Bulk CSV import</h3><p>Upload prepared questions. Imported rows are published immediately.</p></div></div>
      <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => importCSV(e.target.files?.[0])}/>
      <button className="qb-import-button" disabled={importing} onClick={() => fileRef.current?.click()}><Upload size={16}/>{importing ? "Importing..." : "Choose CSV"}</button>
      {importReport && <p className="qb-import-report">{importReport}</p>}
    </section>}

    {loading ? <div className="qb-empty">Loading the question bank…</div> : !visible.length ? <div className="qb-empty"><BookOpen size={28}/><h3>No questions match these filters yet.</h3><p>Try clearing a filter, or ask an administrator to import a question set.</p></div> :
      <div className="qb-list">{visible.map((q, index) => {
        const opts = q.options && typeof q.options === "object" ? q.options : {};
        const isCQ = q.question_type === "cq" || q.question_type === "short";
        return <article className="qb-question" key={q.id}>
          <div className="qb-question-meta"><span>{q.subject}</span>{q.chapter && <span>{q.chapter}</span>}{q.topic && <span>{q.topic}</span>}{q.board && <span>{q.board} Board</span>}{q.year && <span>{q.year}</span>}<span>{q.exam_type || "Practice"}</span><span>{isCQ ? "CQ / Written" : "MCQ"}</span></div>
          <div className="qb-question-title"><span>Q{index + 1}</span><h3>{q.question_text}</h3></div>
          {q.paper && <div className="qb-paper">{q.paper}{q.marks ? ` · ${q.marks} marks` : ""}</div>}
          {!isCQ ? <div className="qb-options">{Object.entries(opts).map(([key, value]) => {
            const chosen = answers[q.id] === key;
            const correct = String(q.correct_answer || "").toUpperCase() === key.toUpperCase() || String(q.correct_answer || "") === String(value);
            let cls = chosen ? (feedback[q.id] === "correct" ? "chosen correct" : "chosen incorrect") : "";
            if (revealed[q.id] && correct) cls = "correct";
            return <button key={key} disabled={!!feedback[q.id]} className={`qb-option ${cls}`} onClick={() => chooseOption(q, key)}><b>{key}</b><span>{String(value)}</span>{revealed[q.id] && correct && <CheckCircle2 size={17} />}{chosen && feedback[q.id] === "incorrect" && <CircleX size={17}/>}</button>;
          })}</div> : <div className="qb-cq-response"><label htmlFor={`cq-${q.id}`}>Your answer</label><textarea id={`cq-${q.id}`} value={answers[q.id] || ""} onChange={e => setAnswers(old => ({ ...old, [q.id]: e.target.value }))} placeholder="Write your answer here…" disabled={!!revealed[q.id]}/><button className="qb-reveal" onClick={() => submitCQ(q)} disabled={!!revealed[q.id]}>Submit answer & reveal model answer</button></div>}
          {revealed[q.id] && <div className={`qb-explanation ${feedback[q.id] || "revealed"}`}>
            {!isCQ && <strong>{feedback[q.id] === "correct" ? "সঠিক উত্তর! / Correct answer" : "ভুল উত্তর — আবার শিখে নাও / Review the answer"}</strong>}
            {q.correct_answer && !isCQ && <p><b>Answer:</b> {q.correct_answer}{opts[q.correct_answer] ? ` — ${opts[q.correct_answer]}` : ""}</p>}
            {(q.explanation_bn || q.explanation_en) && <p>{text(q.explanation_bn, q.explanation_en)}</p>}
            {(q.model_answer_bn || q.model_answer_en) && <div className="qb-model-answer"><b>{language === "bn" ? "নমুনা উত্তর" : "Model answer"}</b><p>{text(q.model_answer_bn, q.model_answer_en)}</p></div>}
          </div>}
          {!revealed[q.id] && <button className="qb-explain-link" onClick={() => setRevealed(old => ({ ...old, [q.id]: true }))}>Show explanation / answer</button>}
        </article>;
      })}</div>}
    <p className="qb-disclaimer">Question sets are being added progressively. Board papers and third-party test papers should only be published where reuse is permitted or permission has been obtained. Original practice questions can be added at any time.</p>
  </div>;
}

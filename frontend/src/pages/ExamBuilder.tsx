import { FormEvent, useEffect, useMemo, useState } from "react";
import { Code2, FilePlus2, ListChecks, Plus, Save, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import AlertBanner from "../components/AlertBanner";
import type { Exam, Question, QuestionType } from "../types";

const emptyQuestion = {
  type: "mcq" as QuestionType,
  prompt: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_ans: "A",
  marks: 1,
  language: "python",
  boilerplate: "def solve():\n    pass\n\nsolve()",
};

export default function ExamBuilder() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState<Partial<Exam>>({ title: "", description: "", duration_min: 60, is_active: true });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [question, setQuestion] = useState({ ...emptyQuestion });
  const [testCases, setTestCases] = useState([{ input: "5", expected_output: "120" }]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const activeExamId = examId || exam.id;

  useEffect(() => {
    if (!examId) return;
    api.get<Exam>(`/admin/exams/${examId}`).then(({ data }) => {
      setExam(data);
      setQuestions(data.questions || []);
    });
  }, [examId]);

  const totals = useMemo(() => questions.reduce((sum, item) => sum + (item.marks || 0), 0), [questions]);

  const saveExam = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      if (activeExamId) {
        const { data } = await api.put<Exam>(`/admin/exams/${activeExamId}`, exam);
        setExam(data);
      } else {
        const { data } = await api.post<Exam>("/admin/exams", exam);
        setExam(data);
        navigate(`/admin/exams/${data.id}/builder`, { replace: true });
      }
      setMessage("Exam saved");
    } finally {
      setSaving(false);
    }
  };

  const saveQuestion = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeExamId) {
      setMessage("Save the exam before adding questions");
      return;
    }
    const payload = {
      ...question,
      test_cases: question.type === "coding" ? testCases : [],
      language: question.type === "coding" ? question.language : undefined,
      boilerplate: question.type === "coding" ? question.boilerplate : undefined,
      option_a: question.type === "mcq" ? question.option_a : undefined,
      option_b: question.type === "mcq" ? question.option_b : undefined,
      option_c: question.type === "mcq" ? question.option_c : undefined,
      option_d: question.type === "mcq" ? question.option_d : undefined,
      correct_ans: question.type === "mcq" ? question.correct_ans : undefined,
    };
    const endpoint = editingId ? `/admin/questions/${editingId}` : `/admin/exams/${activeExamId}/questions`;
    const method = editingId ? api.put<Question> : api.post<Question>;
    const { data } = await method(endpoint, payload);
    setQuestions((current) => (editingId ? current.map((item) => (item.id === editingId ? data : item)) : [...current, data]));
    setQuestion({ ...emptyQuestion });
    setTestCases([{ input: "", expected_output: "" }]);
    setEditingId(null);
    setMessage("Question saved");
  };

  const editQuestion = (item: Question) => {
    setEditingId(item.id);
    setQuestion({
      type: item.type,
      prompt: item.prompt,
      option_a: item.option_a || "",
      option_b: item.option_b || "",
      option_c: item.option_c || "",
      option_d: item.option_d || "",
      correct_ans: item.correct_ans || "A",
      marks: item.marks || 1,
      language: item.language || "python",
      boilerplate: item.boilerplate || "",
    });
    setTestCases(item.test_cases?.length ? item.test_cases.map((tc) => ({ input: tc.input || "", expected_output: tc.expected_output || "" })) : [{ input: "", expected_output: "" }]);
  };

  const deleteQuestion = async (id: string) => {
    await api.delete(`/admin/questions/${id}`);
    setQuestions((current) => current.filter((item) => item.id !== id));
  };

  return (
    <section className="grid gap-6 lg:grid-cols-[390px_1fr]">
      <div className="space-y-6">
        <form onSubmit={saveExam} className="panel p-5">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-mint text-ink">
              <FilePlus2 size={20} />
            </span>
            <div>
              <h1 className="text-xl font-bold">Exam Details</h1>
              <p className="text-sm text-slate-400">{activeExamId ? "Update assessment" : "Create assessment"}</p>
            </div>
          </div>
          {message ? <AlertBanner tone={message.includes("before") ? "warning" : "success"} message={message} onClose={() => setMessage("")} /> : null}
          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="label">Title</span>
              <input className="field" value={exam.title || ""} onChange={(event) => setExam({ ...exam, title: event.target.value })} required />
            </label>
            <label className="block space-y-2">
              <span className="label">Description</span>
              <textarea className="field min-h-24" value={exam.description || ""} onChange={(event) => setExam({ ...exam, description: event.target.value })} />
            </label>
            <label className="block space-y-2">
              <span className="label">Duration</span>
              <input className="field" type="number" min={1} value={exam.duration_min || 60} onChange={(event) => setExam({ ...exam, duration_min: Number(event.target.value) })} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-line bg-slate-900 px-3 py-3 text-sm">
              <span>Active exam</span>
              <input type="checkbox" checked={Boolean(exam.is_active)} onChange={(event) => setExam({ ...exam, is_active: event.target.checked })} />
            </label>
            <button className="btn-primary w-full" disabled={saving}>
              <Save size={18} />
              {saving ? "Saving" : "Save Exam"}
            </button>
          </div>
        </form>

        <div className="panel p-5">
          <div className="text-sm text-slate-400">Total marks</div>
          <div className="mt-2 text-4xl font-bold">{totals}</div>
          {activeExamId ? (
            <Link to={`/admin/exams/${activeExamId}/invites`} className="btn-secondary mt-5 w-full">
              Generate Invite Codes
            </Link>
          ) : null}
        </div>
      </div>

      <div className="space-y-6">
        <form onSubmit={saveQuestion} className="panel p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Question Builder</h2>
              <p className="text-sm text-slate-400">MCQ and coding questions in one exam</p>
            </div>
            <div className="flex rounded-lg border border-line bg-slate-900 p-1">
              {(["mcq", "coding"] as QuestionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={question.type === type ? "tab-button tab-button-active" : "tab-button"}
                  onClick={() => setQuestion({ ...question, type })}
                >
                  {type === "mcq" ? <ListChecks size={16} className="inline" /> : <Code2 size={16} className="inline" />} {type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <label className="block space-y-2">
              <span className="label">Prompt</span>
              <textarea className="field min-h-28" value={question.prompt} onChange={(event) => setQuestion({ ...question, prompt: event.target.value })} required />
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="label">Marks</span>
                <input className="field" type="number" min={1} value={question.marks} onChange={(event) => setQuestion({ ...question, marks: Number(event.target.value) })} />
              </label>
              {question.type === "coding" ? (
                <label className="block space-y-2">
                  <span className="label">Language</span>
                  <select className="field" value={question.language} onChange={(event) => setQuestion({ ...question, language: event.target.value })}>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                  </select>
                </label>
              ) : (
                <label className="block space-y-2">
                  <span className="label">Correct Answer</span>
                  <select className="field" value={question.correct_ans} onChange={(event) => setQuestion({ ...question, correct_ans: event.target.value })}>
                    {["A", "B", "C", "D"].map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {question.type === "mcq" ? (
              <div className="grid gap-3 md:grid-cols-2">
                {(["A", "B", "C", "D"] as const).map((key) => (
                  <label key={key} className="block space-y-2">
                    <span className="label">Option {key}</span>
                    <input
                      className="field"
                      value={question[`option_${key.toLowerCase()}` as "option_a"]}
                      onChange={(event) => setQuestion({ ...question, [`option_${key.toLowerCase()}`]: event.target.value })}
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block space-y-2">
                  <span className="label">Boilerplate</span>
                  <textarea className="field min-h-40 font-mono" value={question.boilerplate} onChange={(event) => setQuestion({ ...question, boilerplate: event.target.value })} />
                </label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="label">Test Cases</span>
                    <button type="button" className="btn-secondary" onClick={() => setTestCases([...testCases, { input: "", expected_output: "" }])}>
                      <Plus size={16} />
                      Add Case
                    </button>
                  </div>
                  {testCases.map((testCase, index) => (
                    <div key={index} className="grid gap-3 rounded-lg border border-line bg-slate-900 p-3 md:grid-cols-[1fr_1fr_40px]">
                      <input className="field" value={testCase.input} onChange={(event) => setTestCases(testCases.map((tc, i) => (i === index ? { ...tc, input: event.target.value } : tc)))} placeholder="Input" />
                      <input className="field" value={testCase.expected_output} onChange={(event) => setTestCases(testCases.map((tc, i) => (i === index ? { ...tc, expected_output: event.target.value } : tc)))} placeholder="Expected output" />
                      <button type="button" className="icon-btn" onClick={() => setTestCases(testCases.filter((_, i) => i !== index))} aria-label="Remove test case">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button className="btn-primary">
              <Save size={18} />
              {editingId ? "Update Question" : "Add Question"}
            </button>
          </div>
        </form>

        <div className="panel p-5">
          <h2 className="text-xl font-bold">Question Set</h2>
          <div className="mt-4 space-y-3">
            {questions.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-line bg-slate-900 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-400">
                      Q{index + 1} - {item.type} - {item.marks} marks
                    </div>
                    <div className="mt-1 font-semibold">{item.prompt}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary" type="button" onClick={() => editQuestion(item)}>
                      Edit
                    </button>
                    <button className="icon-btn" type="button" onClick={() => deleteQuestion(item.id)} aria-label="Delete question">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!questions.length ? <div className="rounded-lg border border-line bg-slate-900 p-5 text-sm text-slate-400">No questions added.</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

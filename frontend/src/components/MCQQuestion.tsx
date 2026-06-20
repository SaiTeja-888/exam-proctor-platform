import { Check } from "lucide-react";
import type { Question } from "../types";

interface MCQQuestionProps {
  question: Question;
  value?: string;
  onChange: (value: string) => void;
}

export default function MCQQuestion({ question, value, onChange }: MCQQuestionProps) {
  const options = [
    ["A", question.option_a],
    ["B", question.option_b],
    ["C", question.option_c],
    ["D", question.option_d],
  ].filter(([, label]) => Boolean(label));

  return (
    <div className="space-y-3">
      {options.map(([key, label]) => {
        const selected = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key || "")}
            className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition ${
              selected ? "border-mint bg-mint/10 text-white" : "border-line bg-slate-900/70 text-slate-200 hover:border-signal"
            }`}
          >
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${selected ? "border-mint bg-mint text-ink" : "border-line"}`}>
              {selected ? <Check size={16} /> : key}
            </span>
            <span className="text-sm font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

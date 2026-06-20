import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  language: string;
  value: string;
  onChange: (value: string) => void;
}

export default function CodeEditor({ language, value, onChange }: CodeEditorProps) {
  const monacoLanguage = language === "cpp" ? "cpp" : language === "javascript" ? "javascript" : language;
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <Editor
        height="360px"
        language={monacoLanguage}
        value={value}
        theme="vs-dark"
        onChange={(next) => onChange(next || "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbersMinChars: 3,
          padding: { top: 14, bottom: 14 },
          scrollBeyondLastLine: false,
          wordWrap: "on",
        }}
      />
    </div>
  );
}

import { useNavigate } from "react-router-dom";

/** Restored entry; full editor body follows in subsequent commit. */
export function GraphicsEditor() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0f172a] text-[#e2e8f0] p-8">
      <button type="button" onClick={() => navigate(-1)} className="mb-4 text-sm underline">
        Back
      </button>
      <h1 className="text-xl font-semibold">Graphics Editor</h1>
      <p className="mt-2 text-sm text-[#94a3b8]">Graphics editor</p>
    </div>
  );
}

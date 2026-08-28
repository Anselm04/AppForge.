import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SeniorDevPanel } from "./AIBuilderSeniorDev.js";

export function AIBuilder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = parseInt(searchParams.get("projectId") ?? "0", 10);
  const mode = searchParams.get("mode");

  useEffect(() => {
    if (mode === "build" || !projectId) {
      navigate("/", { replace: true });
    }
  }, [mode, projectId, navigate]);

  if (!projectId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h1 className="text-2xl font-bold text-gray-900">Senior Dev Agent</h1>
        <p className="text-sm text-gray-500 mt-1">
          Improve an existing project. To start a new app, use the{" "}
          <button
            type="button"
            className="text-blue-600 hover:underline"
            onClick={() => navigate("/")}
          >
            home page
          </button>
          .
        </p>
      </div>
      <div className="flex-1 max-w-4xl w-full mx-auto">
        <SeniorDevPanel projectId={projectId} />
      </div>
    </div>
  );
}

export default AIBuilder;

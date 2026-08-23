import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TopNav } from "./components/TopNav.js";
import { Home } from "./pages/Home.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Build } from "./pages/Build.js";
import { Pricing } from "./pages/Pricing.js";
import { Admin } from "./pages/Admin.js";
import { AIBuilder } from "./pages/AIBuilder.js";
import { GraphicsEditor } from "./pages/GraphicsEditor.js";

export default function App() {
  return (
    <BrowserRouter>
      <TopNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/build/:projectId" element={<Build />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/ai-builder" element={<AIBuilder />} />
        <Route path="/editor" element={<GraphicsEditor />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

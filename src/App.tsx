import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { TopNav } from "./components/TopNav";
import { Home } from "./pages/Home";
import { Dashboard } from "./pages/Dashboard";
import { Build } from "./pages/Build";
import { Pricing } from "./pages/Pricing";
import { queryClient } from "./utils/queryClient";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TopNav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/build/:projectId" element={<Build />} />
          <Route path="/pricing" element={<Pricing />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

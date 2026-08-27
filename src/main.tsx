import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils/queryClient.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { LocaleProvider } from "./i18n/LocaleContext.js";
import App from "./App.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  \u003cReact.StrictMode\u003e
    \u003cQueryClientProvider client={queryClient}\u003e
      \u003cLocaleProvider\u003e
        \u003cErrorBoundary\u003e
          \u003cApp /\u003e
        \u003c/ErrorBoundary\u003e
      \u003c/LocaleProvider\u003e
    \u003c/QueryClientProvider\u003e
  \u003c/React.StrictMode\u003e
);

import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./utils/queryClient.js";
import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { LocaleProvider } from "./i18n/LocaleContext.js";
import { ThemeProvider } from "./lib/theme.js";
import App from "./App.js";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LocaleProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </LocaleProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);

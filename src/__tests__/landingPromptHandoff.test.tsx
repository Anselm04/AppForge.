import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { LocaleProvider } from "../i18n/LocaleContext.js";
import { PROMPT_DRAFT_KEY } from "../lib/promptDraft.js";
import { LandingPage } from "../pages/LandingPage.js";

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-probe">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe("LandingPage prompt handoff", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("lets a public visitor describe a product before signup and preserves the prompt", () => {
    render(
      <LocaleProvider>
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  <LandingPage />
                  <LocationProbe />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </LocaleProvider>,
    );

    const prompt = "Build a booking app for a mobile dog grooming business";
    fireEvent.change(
      screen.getByRole("textbox", { name: "What do you want to build?" }),
      { target: { value: prompt } },
    );
    fireEvent.submit(screen.getByTestId("build-prompt-form"));

    expect(sessionStorage.getItem(PROMPT_DRAFT_KEY)).toBe(prompt);
    expect(screen.getByTestId("location-probe")).toHaveTextContent(
      "/signup?next=/",
    );
  });
});

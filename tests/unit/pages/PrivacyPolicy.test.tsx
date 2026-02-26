import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PrivacyPolicy from "@/pages/PrivacyPolicy";

function renderPrivacyPolicy() {
  return render(
    <MemoryRouter>
      <PrivacyPolicy />
    </MemoryRouter>,
  );
}

describe("PrivacyPolicy", () => {
  it("renders the page heading", () => {
    renderPrivacyPolicy();
    expect(
      screen.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeInTheDocument();
  });

  it("renders all section headings", () => {
    renderPrivacyPolicy();
    const expectedSections = [
      "Overview",
      "Information We Collect",
      "How We Use Google Calendar Data",
      "Data Storage",
      "Data Sharing",
      "Data Retention",
      "Revoking Access",
      "Contact",
    ];
    for (const section of expectedSections) {
      expect(
        screen.getByRole("heading", { name: section }),
      ).toBeInTheDocument();
    }
  });

  it("renders a back link to the home page", () => {
    renderPrivacyPolicy();
    const backLink = screen.getByRole("link", { name: /back to recipe club/i });
    expect(backLink).toHaveAttribute("href", "/");
  });

  it("links to Google Account permissions page", () => {
    renderPrivacyPolicy();
    const link = screen.getByRole("link", {
      name: /google account permissions/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "https://myaccount.google.com/permissions",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("links to Supabase", () => {
    renderPrivacyPolicy();
    const link = screen.getByRole("link", { name: /supabase/i });
    expect(link).toHaveAttribute("href", "https://supabase.com");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("displays the last updated date", () => {
    renderPrivacyPolicy();
    expect(
      screen.getByText(/last updated: february 25, 2026/i),
    ).toBeInTheDocument();
  });

  it("describes Google Calendar usage", () => {
    renderPrivacyPolicy();
    expect(
      screen.getByText(
        /we do not read, analyze, or store the contents of your existing calendar events/i,
      ),
    ).toBeInTheDocument();
  });

  it("describes data sharing policy", () => {
    renderPrivacyPolicy();
    expect(
      screen.getByText(
        /we do not sell, trade, or share your personal data with third parties/i,
      ),
    ).toBeInTheDocument();
  });
});

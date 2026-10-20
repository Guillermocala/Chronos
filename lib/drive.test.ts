import { describe, expect, it } from "vitest";

import { isDriveFolderUrl, parseDriveUrl } from "./drive";

describe("parseDriveUrl", () => {
  it.each([
    ["https://docs.google.com/document/d/abc123/edit?usp=sharing", "doc", "https://docs.google.com/document/d/abc123/edit"],
    ["https://docs.google.com/spreadsheets/d/abc123/edit#gid=0", "sheet", "https://docs.google.com/spreadsheets/d/abc123/edit"],
    ["https://docs.google.com/presentation/d/abc123/edit", "slides", "https://docs.google.com/presentation/d/abc123/edit"],
    ["https://drive.google.com/drive/folders/xyz?usp=drive_link", "folder", "https://drive.google.com/drive/folders/xyz"],
    ["https://drive.google.com/drive/u/0/folders/xyz", "folder", "https://drive.google.com/drive/u/0/folders/xyz"],
    ["https://drive.google.com/file/d/xyz/view", "file", "https://drive.google.com/file/d/xyz/view"],
  ])("%s → %s", (input, kind, url) => {
    expect(parseDriveUrl(input)).toEqual({ kind, url });
  });

  it.each([
    "https://example.com/document/d/abc",
    "http://docs.google.com/document/d/abc",
    "https://docs.google.com/forms/d/abc",
    "no es un enlace",
  ])("rechaza %s", (input) => {
    expect(parseDriveUrl(input)).toBeNull();
  });

  it("detecta carpetas", () => {
    expect(isDriveFolderUrl("https://drive.google.com/drive/folders/xyz")).toBe(true);
    expect(isDriveFolderUrl("https://docs.google.com/document/d/abc/edit")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { firstName } from "@/lib/names";

describe("firstName", () => {
  it("skips titles", () => {
    expect(firstName("Brother Sam Jones")).toBe("Sam");
    expect(firstName("Bro. Sam Jones")).toBe("Sam");
    expect(firstName("Mateo Castillo")).toBe("Mateo");
    expect(firstName("Elder")).toBe("Elder");
  });
});

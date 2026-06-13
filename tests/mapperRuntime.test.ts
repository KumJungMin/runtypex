import { describe, expect, it } from "@jest/globals";
import { defineMap, makeMapper, source, transform } from "../src/runtime/mapper";

interface UserDto {
  user_id: string;
  profile: {
    name: string;
  };
  tags: Array<{ id: number }>;
  status?: "ACTIVE" | "INACTIVE";
}

interface User {
  id: string;
  displayName: string;
  firstTagId: number;
  isActive: boolean;
}

describe("runtime mapper", () => {
  it("maps DTO paths into domain fields", () => {
    const userMap = defineMap<UserDto, User>()({
      id: source("user_id"),
      displayName: source("profile.name"),
      firstTagId: source("tags.0.id"),
      isActive: transform("status", (value) => value === "ACTIVE"),
    });

    const toUser = makeMapper(userMap);

    expect(
      toUser({
        user_id: "u1",
        profile: { name: "Lux" },
        tags: [{ id: 7 }],
        status: "ACTIVE",
      })
    ).toEqual({
      id: "u1",
      displayName: "Lux",
      firstTagId: 7,
      isActive: true,
    });
  });

  it("uses defaults when the source path is missing", () => {
    const userMap = defineMap<UserDto, { status: "ACTIVE" | "INACTIVE" }>()({
      status: source("status", { default: "INACTIVE" as const, description: "status" }),
    });

    const toStatus = makeMapper(userMap);

    expect(toStatus({ user_id: "u1", profile: { name: "Lux" }, tags: [] })).toEqual({
      status: "INACTIVE",
    });
  });
});

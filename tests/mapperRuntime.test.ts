import { describe, expect, it } from "@jest/globals";
import { defineMap, defineMappingPolicy, makeMapper, mapperHelpers, source, transform } from "../src/runtime/mapper";

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

  it("provides DTO-typed mapper helpers", () => {
    const helpers = mapperHelpers<UserDto>();
    const userMap = defineMap<UserDto, Pick<User, "isActive">>()({
      isActive: helpers.transform("status", (value, dto) => dto.user_id === "u1" && value === "ACTIVE"),
    });

    const toUser = makeMapper(userMap);

    expect(
      toUser({
        user_id: "u1",
        profile: { name: "Lux" },
        tags: [],
        status: "ACTIVE",
      })
    ).toEqual({ isActive: true });
  });

  it("throws when a mapping violates an error-mode policy", () => {
    const policy = defineMappingPolicy<UserDto>()({
      userId: source("user_id"),
    });
    const weirdMap = defineMap<UserDto, { realMemberID: string }>()({
      realMemberID: source("user_id"),
    });

    expect(() => makeMapper(weirdMap, { policy, policyMode: "error" })).toThrow(
      'DTO path "user_id" is canonically mapped as "userId", but this map uses "realMemberID".'
    );
  });

  it("throws when a policy declares the same DTO path twice", () => {
    const policy = defineMappingPolicy<UserDto>()({
      userId: source("user_id"),
      memberId: source("user_id"),
    });
    const userMap = defineMap<UserDto, { userId: string }>()({
      userId: source("user_id"),
    });

    expect(() => makeMapper(userMap, { policy, policyMode: "error" })).toThrow(
      'DTO path "user_id" is canonically mapped as "userId", but this map uses "memberId".'
    );
  });
});

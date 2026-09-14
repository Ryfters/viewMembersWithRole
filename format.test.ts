/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// Run: npx tsx src/userplugins/viewMembersWithRole/format.test.ts

import { strict as assert } from "assert";

import { DISCORD_MESSAGE_LIMIT, formatMemberExport } from "./format";

const roles = { "1": { name: "Admin" }, "2": { name: "Mod" } };

// nick present, several roles
assert.deepEqual(
    formatMemberExport([{ nick: "Blanco", username: "blancodagoat", roleIds: ["1", "2"] }], roles),
    ["```\nNickname | Username | Roles\nBlanco | blancodagoat | Admin, Mod\n```"]
);

// no nick, and a role id the store doesn't know about -> both fall back to "-"
assert.deepEqual(
    formatMemberExport([{ nick: null, username: "someone", roleIds: ["999"] }], roles),
    ["```\nNickname | Username | Roles\n- | someone | -\n```"]
);

// empty list still yields one pasteable block
assert.deepEqual(formatMemberExport([], roles), ["```\nNickname | Username | Roles\n```"]);

// --- chunking ---
const many = Array.from({ length: 500 }, (_, i) => ({
    nick: `Member${i}`,
    username: `member${i}`,
    roleIds: ["1"]
}));

const blocks = formatMemberExport(many, roles);

// splits into more than one block, and every block is actually sendable
assert.ok(blocks.length > 1, "500 members should need several blocks");
for (const b of blocks) {
    assert.ok(b.length <= DISCORD_MESSAGE_LIMIT, `block of ${b.length} chars exceeds the limit`);
    assert.ok(b.startsWith("```\nNickname | Username | Roles\n"), "every block repeats the header");
    assert.ok(b.endsWith("\n```"), "every block is closed");
}

// no member is lost or duplicated across the split
const copied = blocks.flatMap(b => b.split("\n").slice(2, -1));
assert.equal(copied.length, many.length, "every member appears exactly once");
assert.equal(copied[0], "Member0 | member0 | Admin");
assert.equal(copied.at(-1), "Member499 | member499 | Admin");

// a row that cannot fit on its own is still emitted rather than dropped
const huge = [{ nick: "x".repeat(300), username: "big", roleIds: ["1"] }];
assert.equal(formatMemberExport(huge, roles, 100).length, 1);
assert.ok(formatMemberExport(huge, roles, 100)[0].includes("big"));

console.log(`formatMemberExport: all checks passed (500 members -> ${blocks.length} blocks)`);

/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ExportMember {
    nick?: string | null;
    username: string;
    roleIds: string[];
}

const FENCE = "```";
const HEADER = "Nickname | Username | Roles";

/** Discord rejects messages longer than this. */
export const DISCORD_MESSAGE_LIMIT = 2000;

function block(rows: string[]) {
    return [FENCE, HEADER, ...rows, FENCE].join("\n");
}

/**
 * Builds Discord-pasteable code blocks: one `nick | username | roles` row per member,
 * split so that every block fits in a single message. Always returns at least one block.
 */
export function formatMemberExport(
    members: ExportMember[],
    roles: Record<string, { name?: string; } | undefined>,
    maxLength = DISCORD_MESSAGE_LIMIT
): string[] {
    const rows = members.map(({ nick, username, roleIds }) => {
        const names = roleIds.map(id => roles[id]?.name).filter(Boolean).join(", ");
        return `${nick || "-"} | ${username} | ${names || "-"}`;
    });

    if (!rows.length) return [block([])];

    // length of block(rows) without the rows themselves; each row then costs its length + 1 newline
    const overhead = FENCE.length * 2 + HEADER.length + 4;

    const blocks: string[] = [];
    let current: string[] = [];
    let length = overhead;

    for (const row of rows) {
        // ponytail: a single row wider than maxLength still gets its own oversized block rather than
        // being truncated - losing a member is worse than one over-long paste. Wrap rows if it ever bites.
        if (current.length && length + row.length + 1 > maxLength) {
            blocks.push(block(current));
            current = [];
            length = overhead;
        }
        current.push(row);
        length += row.length + 1;
    }
    blocks.push(block(current));

    return blocks;
}

/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import type { Guild } from "@vencord/discord-types";
import { Menu } from "@webpack/common";

import { MemberIcon } from "./components/icons";
import { openVMWRModal } from "./components/ViewMembersModal";

// VMWR: View Members With Role
const makeContextMenuPatch: () => NavContextMenuPatchCallback = () => (children, { guild }: { guild: Guild, onClose(): void; }) => {
    if (!guild) return;

    const group = findGroupChildrenByChildId("privacy", children);
    group?.push(
        <Menu.MenuItem
            label="View members with role"
            id="vmwr-menuitem"
            icon={MemberIcon}
            action={() => openVMWRModal(guild.id)}
        />
    );
};

export default definePlugin({
    name: "ViewMembersWithRole",
    description: "Shows all the members with the selected roles",
    authors: [
        {
            name: "Ryfter",
            id: 898619112350183445n,
        },
    ],
    contextMenus: {
        "guild-header-popout": makeContextMenuPatch()
    },
    start() { },
    stop() { },
});

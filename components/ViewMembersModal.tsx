/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { InfoIcon } from "@components/Icons";
import { copyWithToast, getUniqueUsername } from "@utils/discord";
import { sleep } from "@utils/misc";
import type { RenderModalProps } from "@vencord/discord-types";
import { findByCodeLazy, findComponentByCodeLazy } from "@webpack";
import { Constants, FluxDispatcher, GuildChannelStore, GuildMemberStore, GuildRoleStore, Modal, openModal, Parser, RestAPI, ScrollerThin, Text, Tooltip, useEffect, useRef, UserStore, useState } from "@webpack/common";

import { formatMemberExport } from "../format";
import { cl, GuildUtils } from "../utils";

type GetRoleIconData = (role: any, size: number) => { customIconSrc?: string; unicodeEmoji?: any; };
const ThreeDots = findComponentByCodeLazy(".dots,", "dotRadius:");
const getRoleIconData: GetRoleIconData = findByCodeLazy("convertSurrogateToName", "customIconSrc", "unicodeEmoji");

function LoadingDots({ dotRadius, themed }: { dotRadius: number; themed: boolean; }) {
    return (
        <ErrorBoundary noop fallback={() => <Text variant="text-md/normal">Loading...</Text>}>
            <ThreeDots dotRadius={dotRadius} themed={themed} />
        </ErrorBoundary>
    );
}

function getRoleIconSrc(role: any) {
    const icon = getRoleIconData(role, 20);
    if (!icon) return;

    const { customIconSrc, unicodeEmoji } = icon;
    return customIconSrc ?? unicodeEmoji?.url;
}

function RoleCircle({ color }: { color?: string; }) {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (ref.current) {
            ref.current.style.setProperty("--vc-role-color", color || "var(--primary-300)");
        }
    }, [color]);

    return <span ref={ref} className={cl("modal-role-circle")} />;
}

function MembersContainer({ guildId, roleId }: { guildId: string; roleId: string; }) {
    // Safely get channelId, fallback to guildId if no selectable channels
    const selectableChannels = GuildChannelStore.getChannels(guildId)?.SELECTABLE;
    const memberListChannelId: string | undefined = selectableChannels?.[0]?.channel?.id;
    const channelId = memberListChannelId || guildId;

    // RMC: RoleMemberCounts - Try API endpoint first, fallback to calculating from members
    const [RMC, setRMC] = useState<Record<string, number>>({});
    const [apiCountsLoaded, setApiCountsLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        // Try to fetch from API endpoint if it exists
        const tryFetchCounts = async () => {
            if (cancelled || apiCountsLoaded) return;

            try {
                // Check if endpoint exists before calling
                if (Constants.Endpoints.GUILD_ROLE_MEMBER_COUNTS) {
                    const response = await RestAPI.get({
                        url: Constants.Endpoints.GUILD_ROLE_MEMBER_COUNTS(guildId)
                    });
                    if (response.ok && response.body) {
                        setRMC(response.body);
                        setApiCountsLoaded(true);
                        return;
                    }
                }
            } catch (error) {
                // Endpoint doesn't exist or failed, will calculate from members
            }

            // Fallback: Calculate counts from cached members
            const members = GuildMemberStore.getMembers(guildId);
            const roleCounts: Record<string, number> = {};
            members.forEach(member => {
                if (member?.roles) {
                    member.roles.forEach(role => {
                        roleCounts[role] = (roleCounts[role] || 0) + 1;
                    });
                }
            });
            setRMC(roleCounts);
            setApiCountsLoaded(true);
        };

        tryFetchCounts();

        return () => {
            cancelled = true;
        };
    }, [guildId, apiCountsLoaded]);

    const [usersInRole, setUsersInRole] = useState<string[]>([]);
    const [rolesFetched, setRolesFetched] = useState<Set<string>>(new Set());
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        if (rolesFetched.has(roleId)) return;

        let cancelled = false;

        const tryFetchMemberIds = async () => {
            if (cancelled) return;

            try {
                // Try API endpoint if it exists
                if (Constants.Endpoints.GUILD_ROLE_MEMBER_IDS) {
                    const response = await RestAPI.get({
                        url: Constants.Endpoints.GUILD_ROLE_MEMBER_IDS(guildId, roleId),
                    });
                    if (response.ok && response.body) {
                        const memberIds: string[] = response.body || [];
                        if (memberIds.length > 0) {
                            await GuildUtils.requestMembersById(guildId, memberIds, false);
                            setUsersInRole(memberIds);
                        }
                        setRolesFetched(prev => new Set([...prev, roleId]));
                        setFetchError(null);
                        return;
                    }
                }
            } catch (error) {
                // API endpoint doesn't exist or failed, will use fallback
                setFetchError("API endpoint not available, using cached members");
            }

            // Fallback: Use cached members and request more if needed
            const members = GuildMemberStore.getMembers(guildId);
            const roleMemberIds = members
                .filter(m => m?.roles?.includes(roleId))
                .map(m => m.userId);

            setUsersInRole(roleMemberIds);
            setRolesFetched(prev => new Set([...prev, roleId]));
        };

        const timeout = setTimeout(tryFetchMemberIds, 100);

        return () => {
            cancelled = true;
            clearTimeout(timeout);
        };
    }, [guildId, roleId, rolesFetched]);

    const [members, setMembers] = useState(GuildMemberStore.getMembers(guildId));
    useEffect(() => {
        let cancelled = false;
        const interval = setInterval(() => {
            if (cancelled) return;
            const guildMembers = GuildMemberStore.getMembers(guildId);

            if (guildMembers !== members) {
                setMembers(guildMembers);

                // Update role counts when members change
                if (!apiCountsLoaded) {
                    const roleCounts: Record<string, number> = {};
                    guildMembers.forEach(member => {
                        if (member?.roles) {
                            member.roles.forEach(role => {
                                roleCounts[role] = (roleCounts[role] || 0) + 1;
                            });
                        }
                    });
                    setRMC(prev => ({ ...prev, ...roleCounts }));
                }
            }
        }, 500);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [guildId, members, apiCountsLoaded]);

    const allMembers = members
        .filter(x => x != null)
        .map(x => ({ member: x, user: UserStore.getUser(x.userId) }))
        .filter(x => x.user != null);

    const roleMembers = allMembers.filter(({ member }) => member.roles?.includes(roleId));

    const guildRoles = GuildRoleStore.getRolesSnapshot(guildId);

    // Drives the same member-list subscription the sidebar uses when you scroll, which is the only
    // way a user account enumerates members it has not seen. Discord withholds the "offline" group
    // on guilds over ~1000 members, so above that this loads online members only.
    const [loading, setLoading] = useState(false);
    const [loadedCount, setLoadedCount] = useState(0);

    async function loadAllMembers() {
        if (loading || !memberListChannelId) return;
        setLoading(true);

        const seen = () => GuildMemberStore.getMemberIds(guildId).length;
        const RANGES_PER_REQUEST = 3;
        // ponytail: hard stop at ~60k rows so a huge guild cannot spin forever; raise if you outgrow it
        const MAX_REQUESTS = 200;

        let offset = 0;
        let stale = 0;

        try {
            for (let i = 0; i < MAX_REQUESTS && stale < 2; i++) {
                const before = seen();

                FluxDispatcher.dispatch({
                    type: "GUILD_SUBSCRIPTIONS_FLUSH",
                    subscriptions: {
                        [guildId]: {
                            channels: {
                                [memberListChannelId]: Array.from({ length: RANGES_PER_REQUEST }, (_, n) => {
                                    const start = offset + n * 100;
                                    return [start, start + 99];
                                })
                            }
                        }
                    }
                });

                await sleep(700);

                offset += RANGES_PER_REQUEST * 100;
                // two consecutive batches that add nobody means we have reached the end of the list
                stale = seen() > before ? 0 : stale + 1;
                setLoadedCount(seen());
            }
        } finally {
            setLoading(false);
        }
    }

    // which part each list is up to, so repeated clicks walk through an oversized export
    const copyPart = useRef<Record<string, number>>({});

    function copyMembers(entries: typeof allMembers, what: string, key: string) {
        const blocks = formatMemberExport(
            entries.map(({ member, user }) => ({
                nick: member.nick,
                username: getUniqueUsername(user),
                roleIds: member.roles ?? []
            })),
            guildRoles
        );

        const part = (copyPart.current[key] ?? 0) % blocks.length;
        copyPart.current[key] = part + 1;

        copyWithToast(blocks[part], blocks.length > 1
            ? `Copied part ${part + 1}/${blocks.length} of ${entries.length} ${what} - click again for the next part`
            : `Copied ${entries.length} ${what} to clipboard!`);
    }

    return (
        <div className={cl("modal-members")}>
            <div className={cl("member-list-header")}>
                <div className={cl("member-list-header-text")}>
                    <Text>
                        {roleMembers.length} loaded / {RMC[roleId] || 0} members with this role
                    </Text>
                    <Tooltip text="For roles with over 100 members, only the first 100 and the cached members will be shown.">
                        {props => <InfoIcon {...props} />}
                    </Tooltip>
                </div>
                <div className={cl("member-list-actions")}>
                    <Tooltip text={memberListChannelId
                        ? "Scrolls the member list for you so uncached members get loaded. Servers over ~1000 members only expose online members."
                        : "No readable channel in this server to load the member list from."}>
                        {tooltipProps => (
                            <Button
                                {...tooltipProps}
                                size="small"
                                variant="primary"
                                disabled={loading || !memberListChannelId}
                                onClick={loadAllMembers}
                            >
                                {loading ? `Loading... ${loadedCount}` : "Load all"}
                            </Button>
                        )}
                    </Tooltip>
                    <Button
                        size="small"
                        variant="secondary"
                        disabled={roleMembers.length === 0}
                        onClick={() => copyMembers(roleMembers, "members with this role", `role:${roleId}`)}
                    >
                        Copy role
                    </Button>
                    <Tooltip text="Copies every member cached for this server, with their roles. Long lists are split - click again for the next part.">
                        {tooltipProps => (
                            <Button
                                {...tooltipProps}
                                size="small"
                                variant="secondary"
                                disabled={allMembers.length === 0}
                                onClick={() => copyMembers(allMembers, "members", "all")}
                            >
                                Copy all ({allMembers.length})
                            </Button>
                        )}
                    </Tooltip>
                </div>
            </div>
            <ScrollerThin orientation="auto">
                {roleMembers.map(({ user: x }) => {
                    if (!x) return null;
                    return (
                        <div key={x.id} className={cl("user-div")}>
                            <img
                                className={cl("user-avatar")}
                                src={x.getAvatarURL()}
                                alt={x.username || "User avatar"}
                                title={x.username || "User"}
                            />
                            {Parser.parse(`<@${x.id}>`, true, { channelId, viewingChannelId: channelId })}
                        </div>
                    );
                })}
                {
                    (Object.keys(RMC).length === 0 && !apiCountsLoaded) ? (
                        <div className={cl("member-list-footer")}>
                            <LoadingDots dotRadius={5} themed={true} />
                        </div>
                    ) : !RMC[roleId] && roleMembers.length === 0 ? (
                        <Text className={cl("member-list-footer")} variant="text-md/normal">No member found with this role</Text>
                    ) : RMC[roleId] && RMC[roleId] === roleMembers.length ? (
                        <>
                            <div className={cl("divider")} />
                            <Text className={cl("member-list-footer")} variant="text-md/normal">All members loaded</Text>
                        </>
                    ) : rolesFetched.has(roleId) ? (
                        <>
                            <div className={cl("divider")} />
                            <Text className={cl("member-list-footer")} variant="text-md/normal">
                                {fetchError ? `${roleMembers.length} cached members loaded` : "All cached members loaded"}
                            </Text>
                            {fetchError && (
                                <Text className={cl("member-list-footer")} variant="text-xs/normal" style={{ opacity: 0.7 }}>
                                    {fetchError}
                                </Text>
                            )}
                        </>
                    ) : (
                        <div className={cl("member-list-footer")}>
                            <LoadingDots dotRadius={5} themed={true} />
                        </div>
                    )
                }
            </ScrollerThin>
        </div>
    );
}

function VMWRModal({ guildId, props }: { guildId: string; props: RenderModalProps; }) {
    const roleObj = GuildRoleStore.getRolesSnapshot(guildId);
    const roles = Object.keys(roleObj).map(key => roleObj[key]).sort((a, b) => b.position - a.position);

    const [selectedRole, selectRole] = useState<any | null>(roles[0] || null);

    return (
        <Modal {...props} size="lg" title="View members with role">
                <div className={cl("modal-container")}>
                    <ScrollerThin className={cl("modal-list")} orientation="auto">
                        {roles.map((role, index) => {

                            if (role.id === guildId) return;

                            const roleIconSrc = role != null ? getRoleIconSrc(role) : undefined;

                            return (
                                <div
                                    className={cl("modal-list-item-btn")}
                                    onClick={() => selectRole(roles[index])}
                                    role="button"
                                    tabIndex={0}
                                    key={role.id}
                                >
                                    <div
                                        className={cl("modal-list-item", { "modal-list-item-active": selectedRole?.id === role.id })}
                                    >
                                        <RoleCircle color={role?.colorString} />
                                        {
                                            roleIconSrc != null && (
                                                <img
                                                    className={cl("modal-role-image")}
                                                    src={roleIconSrc}
                                                    alt={role?.name || "Role icon"}
                                                    title={role?.name || "Role"}
                                                />
                                            )

                                        }
                                        <Text variant="text-md/normal">
                                            {role?.name || "Unknown role"}
                                        </Text>
                                    </div>
                                </div>
                            );
                        })}
                    </ScrollerThin>
                    <div className={cl("modal-divider")} />
                    {selectedRole && (
                        <MembersContainer
                            guildId={guildId}
                            roleId={selectedRole.id}
                        />
                    )}
                </div>
        </Modal>
    );
}

export function openVMWRModal(guildId) {

    openModal(props =>
        <VMWRModal
            guildId={guildId}
            props={props}
        />
    );
}

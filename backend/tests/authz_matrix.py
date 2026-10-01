"""AUTHZ route table (W0 AUTHZ, rulings R-P0-6 … R-P0-8).

Data only: every POST/PUT/PATCH/DELETE route the live app mounts, with the
role its ruled intent requires (not today's gate: R-P0-7, V6d). The tests that
read it are in `tests/test_authz_matrix.py`.

- `min_role`: public · optional · user · self · viewer · member · lead · owner ·
  admin · admin_or_key · dev. viewer/member/lead/owner are static-scoped.
- `gate`: how the handler checks today (depends · helper · inline). Not asserted.
- `build(world)` returns `(path_params, query, body)`: a minimally valid request
  against the per-test world, so a probe reaches the gate instead of a 404/422.
  Builds that read `w.me`, `w.my_card`, `w.my_drop`, `w.my_suggestion`,
  `w.my_reg` or `w.my_hub` resolve to the caller's own object (a viewer probe targets the
  viewer's own card: the strongest case for a viewer). `w.other_card` is the one
  card the caller does not hold (the lead's, or the member's when the caller is the lead).
- `actor`: who the committed allowed-actor probe sends the request as. For a `plugin` row it
  is also the user whose minted `xrp_` key the plugin-contract test sends (R-P0-8.6).
- `owned`: the build targets an object the actor owns (a hub object, or the applicant's own
  join request). The stranger probe (R-A2-7) sends that build with another user's JWT and
  expects 403/404; the actor probe on the same build proves the 404 isn't a broken build.
  Every other `self` row is listed in the test file's `CALLER_SCOPED` (R-A2-9).
- `plugin`: the Dalamud plugin calls this route (`RaidPlannerClient.cs`). The contract test
  sends it with only `Authorization: Bearer xrp_…`; `plugin_body(world)` replaces the build's
  body where the plugin's DTO differs from the row's usual edit.
- `variant`: names the body shape or target when one route carries two rulings
  (e.g. own card = member, someone else's card = lead).
- `gaps`: `(probe, reason)` pairs marked strict xfail until the gap is fixed. A probe name is a
  key of `PROBES` in the test file (viewer member lead allowed actor anon nonadmin outsider
  stranger): the row must be in that probe's row list.
"""

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

Request = tuple[dict[str, str], dict[str, Any] | None, Any]

STATIC_ROLES = ("viewer", "member", "lead", "owner")
TRIAL_ID = "dt-valigarmanda"


@dataclass(frozen=True)
class AuthzRoute:
    method: str
    path: str
    min_role: str
    gate: str
    intent: str
    plugin: bool = False
    plugin_body: Callable[[Any], Any] | None = None
    dev_only: bool = False
    build: Callable[[Any], Request] | None = None
    actor: str = "owner"
    variant: str = ""
    gaps: tuple[tuple[str, str], ...] = ()
    owned: bool = False

    @property
    def static_scoped(self) -> bool:
        return self.min_role in STATIC_ROLES

    @property
    def id(self) -> str:
        suffix = f" [{self.variant}]" if self.variant else ""
        return f"{self.method} {self.path}{suffix}"


# ── Path helpers (world → path params) ──────────────────────────────────────


def _g(w, **extra) -> dict[str, str]:
    return {"group_id": w.group.id, **extra}


def _t(w, **extra) -> dict[str, str]:
    return _g(w, tier_id=w.tier.tier_id, **extra)


def _card(w, card, *, tier=None, **extra) -> dict[str, str]:
    return _g(w, tier_id=(tier or w.tier).tier_id, player_id=card.id, **extra)


def _goal(w, **extra) -> dict[str, str]:
    return _g(w, goal_id=w.goal.id, **extra)


def _sched(w, **extra) -> dict[str, str]:
    return _g(w, session_id=w.sched.id, **extra)


def _lode(w, card) -> dict[str, str]:
    return {"group_id": w.group.id, "player_id": card.id}


def _hub_bis(w) -> dict[str, str]:
    return {"job_profile_id": w.my_hub.job.id, "target_id": w.my_hub.bis.id}


def _r(params: dict[str, str], query: dict | None = None, body: Any = None) -> Request:
    return params, query, body


def _viewer_gap(what: str) -> tuple[tuple[str, str], ...]:
    return (("viewer", f"gap: {what}"),)


R = AuthzRoute
G = "/api/static-groups/{group_id}"
T = G + "/tiers/{tier_id}"
P = T + "/players/{player_id}"
WA = G + "/weekly-assignments"
SCHED = G + "/schedule/{session_id}"
SCH = G + "/scheduler"
CG = G + "/collection-goals"
CS = G + "/content-suggestions"
REG = G + "/character-registrations"
MF = G + "/mount-farms/progress"
SC = G + "/split-clear"
OBJ = G + "/objective-goals"
JR = "/api/join-requests/{request_id}"
LODE = "/api/lodestone"
BIS = "/api/bis-targets"
PLAYER = "/api/player"
AK = "/api/auth/api-keys"
ERRS = "/api/admin/analytics/errors"
CAT = "/api/admin/collection-catalog"
ME = "/api/me"

# fmt: off
ROUTES: tuple[AuthzRoute, ...] = (
    # ── auth / api keys / analytics / discord / notifications ───────────────
    R("POST", "/api/auth/discord/callback", "public", "inline",
      "finish Discord OAuth login (state + code checked)"),
    R("POST", "/api/auth/refresh", "public", "inline",
      "rotate the access token from the refresh cookie"),
    R("POST", "/api/auth/logout", "user", "depends",
      "log out (auth required so the POST can't be forged)"),
    R("PATCH", "/api/auth/me/preferences", "self", "depends",
      "edit the caller's own preferences"),
    R("POST", AK, "user", "depends", "mint an API key (JWT only, never by key)"),
    R("DELETE", AK + "/{key_id}", "self", "inline",
      "revoke one of the caller's own keys (JWT only)", owned=True, actor="member",
      build=lambda w: _r({"key_id": w.my_hub.api_key.id})),
    R("POST", AK + "/plugin-auth/authorize", "user", "depends",
      "approve a plugin login from the browser (JWT only)"),
    R("POST", AK + "/plugin-auth/exchange", "public", "inline",
      "plugin trades a one-time PKCE code for a key"),
    R("POST", "/api/analytics/events", "optional", "depends", "record client analytics events"),
    R("POST", "/api/analytics/errors", "optional", "depends", "record a client error report"),
    R("POST", ERRS + "/batch-review", "admin", "depends",
      "mark error groups reviewed (JWT admin)"),
    R("POST", ERRS + "/{fingerprint}/review", "admin", "depends",
      "mark an error group reviewed (JWT admin)"),
    R("POST", ERRS + "/{fingerprint}/unreview", "admin", "depends",
      "reopen an error group (JWT admin)"),
    R("POST", CAT + "/import-verified-ids", "admin_or_key", "inline",
      "import verified catalog ids (admin, key allowed)", plugin=True, actor="admin",
      build=lambda w: _r({}, None, [{"sourceDutyKey": TRIAL_ID, "rewardName": "Test Mount",
                                     "gameMountId": 1, "confidence": "exact",
                                     "verifiedBy": "plugin_lumina"}])),
    R("POST", CAT + "/seed", "admin_or_key", "inline", "seed the collection catalog (admin)"),
    R("POST", CAT + "/sync", "admin_or_key", "inline", "sync the collection catalog (admin)"),
    R("POST", "/api/discord/interactions", "public", "inline",
      "Discord interaction webhook (Ed25519 signature)"),
    R("POST", "/api/discord/slash-claim", "public", "inline",
      "bot links a guild by claim code (Bot token)"),
    R("POST", "/api/dev-auth/login/{user_index}", "dev", "inline",
      "dev-only login as a seeded user", dev_only=True),
    R("POST", "/api/notifications/read-all", "self", "depends",
      "mark the caller's notifications read"),
    R("PATCH", "/api/notifications/{notification_id}/read", "self", "inline",
      "mark one of the caller's notifications read", owned=True, actor="member",
      build=lambda w: _r({"notification_id": w.my_hub.notification.id})),

    # ── player hub (the caller's own profile) ───────────────────────────────
    R("PUT", PLAYER + "/profile", "self", "depends", "edit the caller's player profile"),
    R("POST", PLAYER + "/profile/rotate-share-code", "self", "depends",
      "rotate the caller's profile share code"),
    R("PUT", PLAYER + "/availability/template", "self", "depends",
      "edit the caller's personal availability template"),
    R("POST", PLAYER + "/characters", "self", "depends",
      "link a character to the caller's profile"),
    R("PUT", PLAYER + "/characters/{character_id}", "self", "inline",
      "edit one of the caller's characters", owned=True, actor="member",
      build=lambda w: _r({"character_id": w.my_hub.character.id}, None, {})),
    R("DELETE", PLAYER + "/characters/{character_id}", "self", "inline",
      "unlink one of the caller's characters", owned=True, actor="member",
      build=lambda w: _r({"character_id": w.my_hub.character.id})),
    # The actor reaches the Lodestone fetch, stubbed to 409 in the test file (R-A2-8).
    R("POST", PLAYER + "/characters/{character_id}/sync-gear", "self", "inline",
      "sync gear for one of the caller's characters", owned=True, actor="member",
      build=lambda w: _r({"character_id": w.my_hub.character.id})),
    R("POST", PLAYER + "/goals", "self", "depends", "add a personal goal"),
    R("PUT", PLAYER + "/goals/{goal_id}", "self", "inline", "edit one of the caller's goals",
      owned=True, actor="member",
      build=lambda w: _r({"goal_id": w.my_hub.goal.id}, None, {"title": "Renamed goal"})),
    R("DELETE", PLAYER + "/goals/{goal_id}", "self", "inline",
      "delete one of the caller's goals", owned=True, actor="member",
      build=lambda w: _r({"goal_id": w.my_hub.goal.id})),
    R("POST", PLAYER + "/jobs", "self", "depends", "add a job to the caller's profile"),
    R("PUT", PLAYER + "/jobs/{job_profile_id}", "self", "inline",
      "edit one of the caller's jobs", owned=True, actor="member",
      build=lambda w: _r({"job_profile_id": w.my_hub.job.id}, None, {})),
    R("DELETE", PLAYER + "/jobs/{job_profile_id}", "self", "inline",
      "delete one of the caller's jobs", owned=True, actor="member",
      build=lambda w: _r({"job_profile_id": w.my_hub.job.id})),
    R("POST", PLAYER + "/jobs/{job_profile_id}/bis-targets", "self", "inline",
      "add a BiS target to the caller's job", owned=True, actor="member",
      build=lambda w: _r({"job_profile_id": w.my_hub.job.id}, None, {"name": "Job BiS 2"})),
    R("PUT", PLAYER + "/jobs/{job_profile_id}/bis-targets/{target_id}", "self", "inline",
      "edit the caller's BiS target", owned=True, actor="member",
      build=lambda w: _r(_hub_bis(w), None, {"name": "Renamed BiS"})),
    R("DELETE", PLAYER + "/jobs/{job_profile_id}/bis-targets/{target_id}", "self", "inline",
      "delete the caller's BiS target", owned=True, actor="member",
      build=lambda w: _r(_hub_bis(w))),
    # Imports answer 400 "No external URL configured": a domain 4xx the actor probe accepts.
    R("POST", PLAYER + "/jobs/{job_profile_id}/bis-targets/{target_id}/import", "self",
      "inline", "import gear into the caller's BiS target", owned=True, actor="member",
      build=lambda w: _r(_hub_bis(w))),
    R("POST", PLAYER + "/jobs/{job_profile_id}/bis-targets/{target_id}/set-active", "self",
      "inline", "make the caller's BiS target active", owned=True, actor="member",
      build=lambda w: _r(_hub_bis(w))),
    R("PUT", ME + "/collection-intent/{catalog_item_id}", "self", "depends",
      "set the caller's intent for a collectible"),
    R("DELETE", ME + "/collection-intent/{catalog_item_id}", "self", "depends",
      "clear the caller's intent for a collectible"),
    R("PUT", ME + "/collection-snapshot/{catalog_item_id}", "self", "depends",
      "record whether the caller owns a collectible"),

    # ── plugin sync routes (the caller's own data) ──────────────────────────
    R("POST", "/api/plugin/collections/sync", "self", "depends",
      "plugin syncs the caller's collection", plugin=True, actor="member",
      build=lambda w: _r({}, None, {"characterName": "Member Card", "characterWorld": "Tonberry",
                                    "pluginVersion": "1.0.0",
                                    "mounts": [{"trialId": TRIAL_ID, "owned": True}],
                                    "currencies": [{"tokenName": "Valigarmanda Totem",
                                                    "count": 2}]})),
    R("POST", "/api/plugin/mount-farms/sync", "self", "inline",
      "plugin syncs the caller's mount progress (viewer statics skipped)", plugin=True,
      actor="member",
      build=lambda w: _r({}, None, {"characterName": "Member Card", "characterWorld": "Tonberry",
                                    "mounts": [{"mountId": 1, "trialId": TRIAL_ID,
                                                "owned": True}],
                                    "totems": [{"itemId": 2, "trialId": TRIAL_ID, "count": 3}],
                                    "source": "plugin", "pluginVersion": "1.0.0"})),
    R("POST", "/api/plugin/player/gear-sync", "self", "depends",
      "plugin syncs the caller's current gear"),
    R("POST", "/api/plugin/player/batch-gear-sync", "self", "depends",
      "plugin syncs the caller's gearsets", plugin=True, actor="member",
      build=lambda w: _r({}, None, {"characterName": "Member Card", "characterWorld": "Tonberry",
                                    "gearsets": [{"gearsetIndex": 0, "gearsetName": "DRG",
                                                  "job": "DRG", "classJobId": 22,
                                                  "gear": [{"slot": "weapon", "hasItem": True,
                                                            "currentSource": "savage",
                                                            "itemId": 1, "itemLevel": 730}]}],
                                    "source": "plugin", "pluginVersion": "1.0.0"})),

    # ── shared BiS targets: profile targets are self, roster targets lead ───
    R("POST", BIS, "self", "inline", "add a BiS target to the caller's job profile",
      variant="profile", owned=True, actor="member",
      build=lambda w: _r({}, None, {"ownerType": "player_job_profile",
                                    "ownerId": w.my_hub.job.id, "name": "Profile BiS 2"})),
    R("POST", BIS, "lead", "helper", "add a BiS target to a roster card", variant="roster",
      build=lambda w: _r({}, None, {"ownerType": "roster_member_job",
                                    "ownerId": w.card["open"].id, "name": "Roster BiS 2"})),
    R("PATCH", BIS + "/{target_id}", "self", "inline", "edit the caller's profile BiS target",
      variant="profile", owned=True, actor="member",
      build=lambda w: _r({"target_id": w.my_hub.bis.id}, None, {"name": "Renamed BiS"})),
    R("PATCH", BIS + "/{target_id}", "lead", "helper", "edit a roster BiS target",
      variant="roster",
      build=lambda w: _r({"target_id": w.roster_bis.id}, None, {"name": "Renamed BiS"})),
    R("DELETE", BIS + "/{target_id}", "self", "inline", "delete the caller's profile BiS target",
      variant="profile", owned=True, actor="member",
      build=lambda w: _r({"target_id": w.my_hub.bis.id})),
    R("DELETE", BIS + "/{target_id}", "lead", "helper", "delete a roster BiS target",
      variant="roster", build=lambda w: _r({"target_id": w.roster_bis.id})),
    R("POST", BIS + "/{target_id}/import", "self", "inline",
      "import gear into the caller's profile BiS target", variant="profile", owned=True,
      actor="member", build=lambda w: _r({"target_id": w.my_hub.bis.id})),
    R("POST", BIS + "/{target_id}/import", "lead", "helper",
      "import gear into a roster BiS target", variant="roster",
      build=lambda w: _r({"target_id": w.roster_bis.id})),
    R("POST", BIS + "/{target_id}/set-active", "self", "inline",
      "make the caller's profile BiS target active", variant="profile", owned=True,
      actor="member", build=lambda w: _r({"target_id": w.my_hub.bis.id})),
    R("POST", BIS + "/{target_id}/set-active", "lead", "helper",
      "make a roster BiS target active", variant="roster",
      build=lambda w: _r({"target_id": w.roster_bis.id})),

    # ── statics, members, invitations ───────────────────────────────────────
    R("POST", "/api/static-groups", "user", "depends",
      "create a static; the caller becomes its owner"),
    R("PUT", G, "lead", "helper", "rename the static or edit its settings", variant="settings",
      build=lambda w: _r(_g(w), None, {"name": "Renamed Static"})),
    R("PUT", G, "owner", "helper", "change the static's public visibility", variant="visibility",
      build=lambda w: _r(_g(w), None, {"isPublic": True})),
    R("DELETE", G, "owner", "helper", "delete the static", build=lambda w: _r(_g(w))),
    R("POST", G + "/duplicate", "member", "inline",
      "copy the static into a new one the caller owns (members and up, #331)",
      build=lambda w: _r(_g(w), None, {"newName": "Copy of Static"})),
    R("POST", G + "/members", "lead", "helper", "add a user (owners alone add leads)",
      build=lambda w: _r(_g(w), {"user_id": w.u["outsider"].id, "role": "member"})),
    R("PUT", G + "/members/{user_id}", "lead", "helper",
      "change a member's role (owners alone manage leads)",
      build=lambda w: _r(_g(w, user_id=w.u["member2"].id), None, {"role": "member"})),
    R("DELETE", G + "/members/{user_id}", "lead", "helper",
      "remove someone else from the static", variant="remove",
      build=lambda w: _r(_g(w, user_id=w.u["member2"].id))),
    R("DELETE", G + "/members/{user_id}", "self", "inline",
      "leave the static (any role but the owner)", variant="leave", actor="member",
      build=lambda w: _r(_g(w, user_id=w.me.id))),
    R("POST", G + "/transfer-ownership", "owner", "helper", "hand the static to another member",
      build=lambda w: _r(_g(w), {"new_owner_id": w.u["lead"].id})),
    R("POST", "/api/static-groups/{share_code}/join-requests", "user", "inline",
      "apply to join a static (non-members)"),
    R("POST", "/api/invitations/{invite_code}/accept", "user", "inline",
      "join a static by invite code"),
    R("POST", G + "/invitations", "lead", "helper",
      "create an invite link (owners alone invite leads)",
      build=lambda w: _r(_g(w), None, {"role": "member"})),
    R("DELETE", G + "/invitations/{invitation_id}", "lead", "helper", "revoke an invite link",
      build=lambda w: _r(_g(w, invitation_id=w.invitation.id))),

    # ── join requests (the static comes from the request) ───────────────────
    R("POST", JR + "/cancel", "self", "inline", "withdraw the caller's own application",
      owned=True, actor="applicant", build=lambda w: _r({"request_id": w.join_request.id})),
    R("POST", JR + "/accept", "lead", "helper", "accept an application",
      build=lambda w: _r({"request_id": w.join_request.id})),
    R("POST", JR + "/decline", "lead", "helper", "decline an application",
      build=lambda w: _r({"request_id": w.join_request.id})),
    R("POST", JR + "/under-review", "lead", "helper", "mark an application under review",
      build=lambda w: _r({"request_id": w.join_request.id})),
    R("POST", JR + "/link-roster", "lead", "helper",
      "link an accepted applicant to a roster card",
      build=lambda w: _r({"request_id": w.accepted_request.id}, None,
                         {"rosterPlayerId": w.card["open"].id})),

    # ── tiers and roster cards ──────────────────────────────────────────────
    R("POST", G + "/tiers", "lead", "helper", "add a raid tier to the static",
      build=lambda w: _r(_g(w), None, {"tierId": "aac-cruiserweight"})),
    R("PUT", T, "lead", "helper", "make a tier active",
      build=lambda w: _r(_t(w), None, {"isActive": True})),
    R("DELETE", T, "lead", "helper", "delete a tier", build=lambda w: _r(_t(w))),
    R("POST", T + "/rollover", "lead", "helper", "roll the roster into a new tier",
      build=lambda w: _r(_t(w), None, {"targetTierId": "aac-cruiserweight"})),
    R("PUT", T + "/weapon-priority-settings", "lead", "helper",
      "edit the tier's weapon-priority lock settings",
      build=lambda w: _r(_t(w), None, {"weaponPrioritiesGlobalLock": False})),
    R("POST", T + "/players", "lead", "helper", "add a roster card",
      build=lambda w: _r(_t(w), None, {"name": "New Card"})),
    R("PUT", P, "member", "inline", "edit your own roster card", variant="own", actor="member",
      plugin=True,
      plugin_body=lambda w: {"gear": [{"slot": "weapon", "bisSource": "raid",
                                       "currentSource": "savage", "hasItem": True,
                                       "isAugmented": False, "itemId": 1, "itemLevel": 730,
                                       "materia": []}],
                             "tomeWeapon": {"pursuing": False, "hasItem": False,
                                            "isAugmented": False}},
      build=lambda w: _r(_card(w, w.my_card), None, {"rosterNote": "My note"})),
    R("PUT", P, "lead", "inline", "edit someone else's roster card", variant="other",
      build=lambda w: _r(_card(w, w.card["open"]), None, {"name": "Renamed Card"})),
    R("DELETE", P, "lead", "helper", "delete a roster card",
      build=lambda w: _r(_card(w, w.card["open"]))),
    R("POST", P + "/admin-assign", "admin", "depends", "admin links any user to a card",
      actor="admin",
      build=lambda w: _r(_card(w, w.card["open"]), None, {"userId": w.u["member2"].id})),
    R("POST", P + "/owner-assign", "owner", "helper", "owner links a member to a card",
      build=lambda w: _r(_card(w, w.card["open"]), None, {"userId": w.u["member2"].id})),
    # The claim targets the second tier, where the probing viewer holds no card: in the
    # first tier "already linked in this tier" would answer the viewer's 403 instead.
    R("POST", P + "/claim", "member", "inline",
      "take ownership of an unclaimed card (one per tier)", actor="member2",
      build=lambda w: _r(_card(w, w.card["open2"], tier=w.tier2))),
    R("DELETE", P + "/claim", "viewer", "inline",
      "unlink yourself from your own card (open to a demoted viewer, V2)", variant="self",
      actor="viewer", build=lambda w: _r(_card(w, w.my_card))),
    R("DELETE", P + "/claim", "owner", "inline", "unlink someone else from their card",
      variant="other", build=lambda w: _r(_card(w, w.other_card))),
    R("PUT", P + "/weapon-priorities", "member", "inline",
      "edit your own card's weapon priorities", variant="own", actor="member",
      build=lambda w: _r(_card(w, w.my_card), None, {"weaponPriorities": [{"job": "DRG"}]})),
    R("PUT", P + "/weapon-priorities", "lead", "inline",
      "edit someone else's weapon priorities", variant="other",
      build=lambda w: _r(_card(w, w.card["open"]), None,
                         {"weaponPriorities": [{"job": "DRG"}]})),
    R("POST", P + "/weapon-priorities/lock", "lead", "helper",
      "lock a card's weapon priorities", build=lambda w: _r(_card(w, w.card["open"]))),
    R("DELETE", P + "/weapon-priorities/lock", "lead", "helper",
      "unlock a card's weapon priorities", build=lambda w: _r(_card(w, w.card["open"]))),
    R("POST", WA, "lead", "helper", "assign a slot for a week",
      build=lambda w: _r(_g(w), None, {"tierId": w.tier.tier_id, "week": 1,
                                       "floor": "M9S", "slot": "body"})),
    R("POST", WA + "/bulk", "lead", "helper", "assign a week's slots",
      build=lambda w: _r(_g(w), None, {"tierId": w.tier.tier_id, "week": 2,
                                       "assignments": [{"floor": "M9S", "slot": "head"}]})),
    R("DELETE", WA + "/bulk", "lead", "helper", "clear a week's assignments",
      build=lambda w: _r(_g(w), None, {"tierId": w.tier.tier_id, "week": 1})),
    R("PUT", WA + "/{assignment_id}", "lead", "helper", "edit one assignment",
      build=lambda w: _r(_g(w, assignment_id=w.assignment.id), None, {"sortOrder": 1})),
    R("DELETE", WA + "/{assignment_id}", "lead", "helper", "delete one assignment",
      build=lambda w: _r(_g(w, assignment_id=w.assignment.id))),

    # ── loot, materials, pages, weeks ───────────────────────────────────────
    R("POST", T + "/loot-log", "member", "inline", "log a purchase for your own card",
      variant="purchase", actor="member", plugin=True,
      build=lambda w: _r(_t(w), None, {"weekNumber": 1, "floor": "M9S", "itemSlot": "ring1",
                                       "recipientPlayerId": w.my_card.id,
                                       "method": "purchase"})),
    R("POST", T + "/loot-log", "lead", "inline", "log a drop (or anyone else's purchase)",
      variant="drop", actor="lead", plugin=True,
      build=lambda w: _r(_t(w), None, {"weekNumber": 1, "floor": "M9S", "itemSlot": "hands",
                                       "recipientPlayerId": w.card["open"].id,
                                       "method": "drop"})),
    R("PUT", T + "/loot-log/{entry_id}", "lead", "helper", "edit a loot entry",
      build=lambda w: _r(_t(w, entry_id=str(w.loot.id)), None, {"notes": "edited"})),
    R("DELETE", T + "/loot-log/{entry_id}", "lead", "helper", "delete a loot entry",
      build=lambda w: _r(_t(w, entry_id=str(w.loot.id)))),
    R("POST", T + "/material-log", "member", "inline",
      "log a material purchase for your own card", variant="purchase", actor="member",
      plugin=True,
      build=lambda w: _r(_t(w), None, {"weekNumber": 1, "floor": "M10S",
                                       "materialType": "glaze",
                                       "recipientPlayerId": w.my_card.id,
                                       "method": "purchase"})),
    R("POST", T + "/material-log", "lead", "inline",
      "log a material drop (or anyone else's purchase)", variant="drop", actor="lead",
      plugin=True,
      build=lambda w: _r(_t(w), None, {"weekNumber": 1, "floor": "M10S",
                                       "materialType": "glaze",
                                       "recipientPlayerId": w.card["open"].id,
                                       "method": "drop"})),
    R("PUT", T + "/material-log/{entry_id}", "lead", "helper", "edit a material entry",
      build=lambda w: _r(_t(w, entry_id=str(w.material.id)), None, {"notes": "edited"})),
    R("DELETE", T + "/material-log/{entry_id}", "lead", "helper", "delete a material entry",
      build=lambda w: _r(_t(w, entry_id=str(w.material.id)))),
    R("POST", T + "/mark-floor-cleared", "lead", "helper", "credit pages for a cleared floor",
      plugin=True, actor="lead",
      build=lambda w: _r(_t(w), None, {"weekNumber": 1, "floor": "M9S",
                                       "playerIds": [w.card["open"].id]})),
    R("POST", T + "/page-ledger", "lead", "helper", "add a page ledger entry",
      build=lambda w: _r(_t(w), None, {"playerId": w.card["open"].id, "weekNumber": 1,
                                       "floor": "M9S", "bookType": "I",
                                       "transactionType": "earned", "quantity": 1})),
    R("DELETE", T + "/page-ledger/week/{week}", "lead", "helper", "clear a week's page ledger",
      build=lambda w: _r(_t(w, week="1"))),
    R("DELETE", P + "/page-ledger", "lead", "helper", "clear a card's page ledger",
      build=lambda w: _r(_card(w, w.card["open"]))),
    R("POST", T + "/start-next-week", "lead", "helper", "advance the tier a week",
      build=lambda w: _r(_t(w))),
    R("POST", T + "/revert-week", "lead", "helper", "step the tier back a week",
      build=lambda w: _r(_t(w))),

    # ── schedule ────────────────────────────────────────────────────────────
    R("PUT", G + "/availability", "member", "inline",
      "submit your own availability for a date", actor="member",
      build=lambda w: _r(_g(w), None, {"date": w.future_date, "slots": ["18:00"]})),
    R("PUT", G + "/availability/template", "member", "inline",
      "submit your own weekly availability template", actor="member",
      build=lambda w: _r(_g(w), None, {"dayOfWeek": "MO", "slots": ["18:00"]})),
    R("POST", G + "/schedule", "lead", "helper", "schedule a session",
      build=lambda w: _r(_g(w), None, {"title": "Prog", "startTime": w.future_start,
                                       "endTime": w.future_end, "timezone": "UTC"})),
    R("PUT", SCHED, "lead", "helper", "edit a session",
      build=lambda w: _r(_sched(w), None, {"title": "Renamed Session"})),
    R("DELETE", SCHED, "lead", "helper", "delete a session", build=lambda w: _r(_sched(w))),
    R("POST", SCHED + "/exceptions", "lead", "helper", "cancel or edit one occurrence",
      build=lambda w: _r(_sched(w), None, {"occurrenceDate": w.future_date,
                                           "type": "cancelled"})),
    R("DELETE", SCHED + "/exceptions/{occurrence_date}", "lead", "helper",
      "restore one occurrence",
      build=lambda w: _r(_sched(w, occurrence_date=w.exception_date))),
    R("POST", SCHED + "/rsvp", "member", "inline", "RSVP to a session", actor="member",
      build=lambda w: _r(_sched(w), None, {"status": "available"})),
    R("POST", SCHED + "/sync-discord", "lead", "helper", "mirror one session to Discord",
      build=lambda w: _r(_sched(w))),
    R("POST", G + "/schedule/sync-discord", "lead", "helper", "mirror all sessions to Discord",
      build=lambda w: _r(_g(w))),
    R("POST", G + "/schedule-discord/install-claim", "lead", "helper",
      "start linking a Discord server", build=lambda w: _r(_g(w))),
    R("DELETE", G + "/schedule-discord/link", "lead", "helper",
      "disconnect the Discord server", build=lambda w: _r(_g(w))),
    R("PUT", SCH + "/settings", "lead", "helper", "edit reminder and webhook settings",
      build=lambda w: _r(_g(w), None, {"reminderChannelLabel": "raid-night"})),
    R("POST", SCH + "/settings/test-reminder", "lead", "helper",
      "send a test reminder to the webhook", build=lambda w: _r(_g(w))),
    R("POST", SCH + "/settings/post-session-preview", "lead", "helper",
      "post the next session to the webhook", build=lambda w: _r(_g(w))),
    R("POST", SCH + "/calendar/regenerate", "lead", "helper",
      "issue a new calendar feed token", build=lambda w: _r(_g(w))),
    R("POST", SCH + "/calendar/revoke", "lead", "helper", "revoke the calendar feed token",
      build=lambda w: _r(_g(w))),

    # ── farm (collection) goals ─────────────────────────────────────────────
    R("POST", CG, "lead", "helper", "create a farm goal",
      build=lambda w: _r(_g(w), None, {"goal_type": "mount", "title": "New Farm"})),
    R("POST", CG + "/from-suggestion", "lead", "helper",
      "create a farm goal from a catalog item",
      build=lambda w: _r(_g(w), None, {"catalog_item_id": w.catalog_item.id})),
    R("PUT", CG + "/{goal_id}", "lead", "helper", "edit a farm goal",
      build=lambda w: _r(_goal(w), None, {"title": "Renamed Farm"})),
    R("DELETE", CG + "/{goal_id}", "lead", "helper", "delete a farm goal",
      build=lambda w: _r(_goal(w))),
    R("POST", CG + "/{goal_id}/drops", "member", "inline",
      "log a farm drop for yourself (SEC-1)", variant="self", actor="member",
      build=lambda w: _r(_goal(w), None, {"recipient_user_id": w.me.id})),
    R("POST", CG + "/{goal_id}/drops", "lead", "inline",
      "log a farm drop for another member (SEC-1)", variant="other",
      build=lambda w: _r(_goal(w), None, {"recipient_user_id": w.u["member2"].id})),
    R("DELETE", CG + "/{goal_id}/drops/{drop_id}", "member", "inline",
      "delete a drop you logged (SEC-1)", variant="own", actor="member",
      build=lambda w: _r(_goal(w, drop_id=w.my_drop.id))),
    R("DELETE", CG + "/{goal_id}/drops/{drop_id}", "lead", "inline",
      "delete a drop someone else logged (SEC-1)", variant="other",
      build=lambda w: _r(_goal(w, drop_id=w.drop["member2"].id))),
    R("PATCH", CG + "/{goal_id}/participants", "member", "inline",
      "set your own need/want/have state (SEC-1)", actor="member",
      build=lambda w: _r(_goal(w), None, {"state": "want"})),
    R("PATCH", CG + "/{goal_id}/participants/{target_user_id}", "lead", "helper",
      "set another member's farm state",
      build=lambda w: _r(_goal(w, target_user_id=w.u["member2"].id), None, {"state": "want"})),

    # ── content suggestions (viewers may suggest and vote: HS-35 #2 (a)) ───
    R("POST", CS, "viewer", "helper", "suggest content (any role, HS-35 #2 (a))",
      actor="viewer",
      build=lambda w: _r(_g(w), None, {"category": "custom", "title": "Try an ultimate"})),
    R("PATCH", CS + "/{suggestion_id}", "viewer", "inline",
      "edit your own suggestion (part of suggesting)", variant="own", actor="viewer",
      build=lambda w: _r(_g(w, suggestion_id=w.my_suggestion.id), None,
                         {"title": "Edited idea"})),
    R("PATCH", CS + "/{suggestion_id}", "lead", "inline", "edit someone else's suggestion",
      variant="other",
      build=lambda w: _r(_g(w, suggestion_id=w.suggestion["member2"].id), None,
                         {"title": "Edited idea"})),
    R("DELETE", CS + "/{suggestion_id}", "viewer", "inline",
      "delete your own suggestion (part of suggesting)", variant="own", actor="viewer",
      build=lambda w: _r(_g(w, suggestion_id=w.my_suggestion.id))),
    R("DELETE", CS + "/{suggestion_id}", "lead", "inline", "delete someone else's suggestion",
      variant="other",
      build=lambda w: _r(_g(w, suggestion_id=w.suggestion["member2"].id))),
    R("POST", CS + "/{suggestion_id}/promote", "lead", "helper",
      "promote a suggestion to an objective",
      build=lambda w: _r(_g(w, suggestion_id=w.suggestion["member2"].id), None,
                         {"priority": "preferred"})),
    R("PUT", CS + "/{suggestion_id}/vote", "viewer", "helper",
      "vote on a suggestion (any role, HS-35 #2 (a))", actor="viewer",
      build=lambda w: _r(_g(w, suggestion_id=w.suggestion["member2"].id), None,
                         {"vote": "want"})),
    R("DELETE", CS + "/{suggestion_id}/vote", "viewer", "helper",
      "withdraw your vote (any role, HS-35 #2 (a))", actor="viewer",
      build=lambda w: _r(_g(w, suggestion_id=w.suggestion["member2"].id))),

    # ── objectives ──────────────────────────────────────────────────────────
    R("POST", OBJ, "lead", "helper", "add a static objective",
      build=lambda w: _r(_g(w), None, {"category": "custom", "title": "Clear FRU",
                                       "priority": "preferred"})),
    R("PATCH", OBJ + "/{goal_id}", "lead", "helper", "edit a static objective",
      build=lambda w: _r(_g(w, goal_id=w.objective.id), None, {"title": "Renamed Objective"})),
    R("DELETE", OBJ + "/{goal_id}", "lead", "helper", "delete a static objective",
      build=lambda w: _r(_g(w, goal_id=w.objective.id))),

    # ── mount farms ─────────────────────────────────────────────────────────
    R("PATCH", MF, "member", "inline", "track your own mount farm progress", variant="self",
      actor="member",
      build=lambda w: _r(_g(w), None, {"trialId": TRIAL_ID, "totemCount": 3})),
    R("PATCH", MF, "lead", "inline", "track another member's mount progress", variant="other",
      build=lambda w: _r(_g(w), None, {"trialId": TRIAL_ID, "userId": w.u["member2"].id,
                                       "totemCount": 3})),
    R("PUT", MF + "/bulk", "lead", "helper", "bulk-edit mount progress",
      build=lambda w: _r(_g(w), None, {"updates": [{"trialId": TRIAL_ID, "totemCount": 1,
                                                    "userId": w.u["member2"].id}]})),

    # ── split clears ────────────────────────────────────────────────────────
    R("POST", SC + "/mark-run-cleared", "member", "helper",
      "mark a split run cleared (R-P0-6)", plugin=True, actor="member",
      build=lambda w: _r(_g(w), None, {"run": "A"})),
    R("POST", SC + "/reset-week", "lead", "helper", "reset the split-clear week",
      build=lambda w: _r(_g(w))),
    R("PUT", SC + "/settings", "lead", "helper", "turn split-clear mode on or off",
      build=lambda w: _r(_g(w), None, {"enabled": True})),
    R("PATCH", SC + "/{player_id}", "lead", "helper", "edit a card's split-clear plan",
      build=lambda w: _r(_g(w, player_id=w.card["open"].id), None, {"notes": "alt on B"})),

    # ── character registrations ─────────────────────────────────────────────
    R("POST", REG, "member", "inline", "register a character on your own card",
      variant="own", actor="member",
      build=lambda w: _r(_g(w), None, {"snapshotPlayerId": w.my_card.id,
                                       "manualCharacterName": "Alt One"})),
    R("POST", REG, "lead", "inline", "register a character on someone else's card",
      variant="other",
      build=lambda w: _r(_g(w), None, {"snapshotPlayerId": w.card["open"].id,
                                       "manualCharacterName": "Alt One"})),
    R("PATCH", REG + "/{reg_id}", "member", "inline", "edit a registration on your own card",
      variant="own", actor="member",
      build=lambda w: _r(_g(w, reg_id=w.my_reg.id), None, {"job": "DRG"})),
    R("PATCH", REG + "/{reg_id}", "lead", "inline",
      "edit a registration on someone else's card", variant="other",
      build=lambda w: _r(_g(w, reg_id=w.reg["open"].id), None, {"job": "DRG"})),
    R("DELETE", REG + "/{reg_id}", "member", "inline",
      "delete a registration on your own card", variant="own", actor="member",
      build=lambda w: _r(_g(w, reg_id=w.my_reg.id))),
    R("DELETE", REG + "/{reg_id}", "lead", "inline",
      "delete a registration on someone else's card", variant="other",
      build=lambda w: _r(_g(w, reg_id=w.reg["open"].id))),
    R("POST", REG + "/{reg_id}/set-primary", "member", "inline",
      "make a registration primary on your own card", variant="own", actor="member",
      build=lambda w: _r(_g(w, reg_id=w.my_reg.id))),
    R("POST", REG + "/{reg_id}/set-primary", "lead", "inline",
      "make a registration primary on someone else's card", variant="other",
      build=lambda w: _r(_g(w, reg_id=w.reg["open"].id))),

    # ── Lodestone ───────────────────────────────────────────────────────────
    R("POST", LODE + "/identity/{group_id}/{player_id}", "member", "inline",
      "link a Lodestone identity to your own card", variant="own", actor="member",
      build=lambda w: _r(_lode(w, w.my_card), {"lodestone_id": 12345})),
    R("POST", LODE + "/identity/{group_id}/{player_id}", "lead", "inline",
      "link a Lodestone identity to someone else's card", variant="other",
      build=lambda w: _r(_lode(w, w.card["open"]), {"lodestone_id": 12345})),
    R("POST", LODE + "/sync/{group_id}/{player_id}", "member", "inline",
      "sync your own card's gear from Lodestone", variant="own", actor="member",
      build=lambda w: _r(_lode(w, w.my_card))),
    R("POST", LODE + "/sync/{group_id}/{player_id}", "lead", "inline",
      "sync someone else's gear from Lodestone", variant="other",
      build=lambda w: _r(_lode(w, w.card["open"]))),
)
# fmt: on

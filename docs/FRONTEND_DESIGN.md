# Naija Pulse frontend design

## Product feeling

The interface should feel like a calm, trustworthy neighborhood safety tool. It should be quick to scan under pressure, friendly for first-time reporters, and transparent about uncertainty. The visual language uses the existing green identity, soft neutral surfaces, high contrast status colors, and the current light/dark theme support.

The UI should communicate three things at a glance:

1. What is happening near me?
2. How recent and well-supported is it?
3. What can I do next?

## Primary navigation

Keep five persistent mobile actions and a desktop sidebar:

| Destination | Job | Primary action |
| --- | --- | --- |
| Home | Understand the current situation | Open nearby incidents |
| Map | Explore location and filters | Select an incident or area |
| Report | Submit evidence quickly | Report incident |
| Route | Check a planned journey | Scan route |
| Alerts | Manage saved areas and notifications | Add monitor |

Pulse AI and Agency should remain secondary destinations. Pulse AI belongs in the assistant entry point and More menu; Agency belongs behind a role-aware workspace rather than competing with citizen navigation.

## Home screen

The home screen should become a decision dashboard instead of a statistics dashboard.

```text
┌─────────────────────────────────────┐
│ Naija Pulse        Live / Offline   │
├─────────────────────────────────────┤
│ Near you                            │
│ [Use my location]  [Choose area]    │
│                                     │
│ 2 active incidents · updated 3m ago │
│                                     │
│ [Incident card]                     │
│ Flood · Ikeja                       │
│ 12 min ago · 4 reports · 82% signal │
│ [View map] [Verify]                 │
│                                     │
│ Quick actions                       │
│ [Report] [Check route] [Set alert]   │
│                                     │
│ Latest across Nigeria               │
│ compact incident list               │
└─────────────────────────────────────┘
```

The current hero banner and KPI row can remain for the desktop experience, but the first mobile viewport should prioritize nearby incidents and action buttons. Nationwide totals belong below the first decision area.

## Incident card

Every incident card should use the same information order:

1. Category and severity.
2. Plain-language title and area.
3. Freshness: observed time and last update.
4. Evidence: report count, confirms, disputes, and source type.
5. Confidence explanation: “82% signal · 4 nearby reports” rather than only “82% trust”.
6. One obvious next action: view, verify, or report an update.

Avoid making a large percentage the visual focus. Users should be able to tell whether a score is high because of many recent nearby reports or because of an old historical prior.

## Map screen

The map remains the main exploration surface, with a clear layered layout:

```text
┌─────────────────────────────────────┐
│ Search area                 locate  │
│ [All] [Flood] [Security] [Power]    │
│                                     │
│              map                    │
│       incident pins / H3 cells      │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 3 incidents in this area        │ │
│ │ Swipe cards or tap a pin        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

On mobile, selecting a pin opens a bottom sheet with the incident card and evidence. On desktop, it opens a right-side detail panel. The map should never hide the selected incident’s freshness, provenance, or privacy precision.

## Report flow

Reporting should be a four-step sheet with progress:

1. What happened? Select category and add a short description.
2. Where? Use GPS, choose on map, or select an area manually.
3. When? Default to now, editable for a recent observation.
4. Send. Show privacy treatment, upload status, and retry behavior.

The confirmation state should say “Report received” even when offline, followed by “Waiting to sync” when it has not reached the backend. Never imply server receipt when only a local draft exists.

## Verification flow

Use a simple decision sheet:

```text
Have you personally seen this or are you nearby now?

[ Confirm ]  [ Dispute ]

Your location is used to weight this response and is not shown publicly.
```

After voting, show the score change, the vote weight category (`nearby`, `in area`, `far away`), and the updated evidence count. Do not expose unnecessary precision about the voter’s location.

## Route screen

Route checking should have three clear states:

- **Ready:** choose a saved route or draw/select a route.
- **Scanning:** show the corridor being checked and what data sources are included.
- **Result:** show a single overall rating, the reasons, affected sections, and safer next actions.

The result must distinguish live incidents from historical area risk. “Clear” should mean “no matching reports found in the selected window,” not “guaranteed safe.”

## Alerts screen

Use two tabs: `Inbox` and `Monitors`.

- Inbox groups alerts by place or route and shows why each alert fired.
- Monitors lists saved places/routes with an active toggle, radius/corridor size, and edit action.
- The empty state should lead directly to “Monitor this area” from the map.

## Agency workspace

Agency users need a separate operational layout:

- queue of unresolved high-priority incidents;
- map and list views with dispatch status;
- incident timeline and evidence ledger;
- dispatch and resolve actions with an audit note;
- filters by state, category, age, and confidence.

It should not share the citizen home screen’s visual hierarchy. The agency view is an operations console, not a marketing dashboard.

## Design tokens and component rules

Keep the current tokens in `frontend/src/index.css` as the source of truth. Add semantic states where needed:

- `fresh`, `aging`, `stale` for time freshness;
- `unconfirmed`, `active`, `disputed`, `resolved`, `expired` for incident state;
- `crowd`, `official`, `research`, `seed` for provenance.

Prefer existing `.card`, `.field`, `.btn`, `.chip`, and `.glass` primitives. New components should accept semantic props rather than hard-coding category colors. Every interactive control needs a visible focus state and a text label or accessible name.

## Responsive behavior

- Mobile: bottom navigation, bottom sheets, one-column cards, full-width primary actions.
- Tablet: map plus collapsible detail sheet, two-column home sections.
- Desktop: sidebar, map with right detail panel, dense agency tables only where appropriate.
- Offline: persistent mode banner, local draft queue, retry action, and timestamps for last successful sync.

## Frontend implementation sequence

1. Add shared `IncidentCard`, `EvidenceSummary`, `FreshnessLabel`, `SourceBadge`, and `StatusBadge` components.
2. Normalize incident data at the API boundary so every screen uses the same fields.
3. Refactor Home and IncidentDetailSheet to use the shared card contract.
4. Split `App.jsx` state into incident, route, alerts, and session controllers.
5. Rework the report flow around draft and sync states.
6. Apply the same evidence and freshness language to route and agency screens.


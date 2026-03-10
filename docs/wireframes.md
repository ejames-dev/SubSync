# Wireframe Notes
_V1 scope: responsive web + mobile surfaces (React/React Native or shared design system)_

## Dashboard (Web)

```
┌──────────────────────────────────────────────┐
│ Header                                       │
│  • Logo + App name                           │
│  • CTA: "Add Subscription"                   │
│  • Avatar → settings dropdown                │
├──────────────────────────────────────────────┤
│ KPI Strip (cards)                            │
│  [ Monthly Spend ] [ Upcoming Renewals ] [ Active Services ]
├──────────────────────────────────────────────┤
│ Upcoming Renewals timeline                   │
│  • Vertical list sorted by date              │
│  • Each row: service logo, plan, amount, due │
│  • Action chips: Snooze / Mark handled       │
├──────────────────────────────────────────────┤
│ Active Subscriptions grid                    │
│  • Cards w/ service logo, plan, amount       │
│  • Status badge (Active/Trial)               │
│  • Quick link: "View history"                │
├──────────────────────────────────────────────┤
│ Insights (optional future)                   │
│  • Spend by category chart                   │
└──────────────────────────────────────────────┘
```

### Detail Sidebar (Web)
- Slides in when user clicks a service card.
- Sections: Overview, Billing, History, Notes.
- Actions: Edit, Cancel reminder, Mark as canceled.

### Add Subscription Modal
- Tabs: `Auto-import (Connect)` vs `Manual Entry`.
- Auto-import wizard lists available integrations (Spotify, Google) with OAuth buttons.
- Manual form fields: service dropdown, plan, amount, billing cadence, next renewal, payment method, notes.

## Mobile App (React Native / PWA)

### Home Screen
```
┌──────────────────────────────┐
│ Header                       │
│  • Greeting + date           │
│  • Add button ("+")          │
├──────────┬───────────────────┤
│ KPI card │ Upcoming list     │
│ swipeable│ vertically scroll │
├──────────┴───────────────────┤
│ Active services list         │
│  • Row w/ logo, plan, amount │
│  • Tap → detail sheet        │
└──────────────────────────────┘
```

### Detail Sheet (Mobile)
- Half-height bottom sheet with quick stats and CTA buttons.
- Expand to full screen for history + notes.

### Notifications Tab
- List of alerts: renewal reminders, failed imports.
- Swipe actions to snooze/dismiss.

### Settings Tab
- Email forwarding instructions (unique address + clipboard copy button).
- Connected accounts list w/ re-auth option.
- Notification preferences (lead time slider, channels toggle).

## Design System Considerations
- **Grid:** 12-column on web, 4pt spacing on mobile.
- **Color coding:** assign brand colors per service; fallback to neutral palette for manual entries.
- **Icons:** Feather/Material icon set for actions (snooze, edit, reminder).
- **Typography:** Sans-serif (Inter) for clarity.

## Responsive Behavior
- KPI cards collapse into carousel < 768px.
- Timeline becomes accordion grouped by week on tablets.
- Add Subscription modal becomes full-screen wizard on small devices.

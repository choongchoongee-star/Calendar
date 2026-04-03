# Maintenance Report
Generated: 2026-04-03

---

## Item #3 — Early return blocks app init when Supabase client is null
**Status:** reported (ask_human — logic_change)
**File:** docs/script.js, line 750 (originally ~781 before edits)
**Priority:** qa

### What was found
Inside the `DOMContentLoaded` async handler, there is an early return guard:

```js
if (!DataManager.client) { return; }
```

This guard exists immediately before `DataManager.client.auth.onAuthStateChange(...)`, but it also skips everything below it — including:
- The session check (`DataManager.checkSession()`)
- The guest mode fallback (`DataManager.enableGuestMode()`)
- `initializeCalendar()`
- `checkInvite()`

In local development (when `config.js` has empty credentials), `DataManager.client` is `null`, so the app renders a completely blank unusable state rather than falling back to guest mode correctly.

### Suggested fix
Wrap only the auth-dependent code (onAuthStateChange + session check) in `if (DataManager.client)`, and unconditionally fall through to guest mode when there is no client:

```js
if (DataManager.client) {
    DataManager.client.auth.onAuthStateChange(async (event, session) => { ... });
    const session = await DataManager.checkSession();
    if (session) {
        // ... logged in path
    } else if (isRedirecting) {
        // ... redirect path
    } else {
        await DataManager.enableGuestMode();
        // ...
    }
} else {
    // No Supabase — go straight to guest mode
    await DataManager.enableGuestMode();
    loginModal.style.display = 'none';
    appContainer.style.filter = 'none';
    initializeCalendar();
    checkInvite();
}
```

### Why human review needed
This is a `logic_change` risk — the auth flow branching logic is core to the app's initialization. The fix requires carefully restructuring the if/else chain that controls `onAuthStateChange`, session checking, and guest mode. Getting this wrong could break the login flow on production.

---

## Item #5 — Holiday data hardcoded for 2026 only
**Status:** reported (ask_human — logic_change)
**File:** docs/script.js, lines 627–646 (approximately, in `getHolidaysForWeek()`)
**Priority:** qa

### What was found
The `getHolidaysForWeek()` function in `CalendarUtils` contains a hardcoded array of Korean public holidays with explicit `2026-` year prefixes. As a result:
- Holidays are **not shown** for 2025 (e.g., December 2025 shows no 성탄절)
- Holidays are **not shown** for 2027 and beyond (e.g., January 2027 신정 is missing)

### Suggested fix
Refactor `getHolidaysForWeek()` to generate holidays dynamically for any year. For fixed-date holidays (e.g., 신정 = Jan 1, 삼일절 = Mar 1), derive them from the year range of the query window. For lunar-calendar-based holidays (설날, 추석, 부처님 오신 날) that change each year, the most practical approach is to either:

1. Hardcode a multi-year table (e.g., 2024–2030), or
2. Use an external Korean holiday API.

Example approach for fixed holidays:
```js
getHolidaysForWeek(s, e) {
    const years = new Set();
    for (let d = new Date(s); d <= e; d.setFullYear(d.getFullYear() + 1)) {
        years.add(d.getFullYear());
    }
    const fixedHolidays = [];
    years.forEach(year => {
        fixedHolidays.push(
            { text: "신정", startDate: `${year}-01-01`, endDate: `${year}-01-01` },
            { text: "삼일절", startDate: `${year}-03-01`, endDate: `${year}-03-01` },
            // ... etc.
        );
    });
    // Lunar holidays still need manual year table
    return fixedHolidays.filter(h => ...);
}
```

### Why human review needed
This is a `logic_change` risk — implementing multi-year holiday support requires deciding between the static-table vs. API approach. Lunar calendar holidays (설날, 추석, 부처님 오신 날) don't have fixed Gregorian dates and would need a curated data source. The owner should confirm the preferred approach before implementation.

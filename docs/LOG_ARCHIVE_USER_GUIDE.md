# Log Entries & Archive System - User Guide

## Quick Start

### Viewing Today's Logs

1. Navigate to **Admin Dashboard** → **Log Entries**
2. See today's login activity in the main table
3. **Auto-refreshes** every 30 seconds

```
✓ Clean, focused view of current day activity
✓ Shows all active login sessions
✓ Select entries for archiving
```

---

### Viewing Past Logs

1. Click the **"Past Logs"** collapsible section
2. Adjust date range (default: last 30 days)
3. Click **"Apply Filter"** to load

```
📅 Default Range: 30 days ago → Yesterday
⚡ Loads on-demand for better performance
🔍 Searchable and filterable
```

---

### Archiving Logs

**Step-by-Step:**

1. **Select logs** via checkboxes (Today or Past sections)
2. Click **"Archive Selected (X)"** button
3. Review confirmation modal
4. Click **"Archive X Entries"**
5. ✅ Success toast confirms action

**Best Practices:**
- Archive logs older than 7 days for cleanup
- Use "Select all" for bulk operations
- Review selection count before confirming

---

### Viewing Archived Logs

1. Navigate to **Admin Dashboard** → **Archive**
2. Select **"Archived Logs"** tab
3. Browse logs grouped by archive date
4. Expand date groups to see details

**What You'll See:**
```
▼ Archived on January 25, 2026 at 3:45 PM (12 logs)
  ☑ Select entries to restore or delete
  
▼ Archived on January 24, 2026 at 5:00 PM (8 logs)
  ...
```

---

### Restoring Archived Logs

1. In the **Archive** → **"Archived Logs"** tab
2. Check boxes for logs to restore
3. Click **"Restore (X)"** button
4. Logs return to **Log Entries** page

**Use Cases:**
- Accidentally archived wrong logs
- Need to re-examine historical data
- Correcting user mistakes

---

## UI Features

### Today's Logs Section

| Feature | Description |
|---------|-------------|
| **Date Badge** | Shows current date prominently |
| **Entry Count** | Total logs for today (e.g., "15 entries") |
| **Select All** | Checkbox to select/deselect all |
| **Live Updates** | Auto-refreshes every 30 seconds |
| **Status Indicator** | Shows active vs logged-out sessions |

### Past Logs Section

| Feature | Description |
|---------|-------------|
| **Collapsible** | Hidden by default (click to expand) |
| **Date Range Filter** | Custom start/end dates |
| **Apply Button** | Explicitly load data |
| **Independent Selection** | Separate from Today's checkboxes |

### Archive Section

| Feature | Description |
|---------|-------------|
| **Date Grouping** | Accordion-style by archive date |
| **Batch Actions** | Restore or delete multiple at once |
| **Group Selection** | Select all in a date group |
| **Empty State** | Clear messaging when no archives |

---

## Tips & Tricks

### Performance Optimization
```
✓ Keep Today's view clean (< 100 entries)
✓ Archive weekly for best performance
✓ Use date filters to narrow Past searches
```

### Data Organization
```
✓ Archive by week (every Monday morning)
✓ Keep last 30 days in Past for quick access
✓ Use Archive for audit trails/compliance
```

### Workflow Examples

**Daily Cleanup:**
```
1. Open Log Entries
2. Expand Past Logs
3. Filter: 30 days ago → 7 days ago
4. Select all → Archive
5. Keep only last week active
```

**Monthly Audit:**
```
1. Go to Archive tab
2. Expand month's date groups
3. Export to PDF/CSV (future feature)
4. Store for compliance records
```

---

## Keyboard Shortcuts (Coming Soon)

| Shortcut | Action |
|----------|--------|
| `Ctrl+A` | Select all visible logs |
| `Ctrl+D` | Deselect all |
| `Escape` | Clear selection |
| `Ctrl+E` | Export selected |

---

## Troubleshooting

### "Archive button is disabled"
**Cause**: No logs selected  
**Fix**: Check at least 1 log entry

### "Past Logs shows 0 entries"
**Cause**: Date range has no data  
**Fix**: Adjust date range or check database

### "Today's Logs not updating"
**Cause**: Auto-refresh may be paused  
**Fix**: Refresh browser page manually

### "Cannot restore archived logs"
**Cause**: Restore button may be disabled  
**Fix**: Select logs in Archive view first

---

## Data Retention Policy

### Recommended Timeline:
```
Today's Logs:      Current day only
Past Logs:         Last 30 days (configurable)
Archive:           Unlimited retention
Database Cleanup:  Delete archives > 365 days (optional)
```

### Compliance Notes:
- Archived logs preserve original timestamps
- Tracks WHO archived and WHEN
- Restore capability for audits
- Export ready for external backup

---

## FAQ

**Q: Can I archive today's logs?**  
A: Yes, but typically you'd wait until the next day.

**Q: What happens to archived logs in the database?**  
A: They remain in the `login_logs` table with `is_archived = TRUE`.

**Q: Can I search within archived logs?**  
A: Not yet - coming in Phase 2. Currently browse by date groups.

**Q: Is there a limit to how many logs I can archive at once?**  
A: No hard limit, but recommend batches of 500 for performance.

**Q: Can I permanently delete logs?**  
A: Future feature. Currently archive is the safest deletion method.

---

## For Developers

### API Methods Used:
```typescript
GetTodayLogs()                           // Fetch current day
GetPastLogs(startDate, endDate)         // Fetch date range
ArchiveSelectedLogs(logIDs, userID)     // Archive batch
UnarchiveLogs(logIDs)                   // Restore from archive
GetArchivedLogs()                       // View all archived
```

### Component Tree:
```
<ViewLogs>
  ├─ <Card> Today's Logs
  │   └─ <Table> with checkboxes
  ├─ <Collapsible> Past Logs
  │   ├─ <DateRangeFilter>
  │   └─ <Card> with table
  └─ <ArchiveConfirmationModal>
  
<ArchiveManagement>
  └─ <ArchivedLogsView>
      └─ <Card> accordion groups
```

---

**Last Updated**: January 25, 2026  
**Version**: 1.0.0  
**Support**: See main documentation for technical details

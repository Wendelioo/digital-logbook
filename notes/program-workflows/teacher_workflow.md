# Teacher Workflow Diagram

```mermaid
flowchart TD
    A[Login] --> B[Teacher Dashboard]
    B --> C{Manage Classes & Attendance}
    C -->|Manage Classes| D[Create/Edit Class Schedule]
    C -->|Check Attendance| E[View & Analyze Attendance]
    C -->|Review Feedback| F[Assess Equipment Issues]
    C -->|Export Reports| G[Generate CSV/PDF Reports]
    C -->|Monitor Lab| H[View Lab Activity]
    D --> I{Continue?}
    E --> I
    F --> I
    G --> I
    H --> I
    I -->|Yes| C
    I -->|No| J[Logout]
    
    style A fill:#e1f5ff
    style B fill:#f8bbd0
    style J fill:#ffccbc
```

## Teacher Can:
- Create and manage class schedules
- View and analyze student attendance patterns
- Review and escalate equipment feedback
- Export attendance reports (CSV/PDF)
- Monitor lab activities and equipment status
- Manage class rosters

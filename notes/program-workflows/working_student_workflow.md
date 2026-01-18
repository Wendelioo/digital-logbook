# Working Student Workflow Diagram

```mermaid
flowchart TD
    A[Login] --> B[Working Student Dashboard]
    B --> C{Manage Lab Tasks}
    C -->|Monitor Lab| D[Track Lab Activity & Equipment]
    C -->|Check Attendance| E[Review Attendance Logs]
    C -->|Report Issues| F[Submit Equipment Problems]
    C -->|View Feedback| G[Track Maintenance Reports]
    D --> H{Continue?}
    E --> H
    F --> H
    G --> H
    H -->|Yes| C
    H -->|No| I[Logout]
    
    style A fill:#e1f5ff
    style B fill:#fff9c4
    style I fill:#ffccbc
```

## Working Student Can:
- Monitor lab activity and track students in real-time
- Review attendance logs and records
- Report equipment malfunctions and issues
- Track maintenance report status
- Oversee lab operations and compliance

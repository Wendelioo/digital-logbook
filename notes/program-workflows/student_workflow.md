# Student Workflow Diagram

```mermaid
flowchart TD
    A[Login] --> B[Student Dashboard]
    B --> C{What would you like to do?}
    C -->|View Attendance| D[Check Attendance History]
    C -->|Check Schedule| E[View Class Schedule]
    C -->|Report Issues| F[Submit Equipment Feedback]
    C -->|View Profile| G[See Personal Info]
    D --> H{Continue?}
    E --> H
    F --> H
    G --> H
    H -->|Yes| C
    H -->|No| I[Logout]
    
    style A fill:#e1f5ff
    style B fill:#c8e6c9
    style I fill:#ffccbc
```

## Student Can:
- View attendance history and participation records
- Check class schedules and upcoming sessions
- Submit equipment feedback for lab issues
- Access personal profile information

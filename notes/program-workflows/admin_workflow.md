# Admin Workflow Diagram

```mermaid
flowchart TD
    A[Login] --> B[Admin Dashboard]
    B --> C{System Management}
    C -->|Manage Users| D[Create, Edit, Lock Users & Bulk Import]
    C -->|View Reports| E[Generate System Reports]
    C -->|Manage Departments| F[Create Departments & Assign Users]
    C -->|Monitor System| G[View Logs & Track Activity]
    C -->|Equipment Feedback| H[Review & Assign Maintenance]
    C -->|System Settings| I[Configure System & Backup Data]
    D --> J{Continue?}
    E --> J
    F --> J
    G --> J
    H --> J
    I --> J
    J -->|Yes| C
    J -->|No| K[Logout]
    
    style A fill:#e1f5ff
    style B fill:#c8e6c9
    style K fill:#ffccbc
```

## Admin Can:
- Manage all users (create, edit, delete, lock/unlock)
- Bulk import users via CSV
- Generate system reports (attendance, feedback, login logs)
- Create and manage departments
- Monitor all system activity and login logs
- Review and assign equipment maintenance tasks
- Configure system settings and backup data

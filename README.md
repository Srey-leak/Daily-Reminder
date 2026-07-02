# My Planner 🌸

A personal task planner web app built with **ASP.NET Core Web API** + **HTML/CSS/JavaScript**.

## Features
- Login & personal profile setup
- Add, edit, delete, search tasks
- Priority levels: 🔥 High / 🌤️ Medium / 🌿 Low
- End date with Today / Week / Month / Year / All views
- Subtasks (nest tasks under a parent)
- Notes and file attachments
- Completed & Missed task tabs
- Logout

## Tech Stack
- **Backend:** ASP.NET Core 8, Entity Framework Core, SQLite
- **Frontend:** HTML, CSS, Vanilla JavaScript

## How to Run
```bash
dotnet restore
dotnet run
```
Open `http://localhost:5000` in your browser.

## Project Structure

MyPlanner/
├── Controllers/
│   └── TasksController.cs     ← REST API endpoints (CRUD, file upload)
├── Data/
│   └── AppDbContext.cs        ← Entity Framework Core database context
├── DTOs/
│   └── TaskDtos.cs            ← Request/response data shapes
├── Models/
│   └── PlannerTask.cs         ← Task model (self-referencing for subtasks)
├── wwwroot/
│   ├── index.html             ← Single-page frontend
│   ├── css/style.css          ← Pink/lavender cute theme
│   ├── js/app.js              ← All frontend logic (AJAX, filtering, rendering)
│   └── uploads/               ← Uploaded file attachments saved here
├── Program.cs                 ← App startup, DB init, middleware
├── appsettings.json           ← SQLite connection string
└── MyPlanner.csproj           ← Project dependencies
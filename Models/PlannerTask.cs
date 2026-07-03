namespace MyPlanner.Models
{
    public class PlannerTask
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = "Medium"; // "Low" | "Medium" | "High"

        // Stored as "YYYY-MM-DD" string — no timezone conversion issues ever
        public string? EndDate { get; set; }

        public bool IsCompleted { get; set; } = false;
        public string? Note { get; set; }
        public string? FileName { get; set; }
        public string? FilePath { get; set; }

        // Self-reference for subtasks
        public int? ParentId { get; set; }
        public PlannerTask? Parent { get; set; }
        public List<PlannerTask> Children { get; set; } = new();

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}

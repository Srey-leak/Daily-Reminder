using System.ComponentModel.DataAnnotations;

namespace MyPlanner.DTOs
{
    public class TaskCreateDto
    {
        [Required]
        [StringLength(500, MinimumLength = 1)]
        public string Description { get; set; } = string.Empty;

        public string Priority { get; set; } = "Medium";

        // "YYYY-MM-DD" string or null
        public string? EndDate { get; set; }

        public bool IsCompleted { get; set; } = false;
        public string? Note { get; set; }
        public int? ParentId { get; set; }
    }

    public class TaskUpdateDto : TaskCreateDto { }

    public class TaskReadDto
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public string Priority { get; set; } = "Medium";
        public string? EndDate { get; set; }
        public bool IsCompleted { get; set; }
        public string? Note { get; set; }
        public string? FileName { get; set; }
        public string? FilePath { get; set; }
        public int? ParentId { get; set; }
        public List<TaskReadDto> Children { get; set; } = new();
        public DateTime CreatedAt { get; set; }
    }
}

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MyPlanner.Data;
using MyPlanner.DTOs;
using MyPlanner.Models;

namespace MyPlanner.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TasksController : ControllerBase
    {
        private readonly AppDbContext _db;
        private readonly IWebHostEnvironment _env;

        public TasksController(AppDbContext db, IWebHostEnvironment env)
        {
            _db = db;
            _env = env;
        }

        // GET /api/tasks?search=xxx
        // Returns ALL top-level tasks with their children nested.
        // All filtering (date tabs, completed, missed) is done client-side
        // to avoid timezone bugs — the frontend uses YYYY-MM-DD string comparison.
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetAll([FromQuery] string? search)
        {
            var query = _db.Tasks
                .Include(t => t.Children)
                .Where(t => t.ParentId == null)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(t =>
                    t.Description.Contains(search) ||
                    (t.Note != null && t.Note.Contains(search)));
            }

            var tasks = await query
                .OrderByDescending(t => t.Priority)
                .ThenBy(t => t.EndDate)
                .ThenByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(tasks.Select(ToDto));
        }

        // GET /api/tasks/5
        [HttpGet("{id}")]
        public async Task<ActionResult<TaskReadDto>> GetOne(int id)
        {
            var task = await _db.Tasks
                .Include(t => t.Children)
                .FirstOrDefaultAsync(t => t.Id == id);

            if (task == null) return NotFound();
            return Ok(ToDto(task));
        }

        // GET /api/tasks/all-flat — returns ALL tasks flat (for completed/missed chips)
        [HttpGet("all-flat")]
        public async Task<ActionResult<IEnumerable<TaskReadDto>>> GetAllFlat([FromQuery] string? search)
        {
            var query = _db.Tasks.AsQueryable();

            if (!string.IsNullOrWhiteSpace(search))
                query = query.Where(t =>
                    t.Description.Contains(search) ||
                    (t.Note != null && t.Note.Contains(search)));

            var tasks = await query
                .OrderByDescending(t => t.CreatedAt)
                .ToListAsync();

            return Ok(tasks.Select(t => new TaskReadDto
            {
                Id = t.Id,
                Description = t.Description,
                Priority = t.Priority,
                EndDate = t.EndDate,
                IsCompleted = t.IsCompleted,
                Note = t.Note,
                FileName = t.FileName,
                FilePath = t.FilePath,
                ParentId = t.ParentId,
                CreatedAt = t.CreatedAt
            }));
        }

        // POST /api/tasks
        [HttpPost]
        public async Task<ActionResult<TaskReadDto>> Create(TaskCreateDto dto)
        {
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            if (dto.ParentId.HasValue && !await _db.Tasks.AnyAsync(t => t.Id == dto.ParentId))
                return BadRequest("Parent task not found.");

            var task = new PlannerTask
            {
                Description = dto.Description,
                Priority = dto.Priority,
                EndDate = dto.EndDate,
                IsCompleted = dto.IsCompleted,
                Note = dto.Note,
                ParentId = dto.ParentId
            };

            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();

            var created = await _db.Tasks.Include(t => t.Children).FirstAsync(t => t.Id == task.Id);
            return CreatedAtAction(nameof(GetOne), new { id = task.Id }, ToDto(created));
        }

        // PUT /api/tasks/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, TaskUpdateDto dto)
        {
            if (!ModelState.IsValid) return ValidationProblem(ModelState);

            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound();

            if (dto.ParentId.HasValue)
            {
                if (dto.ParentId == id) return BadRequest("A task cannot be its own parent.");
                if (!await _db.Tasks.AnyAsync(t => t.Id == dto.ParentId))
                    return BadRequest("Parent task not found.");
            }

            task.Description = dto.Description;
            task.Priority = dto.Priority;
            task.EndDate = dto.EndDate;
            task.IsCompleted = dto.IsCompleted;
            task.Note = dto.Note;
            task.ParentId = dto.ParentId;

            await _db.SaveChangesAsync();
            return NoContent();
        }

        // PATCH /api/tasks/5/complete
        [HttpPatch("{id}/complete")]
        public async Task<IActionResult> ToggleComplete(int id, [FromBody] bool isCompleted)
        {
            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound();
            task.IsCompleted = isCompleted;
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /api/tasks/5 — deletes task and all descendants
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound();

            await DeleteWithChildren(id);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        private async Task DeleteWithChildren(int id)
        {
            var children = await _db.Tasks.Where(t => t.ParentId == id).ToListAsync();
            foreach (var child in children)
                await DeleteWithChildren(child.Id);

            var task = await _db.Tasks.FindAsync(id);
            if (task != null) _db.Tasks.Remove(task);
        }

        // POST /api/tasks/5/attachment
        [HttpPost("{id}/attachment")]
        public async Task<IActionResult> Upload(int id, IFormFile file)
        {
            var task = await _db.Tasks.FindAsync(id);
            if (task == null) return NotFound();
            if (file == null || file.Length == 0) return BadRequest("No file.");
            if (file.Length > 10 * 1024 * 1024) return BadRequest("Max file size is 10 MB.");

            var dir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads");
            Directory.CreateDirectory(dir);

            var fileName = $"{Guid.NewGuid()}_{Path.GetFileName(file.FileName)}";
            using var stream = new FileStream(Path.Combine(dir, fileName), FileMode.Create);
            await file.CopyToAsync(stream);

            task.FileName = file.FileName;
            task.FilePath = $"/uploads/{fileName}";
            await _db.SaveChangesAsync();

            return Ok(new { fileName = task.FileName, filePath = task.FilePath });
        }

        private static TaskReadDto ToDto(PlannerTask t) => new()
        {
            Id = t.Id,
            Description = t.Description,
            Priority = t.Priority,
            EndDate = t.EndDate,
            IsCompleted = t.IsCompleted,
            Note = t.Note,
            FileName = t.FileName,
            FilePath = t.FilePath,
            ParentId = t.ParentId,
            Children = t.Children.Select(ToDto).ToList(),
            CreatedAt = t.CreatedAt
        };
    }
}

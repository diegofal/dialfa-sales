namespace Spisa.DataMigration;

public class MigrationResult
{
    public bool Success { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public TimeSpan Duration => EndTime - StartTime;
    public List<EntityMigrationResult> EntityResults { get; set; } = new();
    public List<string> Errors { get; set; } = new();
    public Dictionary<string, object> Metadata { get; set; } = new();
}

public class EntityMigrationResult
{
    public string EntityName { get; set; } = string.Empty;
    public int MigratedCount { get; set; }
    public int FailedCount { get; set; }
    public bool Success => FailedCount == 0;
    public TimeSpan Duration { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class ValidationResult
{
    public bool IsValid { get; set; }
    public List<string> Issues { get; set; } = new();
}


namespace Spisa.DataMigration.Services;

public interface IMigrationValidator
{
    Task<ValidationResult> ValidateLegacyDataAsync();
    Task<ValidationResult> ValidateMigratedDataAsync();
    Task<ValidationResult> ValidateReferentialIntegrityAsync();
    Task<ValidationResult> ValidateRecordCountsAsync();
}


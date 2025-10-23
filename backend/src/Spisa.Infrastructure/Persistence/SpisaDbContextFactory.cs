using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Spisa.Infrastructure.Persistence;

/// <summary>
/// Design-time factory for EF Core migrations
/// </summary>
public class SpisaDbContextFactory : IDesignTimeDbContextFactory<SpisaDbContext>
{
    public SpisaDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<SpisaDbContext>();

        // Default to local development connection string
        // This can be overridden with --connection parameter in dotnet ef commands
        var connectionString = args.Length > 0 && args[0].StartsWith("Host=")
            ? args[0]
            : "Host=localhost;Port=5432;Database=spisa;Username=spisa_user;Password=spisa_dev_password";

        optionsBuilder.UseNpgsql(connectionString, options =>
        {
            options.MigrationsAssembly(typeof(SpisaDbContext).Assembly.FullName);
            options.EnableRetryOnFailure(3);
        });

        return new SpisaDbContext(optionsBuilder.Options);
    }
}



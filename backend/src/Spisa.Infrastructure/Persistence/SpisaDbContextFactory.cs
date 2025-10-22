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

        // Default to Railway connection string
        // This can be overridden with --connection parameter in dotnet ef commands
        var connectionString = args.Length > 0 && args[0].StartsWith("Host=")
            ? args[0]
            : "Host=shinkansen.proxy.rlwy.net;Port=36395;Database=railway;Username=postgres;Password=diHwuLPimwutIwcvMUyvTnAqimEzKFZR;SSL Mode=Require;";

        optionsBuilder.UseNpgsql(connectionString, options =>
        {
            options.MigrationsAssembly(typeof(SpisaDbContext).Assembly.FullName);
            options.EnableRetryOnFailure(3);
        });

        return new SpisaDbContext(optionsBuilder.Options);
    }
}



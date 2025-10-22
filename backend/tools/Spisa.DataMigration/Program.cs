using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Spisa.DataMigration;
using Spisa.DataMigration.Services;
using Spectre.Console;

// ASCII Art Banner
AnsiConsole.Write(
    new FigletText("SPISA")
        .Centered()
        .Color(Color.Blue));

AnsiConsole.MarkupLine("[bold blue]Data Migration Tool v1.0[/]");
AnsiConsole.MarkupLine("[grey]Migrating from SQL Server to PostgreSQL[/]");
AnsiConsole.WriteLine();

// Build configuration
var environment = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") 
    ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") 
    ?? "Production";

var configuration = new ConfigurationBuilder()
    .SetBasePath(Directory.GetCurrentDirectory())
    .AddJsonFile("appsettings.json", optional: false)
    .AddJsonFile($"appsettings.{environment}.json", optional: true)
    .AddEnvironmentVariables()
    .Build();

// Setup dependency injection
var services = new ServiceCollection();

// Add logging
services.AddLogging(builder =>
{
    builder.AddConfiguration(configuration.GetSection("Logging"));
    builder.AddConsole();
});

// Register migration services
services.AddSingleton<IConfiguration>(configuration);
services.AddScoped<ILegacyDataReader, SqlServerDataReader>();
services.AddScoped<IModernDataWriter, PostgresDataWriter>();
services.AddScoped<IMigrationValidator, MigrationValidator>();
services.AddScoped<MigrationOrchestrator>();

var serviceProvider = services.BuildServiceProvider();

try
{
    // Get migration orchestrator
    var orchestrator = serviceProvider.GetRequiredService<MigrationOrchestrator>();
    
    // Show configuration
    var sqlServerConn = configuration["ConnectionStrings:SqlServer"];
    var postgresConn = configuration["ConnectionStrings:PostgreSQL"];
    
    var table = new Table()
        .Border(TableBorder.Rounded)
        .AddColumn("[yellow]Configuration[/]")
        .AddColumn("[green]Value[/]");
    
    table.AddRow("Source (SQL Server)", MaskConnectionString(sqlServerConn ?? ""));
    table.AddRow("Target (PostgreSQL)", MaskConnectionString(postgresConn ?? ""));
    table.AddRow("Batch Size", configuration["Migration:BatchSize"] ?? "1000");
    table.AddRow("Dry Run", configuration["Migration:DryRun"] ?? "false");
    
    AnsiConsole.Write(table);
    AnsiConsole.WriteLine();
    
    // Confirm execution (skip if --yes argument provided)
    if (!args.Contains("--yes") && !AnsiConsole.Confirm("[yellow]Proceed with migration?[/]", false))
    {
        AnsiConsole.MarkupLine("[red]Migration cancelled by user.[/]");
        return;
    }
    
    AnsiConsole.WriteLine();
    
    // Run migration
    var result = await AnsiConsole.Progress()
        .Columns(new ProgressColumn[]
        {
            new TaskDescriptionColumn(),
            new ProgressBarColumn(),
            new PercentageColumn(),
            new RemainingTimeColumn(),
            new SpinnerColumn(),
        })
        .StartAsync(async ctx =>
        {
            return await orchestrator.ExecuteMigration(ctx);
        });
    
    // Display results
    AnsiConsole.WriteLine();
    DisplayMigrationResults(result);
    
    // Generate report if configured
    if (configuration.GetValue<bool>("Migration:GenerateReport"))
    {
        AnsiConsole.MarkupLine("\n[blue]Generating migration report...[/]");
        var reportPath = await orchestrator.GenerateReport(result);
        AnsiConsole.MarkupLine($"[green]Report saved to: {reportPath}[/]");
    }
    
    AnsiConsole.MarkupLine(result.Success 
        ? "\n[bold green]✓ Migration completed successfully![/]" 
        : "\n[bold red]✗ Migration completed with errors. Check the report for details.[/]");
}
catch (Exception ex)
{
    AnsiConsole.WriteException(ex, ExceptionFormats.ShortenEverything);
    AnsiConsole.MarkupLine("[bold red]Migration failed![/]");
    Environment.Exit(1);
}

static string MaskConnectionString(string connectionString)
{
    // Mask password in connection string for display
    return System.Text.RegularExpressions.Regex.Replace(
        connectionString, 
        @"(Password|PWD)\s*=\s*[^;]+", 
        "$1=***", 
        System.Text.RegularExpressions.RegexOptions.IgnoreCase);
}

static void DisplayMigrationResults(MigrationResult result)
{
    var resultTable = new Table()
        .Border(TableBorder.Double)
        .BorderColor(result.Success ? Color.Green : Color.Red)
        .AddColumn("[bold]Entity[/]")
        .AddColumn("[bold]Migrated[/]")
        .AddColumn("[bold]Failed[/]")
        .AddColumn("[bold]Status[/]");
    
    foreach (var entity in result.EntityResults)
    {
        var status = entity.Success ? "[green]✓[/]" : "[red]✗[/]";
        resultTable.AddRow(
            entity.EntityName,
            entity.MigratedCount.ToString(),
            entity.FailedCount.ToString(),
            status
        );
    }
    
    AnsiConsole.Write(resultTable);
    
    if (result.Errors.Any())
    {
        AnsiConsole.WriteLine();
        AnsiConsole.MarkupLine($"[red]Total Errors: {result.Errors.Count}[/]");
        
        var errorPanel = new Panel(string.Join("\n", result.Errors.Take(5)))
        {
            Header = new PanelHeader("[red]Error Summary (first 5)[/]"),
            BorderStyle = new Style(Color.Red)
        };
        AnsiConsole.Write(errorPanel);
    }
}


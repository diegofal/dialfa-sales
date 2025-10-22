#!/usr/bin/env dotnet-script
#r "nuget: Npgsql, 8.0.5"

using Npgsql;
using System.IO;

Console.WriteLine("========================================");
Console.WriteLine("  Applying schema.sql to Railway");
Console.WriteLine("========================================");
Console.WriteLine();

var schemaFile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "..", "..", "..", "..", "database", "schema.sql");
Console.WriteLine($"Reading schema.sql from: {schemaFile}");

if (!File.Exists(schemaFile))
{
    Console.WriteLine($"ERROR: schema.sql not found at {schemaFile}");
    return 1;
}

var schemaSql = File.ReadAllText(schemaFile);
var connectionString = "Host=shinkansen.proxy.rlwy.net;Port=36395;Database=railway;Username=postgres;Password=diHwuLPimwutIwcvMUyvTnAqimEzKFZR;SSL Mode=Require;Trust Server Certificate=true;";

Console.WriteLine("Connecting to Railway...");
await using var conn = new NpgsqlConnection(connectionString);
await conn.OpenAsync();
Console.WriteLine("✓ Connected!");

Console.WriteLine("Executing schema.sql...");
await using var cmd = new NpgsqlCommand(schemaSql, conn);
await cmd.ExecuteNonQueryAsync();

Console.WriteLine("✓ Schema applied successfully!");
Console.WriteLine();
Console.WriteLine("========================================");
Console.WriteLine("  ✓ Railway schema created!");
Console.WriteLine("========================================");

return 0;


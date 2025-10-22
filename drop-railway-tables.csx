#r "nuget: Npgsql, 8.0.5"

using Npgsql;

var connectionString = "Host=shinkansen.proxy.rlwy.net;Port=36395;Database=railway;Username=postgres;Password=diHwuLPimwutIwcvMUyvTnAqimEzKFZR;SSL Mode=Require;Trust Server Certificate=true;";

Console.WriteLine("Dropping all tables from Railway PostgreSQL...");

using var conn = new NpgsqlConnection(connectionString);
await conn.OpenAsync();

var sql = @"
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
";

using var cmd = new NpgsqlCommand(sql, conn);
await cmd.ExecuteNonQueryAsync();

Console.WriteLine("✓ All tables dropped successfully!");







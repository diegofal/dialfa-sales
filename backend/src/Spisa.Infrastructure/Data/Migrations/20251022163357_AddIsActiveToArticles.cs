using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spisa.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIsActiveToArticles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "articles",
                type: "boolean",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "is_active",
                table: "articles");
        }
    }
}

using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spisa.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLegacyFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "special_discount_percent",
                table: "sales_orders",
                type: "numeric",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "cancellation_reason",
                table: "invoices",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "cancelled_at",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_cancelled",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_printed",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "printed_at",
                table: "invoices",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "usd_exchange_rate",
                table: "invoices",
                type: "numeric",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_active",
                table: "categories",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "cost_price",
                table: "articles",
                type: "numeric",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "special_discount_percent",
                table: "sales_orders");

            migrationBuilder.DropColumn(
                name: "cancellation_reason",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "cancelled_at",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "is_cancelled",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "is_printed",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "printed_at",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "usd_exchange_rate",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "is_active",
                table: "categories");

            migrationBuilder.DropColumn(
                name: "cost_price",
                table: "articles");
        }
    }
}

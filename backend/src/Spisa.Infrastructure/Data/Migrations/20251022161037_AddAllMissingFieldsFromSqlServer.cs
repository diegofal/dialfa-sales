using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Spisa.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAllMissingFieldsFromSqlServer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "f_k_invoices__sales_orders_sales_order_id",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "IX_invoices_sales_order_id",
                table: "invoices");

            migrationBuilder.AlterColumn<decimal>(
                name: "usd_exchange_rate",
                table: "invoices",
                type: "numeric(10,4)",
                precision: 10,
                scale: 4,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "total_amount",
                table: "invoices",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<decimal>(
                name: "tax_amount",
                table: "invoices",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<decimal>(
                name: "net_amount",
                table: "invoices",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric");

            migrationBuilder.AlterColumn<bool>(
                name: "is_printed",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AlterColumn<bool>(
                name: "is_cancelled",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "boolean");

            migrationBuilder.AlterColumn<string>(
                name: "invoice_number",
                table: "invoices",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text");

            migrationBuilder.AddColumn<bool>(
                name: "is_credit_note",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "is_quotation",
                table: "invoices",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "seller_id",
                table: "clients",
                type: "integer",
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "location",
                table: "articles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "cost_price",
                table: "articles",
                type: "numeric(18,4)",
                precision: 18,
                scale: 4,
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "display_order",
                table: "articles",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "historical_price1",
                table: "articles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "series",
                table: "articles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "size",
                table: "articles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "supplier_id",
                table: "articles",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "thickness",
                table: "articles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "type",
                table: "articles",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "weight_kg",
                table: "articles",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_invoices_invoice_date",
                table: "invoices",
                column: "invoice_date",
                filter: "deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_invoice_number",
                table: "invoices",
                column: "invoice_number",
                unique: true,
                filter: "deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_invoices_sales_order_id",
                table: "invoices",
                column: "sales_order_id",
                filter: "deleted_at IS NULL");

            migrationBuilder.AddForeignKey(
                name: "f_k_invoices__sales_orders_sales_order_id",
                table: "invoices",
                column: "sales_order_id",
                principalTable: "sales_orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "f_k_invoices__sales_orders_sales_order_id",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "IX_invoices_invoice_date",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "IX_invoices_invoice_number",
                table: "invoices");

            migrationBuilder.DropIndex(
                name: "IX_invoices_sales_order_id",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "is_credit_note",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "is_quotation",
                table: "invoices");

            migrationBuilder.DropColumn(
                name: "seller_id",
                table: "clients");

            migrationBuilder.DropColumn(
                name: "display_order",
                table: "articles");

            migrationBuilder.DropColumn(
                name: "historical_price1",
                table: "articles");

            migrationBuilder.DropColumn(
                name: "series",
                table: "articles");

            migrationBuilder.DropColumn(
                name: "size",
                table: "articles");

            migrationBuilder.DropColumn(
                name: "supplier_id",
                table: "articles");

            migrationBuilder.DropColumn(
                name: "thickness",
                table: "articles");

            migrationBuilder.DropColumn(
                name: "type",
                table: "articles");

            migrationBuilder.DropColumn(
                name: "weight_kg",
                table: "articles");

            migrationBuilder.AlterColumn<decimal>(
                name: "usd_exchange_rate",
                table: "invoices",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(10,4)",
                oldPrecision: 10,
                oldScale: 4,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "total_amount",
                table: "invoices",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,4)",
                oldPrecision: 18,
                oldScale: 4);

            migrationBuilder.AlterColumn<decimal>(
                name: "tax_amount",
                table: "invoices",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,4)",
                oldPrecision: 18,
                oldScale: 4);

            migrationBuilder.AlterColumn<decimal>(
                name: "net_amount",
                table: "invoices",
                type: "numeric",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,4)",
                oldPrecision: 18,
                oldScale: 4);

            migrationBuilder.AlterColumn<bool>(
                name: "is_printed",
                table: "invoices",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: false);

            migrationBuilder.AlterColumn<bool>(
                name: "is_cancelled",
                table: "invoices",
                type: "boolean",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "boolean",
                oldDefaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "invoice_number",
                table: "invoices",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            migrationBuilder.AlterColumn<string>(
                name: "location",
                table: "articles",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(200)",
                oldMaxLength: 200,
                oldNullable: true);

            migrationBuilder.AlterColumn<decimal>(
                name: "cost_price",
                table: "articles",
                type: "numeric",
                nullable: true,
                oldClrType: typeof(decimal),
                oldType: "numeric(18,4)",
                oldPrecision: 18,
                oldScale: 4,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_invoices_sales_order_id",
                table: "invoices",
                column: "sales_order_id");

            migrationBuilder.AddForeignKey(
                name: "f_k_invoices__sales_orders_sales_order_id",
                table: "invoices",
                column: "sales_order_id",
                principalTable: "sales_orders",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}

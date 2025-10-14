using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Spisa.Application.DTOs;
using Spisa.Application.Features.SalesOrders.Commands.CancelSalesOrder;
using Spisa.Application.Features.SalesOrders.Commands.CreateSalesOrder;
using Spisa.Application.Features.SalesOrders.Commands.DeleteSalesOrder;
using Spisa.Application.Features.SalesOrders.Commands.UpdateSalesOrder;
using Spisa.Application.Features.SalesOrders.Queries.GetAllSalesOrders;
using Spisa.Application.Features.SalesOrders.Queries.GetSalesOrderById;

namespace Spisa.WebApi.Controllers;

[Authorize]
[ApiController]
[Route("api/sales-orders")]
public class SalesOrdersController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<SalesOrdersController> _logger;

    public SalesOrdersController(IMediator mediator, ILogger<SalesOrdersController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Get all sales orders with optional filters, pagination, and sorting
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<SalesOrderListDto>>> GetAllSalesOrders(
        [FromQuery] long? clientId,
        [FromQuery] string? status,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] bool activeOnly = false,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false,
        [FromQuery] string? searchTerm = null)
    {
        try
        {
            var query = new GetAllSalesOrdersQuery
            {
                ClientId = clientId,
                Status = status,
                FromDate = fromDate,
                ToDate = toDate,
                ActiveOnly = activeOnly,
                PageNumber = pageNumber,
                PageSize = pageSize,
                SortBy = sortBy,
                SortDescending = sortDescending,
                SearchTerm = searchTerm
            };

            var pagedSalesOrders = await _mediator.Send(query);
            return Ok(pagedSalesOrders);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting all sales orders");
            return StatusCode(500, new { message = "An error occurred while retrieving sales orders" });
        }
    }

    /// <summary>
    /// Get sales order by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<ActionResult<SalesOrderDto>> GetSalesOrderById(long id)
    {
        try
        {
            var query = new GetSalesOrderByIdQuery { Id = id };
            var salesOrder = await _mediator.Send(query);

            if (salesOrder == null)
            {
                return NotFound(new { message = $"SalesOrder with ID {id} not found" });
            }

            return Ok(salesOrder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting sales order with ID {Id}", id);
            return StatusCode(500, new { message = "An error occurred while retrieving the sales order" });
        }
    }

    /// <summary>
    /// Create a new sales order
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<long>> CreateSalesOrder([FromBody] CreateSalesOrderRequest request)
    {
        try
        {
            var command = new CreateSalesOrderCommand
            {
                ClientId = request.ClientId,
                OrderDate = request.OrderDate,
                DeliveryDate = request.DeliveryDate,
                Notes = request.Notes,
                Items = request.Items.Select(i => new CreateSalesOrderItemCommand
                {
                    ArticleId = i.ArticleId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    DiscountPercent = i.DiscountPercent
                }).ToList()
            };

            var salesOrderId = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetSalesOrderById), new { id = salesOrderId }, new { id = salesOrderId });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid data when creating sales order");
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating sales order");
            return StatusCode(500, new { message = "An error occurred while creating the sales order" });
        }
    }

    /// <summary>
    /// Update an existing sales order
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateSalesOrder(long id, [FromBody] UpdateSalesOrderRequest request)
    {
        try
        {
            var command = new UpdateSalesOrderCommand
            {
                Id = id,
                OrderDate = request.OrderDate,
                DeliveryDate = request.DeliveryDate,
                Notes = request.Notes,
                Items = request.Items.Select(i => new UpdateSalesOrderItemCommand
                {
                    Id = i.Id,
                    ArticleId = i.ArticleId,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    DiscountPercent = i.DiscountPercent
                }).ToList()
            };

            await _mediator.Send(command);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Invalid data when updating sales order {Id}", id);
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Invalid operation when updating sales order {Id}", id);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating sales order {Id}", id);
            return StatusCode(500, new { message = "An error occurred while updating the sales order" });
        }
    }

    /// <summary>
    /// Cancel a sales order (change status to CANCELLED)
    /// </summary>
    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> CancelSalesOrder(long id)
    {
        try
        {
            var command = new CancelSalesOrderCommand { Id = id };
            await _mediator.Send(command);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Sales order {Id} not found", id);
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning(ex, "Cannot cancel sales order {Id}", id);
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cancelling sales order {Id}", id);
            return StatusCode(500, new { message = "An error occurred while cancelling the sales order" });
        }
    }

    /// <summary>
    /// Delete a sales order (soft delete)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSalesOrder(long id)
    {
        try
        {
            var command = new DeleteSalesOrderCommand { Id = id };
            await _mediator.Send(command);
            return NoContent();
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Sales order {Id} not found", id);
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting sales order {Id}", id);
            return StatusCode(500, new { message = "An error occurred while deleting the sales order" });
        }
    }
}


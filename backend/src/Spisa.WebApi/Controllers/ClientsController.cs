using MediatR;
using Microsoft.AspNetCore.Mvc;
using Spisa.Application.Features.Clients.Commands.CreateClient;
using Spisa.Application.Features.Clients.Commands.UpdateClient;
using Spisa.Application.Features.Clients.Commands.DeleteClient;
using Spisa.Application.Features.Clients.Queries.GetAllClients;
using Spisa.Application.Features.Clients.Queries.GetClientById;

namespace Spisa.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClientsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<ClientsController> _logger;

    public ClientsController(IMediator mediator, ILogger<ClientsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Get all clients with pagination and sorting
    /// </summary>
    /// <param name="activeOnly">Filter to return only active clients</param>
    /// <param name="pageNumber">Page number (default: 1)</param>
    /// <param name="pageSize">Page size (default: 10, max: 100)</param>
    /// <param name="sortBy">Property to sort by</param>
    /// <param name="sortDescending">Sort in descending order</param>
    /// <param name="searchTerm">Search term for filtering</param>
    /// <returns>Paged list of clients</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllClients(
        [FromQuery] bool activeOnly = false,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false,
        [FromQuery] string? searchTerm = null)
    {
        _logger.LogInformation("GET /api/clients - Page: {Page}, PageSize: {PageSize}", pageNumber, pageSize);

        var query = new GetAllClientsQuery
        {
            ActiveOnly = activeOnly,
            PageNumber = pageNumber,
            PageSize = pageSize,
            SortBy = sortBy,
            SortDescending = sortDescending,
            SearchTerm = searchTerm
        };
        
        var pagedClients = await _mediator.Send(query);

        return Ok(pagedClients);
    }

    /// <summary>
    /// Get client by ID
    /// </summary>
    /// <param name="id">Client ID</param>
    /// <returns>Client details</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetClientById(long id)
    {
        _logger.LogInformation("GET /api/clients/{ClientId}", id);

        var query = new GetClientByIdQuery(id);
        var client = await _mediator.Send(query);

        if (client == null)
        {
            _logger.LogWarning("Client {ClientId} not found", id);
            return NotFound(new { message = $"Client with ID {id} not found" });
        }

        return Ok(client);
    }

    /// <summary>
    /// Create a new client
    /// </summary>
    /// <param name="command">Client creation data</param>
    /// <returns>Created client</returns>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateClient([FromBody] CreateClientCommand command)
    {
        _logger.LogInformation("POST /api/clients - Creating client: {BusinessName}", command.BusinessName);

        try
        {
            var client = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetClientById), new { id = client.Id }, client);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Failed to create client: {Message}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update an existing client
    /// </summary>
    /// <param name="id">Client ID</param>
    /// <param name="command">Client update data</param>
    /// <returns>Updated client</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateClient(long id, [FromBody] UpdateClientCommand command)
    {
        if (id != command.Id)
        {
            return BadRequest(new { message = "El ID de la URL no coincide con el ID del cuerpo" });
        }

        _logger.LogInformation("PUT /api/clients/{ClientId}", id);

        try
        {
            var client = await _mediator.Send(command);
            return Ok(client);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning("Client {ClientId} not found", id);
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Failed to update client {ClientId}: {Message}", id, ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Delete a client (soft delete)
    /// </summary>
    /// <param name="id">Client ID</param>
    /// <returns>Success status</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteClient(long id)
    {
        _logger.LogInformation("DELETE /api/clients/{ClientId}", id);

        try
        {
            var command = new DeleteClientCommand(id);
            await _mediator.Send(command);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning("Client {ClientId} not found", id);
            return NotFound(new { message = ex.Message });
        }
    }
}


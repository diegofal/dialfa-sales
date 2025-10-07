using MediatR;
using Microsoft.AspNetCore.Mvc;
using Spisa.Application.Features.Categories.Commands.CreateCategory;
using Spisa.Application.Features.Categories.Commands.UpdateCategory;
using Spisa.Application.Features.Categories.Commands.DeleteCategory;
using Spisa.Application.Features.Categories.Queries.GetAllCategories;
using Spisa.Application.Features.Categories.Queries.GetCategoryById;

namespace Spisa.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class CategoriesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<CategoriesController> _logger;

    public CategoriesController(IMediator mediator, ILogger<CategoriesController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Get all categories
    /// </summary>
    /// <param name="activeOnly">Filter only active categories</param>
    /// <returns>List of categories</returns>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllCategories([FromQuery] bool activeOnly = false)
    {
        _logger.LogInformation("GET /api/categories - ActiveOnly: {ActiveOnly}", activeOnly);

        var query = new GetAllCategoriesQuery(activeOnly);
        var categories = await _mediator.Send(query);

        _logger.LogInformation("Retrieved {Count} categories", categories.Count);
        return Ok(categories);
    }

    /// <summary>
    /// Get category by ID
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <returns>Category details</returns>
    [HttpGet("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetCategoryById(long id)
    {
        _logger.LogInformation("GET /api/categories/{CategoryId}", id);

        try
        {
            var query = new GetCategoryByIdQuery(id);
            var category = await _mediator.Send(query);
            return Ok(category);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning("Category {CategoryId} not found", id);
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Create a new category
    /// </summary>
    /// <param name="command">Category creation data</param>
    /// <returns>Created category</returns>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryCommand command)
    {
        _logger.LogInformation("POST /api/categories - Creating category: {Name}", command.Name);

        try
        {
            var category = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetCategoryById), new { id = category.Id }, category);
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Failed to create category: {Message}", ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Update an existing category
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <param name="command">Category update data</param>
    /// <returns>Updated category</returns>
    [HttpPut("{id}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCategory(long id, [FromBody] UpdateCategoryCommand command)
    {
        if (id != command.Id)
        {
            return BadRequest(new { message = "El ID de la URL no coincide con el ID del cuerpo" });
        }

        _logger.LogInformation("PUT /api/categories/{CategoryId}", id);

        try
        {
            var category = await _mediator.Send(command);
            return Ok(category);
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning("Category {CategoryId} not found", id);
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            _logger.LogWarning("Failed to update category {CategoryId}: {Message}", id, ex.Message);
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Delete a category (soft delete)
    /// </summary>
    /// <param name="id">Category ID</param>
    /// <returns>Success status</returns>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteCategory(long id)
    {
        _logger.LogInformation("DELETE /api/categories/{CategoryId}", id);

        try
        {
            var command = new DeleteCategoryCommand(id);
            await _mediator.Send(command);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning("Category {CategoryId} not found", id);
            return NotFound(new { message = ex.Message });
        }
    }
}


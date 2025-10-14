using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Spisa.Application.Features.Articles.Commands.CreateArticle;
using Spisa.Application.Features.Articles.Commands.DeleteArticle;
using Spisa.Application.Features.Articles.Commands.UpdateArticle;
using Spisa.Application.Features.Articles.Queries.GetAllArticles;
using Spisa.Application.Features.Articles.Queries.GetArticleById;

namespace Spisa.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ArticlesController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<ArticlesController> _logger;

    public ArticlesController(IMediator mediator, ILogger<ArticlesController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    /// <summary>
    /// Get all articles with optional filters, pagination, and sorting
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAllArticles(
        [FromQuery] bool activeOnly = false,
        [FromQuery] bool? lowStockOnly = null,
        [FromQuery] long? categoryId = null,
        [FromQuery] string? searchTerm = null,
        [FromQuery] int pageNumber = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? sortBy = null,
        [FromQuery] bool sortDescending = false)
    {
        try
        {
            var query = new GetAllArticlesQuery
            {
                ActiveOnly = activeOnly,
                LowStockOnly = lowStockOnly,
                CategoryId = categoryId,
                SearchTerm = searchTerm,
                PageNumber = pageNumber,
                PageSize = pageSize,
                SortBy = sortBy,
                SortDescending = sortDescending
            };
            
            var pagedArticles = await _mediator.Send(query);
            return Ok(pagedArticles);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving articles");
            return StatusCode(500, new { message = "An error occurred while retrieving articles" });
        }
    }

    /// <summary>
    /// Get article by ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetArticleById(long id)
    {
        try
        {
            var query = new GetArticleByIdQuery(id);
            var article = await _mediator.Send(query);
            return Ok(article);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving article with ID {Id}", id);
            return StatusCode(500, new { message = "An error occurred while retrieving the article" });
        }
    }

    /// <summary>
    /// Create a new article
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateArticle([FromBody] CreateArticleCommand command)
    {
        try
        {
            var article = await _mediator.Send(command);
            return CreatedAtAction(nameof(GetArticleById), new { id = article.Id }, article);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating article");
            return StatusCode(500, new { message = "An error occurred while creating the article" });
        }
    }

    /// <summary>
    /// Update an existing article
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateArticle(long id, [FromBody] UpdateArticleCommand command)
    {
        if (id != command.Id)
        {
            return BadRequest(new { message = "ID mismatch" });
        }

        try
        {
            var article = await _mediator.Send(command);
            return Ok(article);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating article with ID {Id}", id);
            return StatusCode(500, new { message = "An error occurred while updating the article" });
        }
    }

    /// <summary>
    /// Delete an article (soft delete)
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteArticle(long id)
    {
        try
        {
            var command = new DeleteArticleCommand(id);
            await _mediator.Send(command);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting article with ID {Id}", id);
            return StatusCode(500, new { message = "An error occurred while deleting the article" });
        }
    }
}





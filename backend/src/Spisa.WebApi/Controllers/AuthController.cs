using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Spisa.Application.DTOs;
using Spisa.Infrastructure.Identity;

namespace Spisa.WebApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IJwtTokenGenerator _tokenGenerator;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IJwtTokenGenerator tokenGenerator,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _tokenGenerator = tokenGenerator;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Login endpoint - Generate JWT token
    /// </summary>
    /// <param name="request">Login credentials</param>
    /// <returns>JWT token</returns>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(LoginResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        _logger.LogInformation("Login attempt for user: {Username}", request.Username);

        // TODO: Replace with actual database user validation
        // For now, hardcoded credentials for development
        if (request.Username == "admin" && request.Password == "admin123")
        {
            var token = _tokenGenerator.GenerateToken(request.Username, "ADMIN");
            var expirationMinutes = Convert.ToDouble(_configuration["JWT:ExpirationMinutes"] ?? "60");

            var response = new LoginResponse
            {
                Token = token,
                Username = request.Username,
                Role = "ADMIN",
                ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes)
            };

            _logger.LogInformation("Successful login for user: {Username}", request.Username);
            return Ok(response);
        }

        if (request.Username == "user" && request.Password == "user123")
        {
            var token = _tokenGenerator.GenerateToken(request.Username, "USER");
            var expirationMinutes = Convert.ToDouble(_configuration["JWT:ExpirationMinutes"] ?? "60");

            var response = new LoginResponse
            {
                Token = token,
                Username = request.Username,
                Role = "USER",
                ExpiresAt = DateTime.UtcNow.AddMinutes(expirationMinutes)
            };

            _logger.LogInformation("Successful login for user: {Username}", request.Username);
            return Ok(response);
        }

        _logger.LogWarning("Failed login attempt for user: {Username}", request.Username);
        return Unauthorized(new { message = "Usuario o contraseña incorrectos" });
    }

    /// <summary>
    /// Validate token endpoint - Check if current token is valid
    /// </summary>
    /// <returns>User information</returns>
    [HttpGet("validate")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Validate()
    {
        var username = User.Identity?.Name;
        var role = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role)?.Value;

        return Ok(new
        {
            username,
            role,
            isAuthenticated = true
        });
    }
}



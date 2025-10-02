using Spisa.Domain.Entities;

namespace Spisa.Domain.Interfaces;

/// <summary>
/// Repository interface for Client entity with specific business queries
/// </summary>
public interface IClientRepository : IRepository<Client>
{
    Task<Client?> GetByCodeAsync(string code, CancellationToken cancellationToken = default);
    Task<Client?> GetByCuitAsync(string cuit, CancellationToken cancellationToken = default);
    Task<IEnumerable<Client>> GetActiveClientsAsync(CancellationToken cancellationToken = default);
    Task<IEnumerable<Client>> SearchByNameAsync(string searchTerm, CancellationToken cancellationToken = default);
    Task<IEnumerable<Client>> GetClientsWithBalanceAsync(CancellationToken cancellationToken = default);
}


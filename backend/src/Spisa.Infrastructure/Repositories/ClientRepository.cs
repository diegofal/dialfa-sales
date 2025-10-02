using Microsoft.EntityFrameworkCore;
using Spisa.Domain.Entities;
using Spisa.Domain.Interfaces;
using Spisa.Infrastructure.Persistence;

namespace Spisa.Infrastructure.Repositories;

/// <summary>
/// Client repository implementation with specific business queries
/// </summary>
public class ClientRepository : Repository<Client>, IClientRepository
{
    public ClientRepository(SpisaDbContext context) : base(context)
    {
    }

    public async Task<Client?> GetByCodeAsync(string code, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.TaxCondition)
            .Include(c => c.Province)
            .Include(c => c.OperationType)
            .Include(c => c.Transporter)
            .FirstOrDefaultAsync(c => c.Code == code, cancellationToken);
    }

    public async Task<Client?> GetByCuitAsync(string cuit, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Include(c => c.TaxCondition)
            .Include(c => c.Province)
            .FirstOrDefaultAsync(c => c.Cuit == cuit, cancellationToken);
    }

    public async Task<IEnumerable<Client>> GetActiveClientsAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(c => c.IsActive)
            .Include(c => c.TaxCondition)
            .Include(c => c.Province)
            .OrderBy(c => c.BusinessName)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<Client>> SearchByNameAsync(string searchTerm, CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(c => EF.Functions.ILike(c.BusinessName, $"%{searchTerm}%"))
            .Include(c => c.TaxCondition)
            .Include(c => c.Province)
            .OrderBy(c => c.BusinessName)
            .Take(50)
            .ToListAsync(cancellationToken);
    }

    public async Task<IEnumerable<Client>> GetClientsWithBalanceAsync(CancellationToken cancellationToken = default)
    {
        return await _dbSet
            .Where(c => c.CurrentBalance != 0)
            .Include(c => c.TaxCondition)
            .Include(c => c.Province)
            .OrderByDescending(c => c.CurrentBalance)
            .ToListAsync(cancellationToken);
    }
}


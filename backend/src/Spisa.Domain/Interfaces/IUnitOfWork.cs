namespace Spisa.Domain.Interfaces;

/// <summary>
/// Unit of Work pattern for transaction management
/// </summary>
public interface IUnitOfWork : IDisposable
{
    IClientRepository Clients { get; }
    // Add other repositories here as needed
    // IArticleRepository Articles { get; }
    // ISalesOrderRepository SalesOrders { get; }
    
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
    Task BeginTransactionAsync(CancellationToken cancellationToken = default);
    Task CommitTransactionAsync(CancellationToken cancellationToken = default);
    Task RollbackTransactionAsync(CancellationToken cancellationToken = default);
}







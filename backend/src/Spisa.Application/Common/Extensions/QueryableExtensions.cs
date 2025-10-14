using System.Linq.Expressions;
using Spisa.Application.Common.Models;

namespace Spisa.Application.Common.Extensions;

public static class QueryableExtensions
{
    /// <summary>
    /// Apply pagination to a queryable
    /// </summary>
    public static IQueryable<T> ApplyPagination<T>(this IQueryable<T> query, PaginationParams pagination)
    {
        return query
            .Skip((pagination.PageNumber - 1) * pagination.PageSize)
            .Take(pagination.PageSize);
    }

    /// <summary>
    /// Apply sorting to a queryable
    /// </summary>
    public static IQueryable<T> ApplySorting<T>(this IQueryable<T> query, string? sortBy, bool descending = false)
    {
        if (string.IsNullOrWhiteSpace(sortBy))
            return query;

        var parameter = Expression.Parameter(typeof(T), "x");
        var property = typeof(T).GetProperty(sortBy);

        if (property == null)
            return query;

        var propertyAccess = Expression.MakeMemberAccess(parameter, property);
        var orderByExpression = Expression.Lambda(propertyAccess, parameter);

        var methodName = descending ? "OrderByDescending" : "OrderBy";
        var resultExpression = Expression.Call(
            typeof(Queryable),
            methodName,
            new[] { typeof(T), property.PropertyType },
            query.Expression,
            Expression.Quote(orderByExpression)
        );

        return query.Provider.CreateQuery<T>(resultExpression);
    }

    /// <summary>
    /// Create a paged result from a queryable
    /// </summary>
    public static async Task<PagedResult<T>> ToPagedResultAsync<T>(
        this IQueryable<T> query,
        PaginationParams pagination,
        CancellationToken cancellationToken = default)
    {
        var totalCount = query.Count();

        var items = query
            .ApplySorting(pagination.SortBy, pagination.SortDescending)
            .ApplyPagination(pagination)
            .ToList();

        return new PagedResult<T>(items, totalCount, pagination.PageNumber, pagination.PageSize);
    }
}


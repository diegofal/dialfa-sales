namespace Spisa.Application.DTOs
{
    public class CategoryDto
    {
        public long Id { get; set; }
        public string Code { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal DefaultDiscountPercent { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        // Statistics
        public int ArticlesCount { get; set; }
    }
}


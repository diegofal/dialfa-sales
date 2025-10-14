using AutoMapper;
using Spisa.Application.DTOs;
using Spisa.Domain.Entities;

namespace Spisa.Application.Mappings;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // Client mappings
        CreateMap<Client, ClientDto>()
            .ForMember(dest => dest.TaxConditionName, opt => opt.MapFrom(src => src.TaxCondition != null ? src.TaxCondition.Name : null))
            .ForMember(dest => dest.ProvinceName, opt => opt.MapFrom(src => src.Province != null ? src.Province.Name : null))
            .ForMember(dest => dest.OperationTypeName, opt => opt.MapFrom(src => src.OperationType != null ? src.OperationType.Name : null))
            .ForMember(dest => dest.TransporterName, opt => opt.MapFrom(src => src.Transporter != null ? src.Transporter.Name : null));

        // Category mappings
        CreateMap<Category, CategoryDto>()
            .ForMember(dest => dest.ArticlesCount, opt => opt.MapFrom(src => src.Articles.Count));

        // Article mappings
        CreateMap<Article, ArticleDto>()
            .ForMember(dest => dest.CategoryName, opt => opt.MapFrom(src => src.Category != null ? src.Category.Name : string.Empty))
            .ForMember(dest => dest.IsDeleted, opt => opt.MapFrom(src => src.DeletedAt != null));

        // Sales Order mappings
        CreateMap<SalesOrder, SalesOrderDto>()
            .ForMember(dest => dest.ClientBusinessName, opt => opt.MapFrom(src => src.Client != null ? src.Client.BusinessName : string.Empty))
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.Status.ToString()))
            .ForMember(dest => dest.ItemsCount, opt => opt.MapFrom(src => src.Items.Count))
            .ForMember(dest => dest.IsDeleted, opt => opt.MapFrom(src => src.DeletedAt != null));

        CreateMap<SalesOrder, SalesOrderListDto>()
            .ForMember(dest => dest.ClientBusinessName, opt => opt.MapFrom(src => src.Client != null ? src.Client.BusinessName : string.Empty))
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.Status.ToString()))
            .ForMember(dest => dest.ItemsCount, opt => opt.MapFrom(src => src.Items.Count));

        CreateMap<SalesOrderItem, SalesOrderItemDto>()
            .ForMember(dest => dest.ArticleCode, opt => opt.MapFrom(src => src.Article != null ? src.Article.Code : string.Empty))
            .ForMember(dest => dest.ArticleDescription, opt => opt.MapFrom(src => src.Article != null ? src.Article.Description : string.Empty));
    }
}







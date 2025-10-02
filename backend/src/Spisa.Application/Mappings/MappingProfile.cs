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
    }
}


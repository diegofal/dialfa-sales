import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

/**
 * GET /api/coladas
 * Search and list coladas with certificate counts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: Prisma.coladasWhereInput = {}

    if (search) {
      where.colada_number = {
        contains: search,
        mode: 'insensitive'
      }
    }

    // Get coladas with certificate count
    const [coladas, total] = await Promise.all([
      prisma.coladas.findMany({
        where,
        include: {
          _count: {
            select: {
              certificate_coladas: {
                where: {
                  certificate: {
                    deleted_at: null
                  }
                }
              }
            }
          }
        },
        skip,
        take: limit,
        orderBy: { colada_number: 'asc' }
      }),
      prisma.coladas.count({ where })
    ])

    return NextResponse.json({
      data: coladas.map(colada => ({
        id: colada.id.toString(),
        colada_number: colada.colada_number,
        description: colada.description,
        supplier: colada.supplier,
        material_type: colada.material_type,
        created_at: colada.created_at.toISOString(),
        updated_at: colada.updated_at.toISOString(),
        certificates_count: colada._count.certificate_coladas
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching coladas:', error)
    return NextResponse.json(
      { error: 'Failed to fetch coladas' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/coladas
 * Create a new colada
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { colada_number, description, supplier, material_type } = body

    if (!colada_number) {
      return NextResponse.json(
        { error: 'Colada number is required' },
        { status: 400 }
      )
    }

    // Check if colada already exists
    const existing = await prisma.coladas.findUnique({
      where: { colada_number: colada_number.toUpperCase() }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Colada already exists' },
        { status: 409 }
      )
    }

    const colada = await prisma.coladas.create({
      data: {
        colada_number: colada_number.toUpperCase(),
        description,
        supplier,
        material_type
      }
    })

    return NextResponse.json({
      id: colada.id.toString(),
      colada_number: colada.colada_number,
      description: colada.description,
      supplier: colada.supplier,
      material_type: colada.material_type,
      created_at: colada.created_at.toISOString(),
      updated_at: colada.updated_at.toISOString()
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating colada:', error)
    return NextResponse.json(
      { error: 'Failed to create colada' },
      { status: 500 }
    )
  }
}


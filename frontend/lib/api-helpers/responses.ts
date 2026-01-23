import { NextResponse } from 'next/server';

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function createdResponse<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function paginatedResponse<T>(data: {
  items: T[];
  total: number;
  page: number;
  limit: number;
}) {
  return NextResponse.json({
    data: data.items,
    pagination: {
      page: data.page,
      limit: data.limit,
      total: data.total,
      totalPages: Math.ceil(data.total / data.limit),
    },
  });
}

export function noContentResponse() {
  return new NextResponse(null, { status: 204 });
}

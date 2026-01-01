import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/roles';
import { BestflowExtractor } from '@/lib/services/proformaImport/bestflow-extractor';
import { ArticleMatcher } from '@/lib/services/proformaImport/article-matcher';
import { prisma } from '@/lib/db';
import { calculateSalesTrends } from '@/lib/services/salesTrends';
import { logActivity } from '@/lib/services/activityLogger';
import { OPERATIONS } from '@/lib/constants/operations';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith('.xls') && !file.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Only Excel files (.xls, .xlsx) are supported' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 5MB limit' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract data from proforma
    const extractor = new BestflowExtractor();
    const proformaData = await extractor.extract(buffer, file.name);

    if (proformaData.items.length === 0) {
      return NextResponse.json(
        { error: 'No items found in the proforma file' },
        { status: 400 }
      );
    }

    // Match items to articles in database
    const matcher = new ArticleMatcher(prisma);
    const matchedItems = await matcher.matchItems(proformaData.items);
    await matcher.cleanup();

    // Load sales trends for matched articles
    const matchedArticleIds = matchedItems
      .filter((m) => m.article !== null)
      .map((m) => m.article!.id.toString());

    let salesTrendsData: Map<string, number[]> | null = null;
    if (matchedArticleIds.length > 0) {
      const trendsResult = await calculateSalesTrends(12); // Last 12 months
      salesTrendsData = trendsResult.data;
    }

    // Enrich matched items with sales trends
    const enrichedItems = matchedItems.map((item) => {
      if (item.article && salesTrendsData) {
        const salesTrend = salesTrendsData.get(item.article.id.toString()) || [];
        return {
          ...item,
          article: {
            ...item.article,
            salesTrend,
          },
        };
      }
      return item;
    });

    // Calculate summary statistics
    const matched = enrichedItems.filter((m) => m.confidence >= 70).length;
    const needsReview = enrichedItems.filter(
      (m) => m.confidence >= 50 && m.confidence < 70
    ).length;
    const unmatched = enrichedItems.filter((m) => m.confidence < 50).length;

    // Log activity
    await logActivity({
      request,
      operation: OPERATIONS.SUPPLIER_ORDER_IMPORT,
      description: `Proforma importada: ${file.name} (${enrichedItems.length} artículos, ${matched} coincidencias)`,
      entityType: 'supplier_order',
      details: { 
        fileName: file.name,
        totalItems: enrichedItems.length,
        matched,
        needsReview,
        unmatched,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        proforma: proformaData.metadata,
        items: enrichedItems,
        summary: {
          total: enrichedItems.length,
          matched,
          needsReview,
          unmatched,
        },
      },
    });
  } catch (error) {
    console.error('Error importing proforma:', error);
    return NextResponse.json(
      {
        error: 'Failed to import proforma',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}


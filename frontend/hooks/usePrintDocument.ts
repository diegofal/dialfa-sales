import { useState } from 'react';

interface UsePrintDocumentReturn {
    isLoading: boolean;
    error: string | null;
    previewUrl: string | null;
    fetchPreview: (id: number) => Promise<void>;
    printDocument: (id: number) => Promise<void>;
    closePreview: () => void;
}

export function usePrintDocument(type: 'invoice' | 'delivery-note'): UsePrintDocumentReturn {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const fetchPreview = async (id: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const endpoint = type === 'invoice'
                ? `/api/invoices/${id}/preview-pdf`
                : `/api/delivery-notes/${id}/preview-pdf`;

            const response = await fetch(endpoint);

            if (!response.ok) {
                throw new Error('Failed to fetch preview');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const printDocument = async (id: number) => {
        setIsLoading(true);
        setError(null);
        try {
            const endpoint = type === 'invoice'
                ? `/api/invoices/${id}/print-pdf`
                : `/api/delivery-notes/${id}/print-pdf`;

            const response = await fetch(endpoint, {
                method: 'POST',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to print document');
            }

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            // Open in new window to trigger browser print dialog or just download
            // For a better UX, we might want to open it in an iframe and call print()
            const printWindow = window.open(url);
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.print();
                };
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const closePreview = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setError(null);
    };

    return {
        isLoading,
        error,
        previewUrl,
        fetchPreview,
        printDocument,
        closePreview,
    };
}

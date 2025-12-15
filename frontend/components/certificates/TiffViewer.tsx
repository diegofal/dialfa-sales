'use client';

import { useEffect, useRef, useState } from 'react';
import UTIF from 'utif2';
import { Loader2, AlertCircle } from 'lucide-react';

interface TiffViewerProps {
  url: string;
  alt: string;
  className?: string;
  onError?: () => void;
}

export function TiffViewer({ url, alt, className, onError }: TiffViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadTiff = async () => {
      if (!canvasRef.current) return;
      
      setIsLoading(true);
      setError(false);

      try {
        // Fetch the TIFF file
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load TIFF');
        
        const arrayBuffer = await response.arrayBuffer();
        
        // Parse TIFF with UTIF
        const ifds = UTIF.decode(arrayBuffer);
        if (!ifds || ifds.length === 0) throw new Error('No images in TIFF');
        
        // Decode the first page
        UTIF.decodeImage(arrayBuffer, ifds[0]);
        const rgba = UTIF.toRGBA8(ifds[0]);
        
        // Draw to canvas
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) throw new Error('Canvas context not available');
        
        const width = ifds[0].width;
        const height = ifds[0].height;
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        const imageData = ctx.createImageData(width, height);
        imageData.data.set(rgba);
        ctx.putImageData(imageData, 0, 0);
        
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading TIFF:', err);
        setError(true);
        setIsLoading(false);
        onError?.();
      }
    };

    loadTiff();
  }, [url, onError]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-destructive">
        <AlertCircle className="h-12 w-12 mb-2" />
        <p>Error al cargar imagen TIFF</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={className}
        style={{ 
          maxWidth: '100%', 
          height: 'auto',
          display: isLoading ? 'none' : 'block'
        }}
        aria-label={alt}
      />
    </div>
  );
}


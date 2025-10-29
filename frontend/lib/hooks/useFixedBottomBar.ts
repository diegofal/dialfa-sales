import { useState, useEffect, useCallback } from 'react';

/**
 * Hook that automatically detects if there's a fixed bottom bar in the page
 * and measures its height dynamically
 * 
 * This looks for elements with:
 * - position: fixed
 * - bottom: 0
 * - Full or most of the width
 * 
 * @returns {Object} Information about the bottom bar
 */
export function useFixedBottomBar() {
  const [bottomBarHeight, setBottomBarHeight] = useState(0);
  const [isDetecting, setIsDetecting] = useState(true);
  
  const detectBottomBar = useCallback(() => {
    try {
      // Find all fixed position elements
      const allElements = document.querySelectorAll('*');
      let detectedHeight = 0;
      let detectedElement: Element | null = null;

      allElements.forEach((element) => {
        const styles = window.getComputedStyle(element);
        
        // Check if element is fixed at the bottom
        if (
          styles.position === 'fixed' &&
          styles.bottom === '0px' &&
          styles.left === '0px' &&
          styles.right === '0px'
        ) {
          // This looks like a bottom bar
          const rect = element.getBoundingClientRect();
          
          // Only consider elements that span most of the width and have reasonable height
          if (rect.width > window.innerWidth * 0.8 && rect.height > 40 && rect.height < 200) {
            if (rect.height > detectedHeight) {
              detectedHeight = rect.height;
              detectedElement = element;
            }
          }
        }
      });

      const finalHeight = Math.round(detectedHeight);
      setBottomBarHeight(finalHeight);
      setIsDetecting(false);
      
      // Debug logging
      if (finalHeight > 0 && typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
        console.log('🎯 Fixed bottom bar detected:', {
          height: finalHeight,
          element: detectedElement,
        });
      }
    } catch (error) {
      console.error('Error detecting bottom bar:', error);
      setBottomBarHeight(0);
      setIsDetecting(false);
    }
  }, []);

  // Detect on mount and when DOM changes
  useEffect(() => {
    // Initial detection with small delay to ensure DOM is ready
    const initialTimer = setTimeout(() => {
      detectBottomBar();
    }, 100);

    // Re-detect after a bit more time in case of lazy-loaded content
    const secondTimer = setTimeout(() => {
      detectBottomBar();
    }, 500);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(secondTimer);
    };
  }, [detectBottomBar]);

  // Listen for resize events to recalculate
  useEffect(() => {
    const handleResize = () => {
      detectBottomBar();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [detectBottomBar]);

  // Use MutationObserver to detect DOM changes that might add/remove the bottom bar
  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      // Check if any mutation affected fixed positioning or bottom styles
      const shouldRedetect = mutations.some((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          return true;
        }
        if (mutation.type === 'attributes' && 
            (mutation.attributeName === 'style' || mutation.attributeName === 'class')) {
          return true;
        }
        return false;
      });

      if (shouldRedetect) {
        // Debounce: wait a bit before re-detecting
        setTimeout(detectBottomBar, 200);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    return () => observer.disconnect();
  }, [detectBottomBar]);

  return {
    bottomBarHeight,
    hasBottomBar: bottomBarHeight > 0,
    isDetecting,
  };
}

/**
 * Hook for window dimensions (for responsive calculations)
 */
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    function handleResize() {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Call once to set initial size

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return windowSize;
}


/**
 * Cart positioning and sizing constants
 */
export const CART_CONSTANTS = {
  // Cart button dimensions
  BUTTON: {
    SIZE: 56, // h-14 = 56px (3.5rem)
    MARGIN_NORMAL: 24, // bottom-6 right-6 = 1.5rem = 24px
    MARGIN_RIGHT: 24, // right-6 = 1.5rem = 24px
    Z_INDEX: 40,
  },

  // Popup dimensions and spacing
  POPUP: {
    GAP: 16, // Gap between button and popup
    WIDTH_NORMAL: 650,
    HEIGHT_NORMAL: 550, // Reduced from 750 to fit better in viewport
    MIN_WIDTH: 400,
    MIN_HEIGHT: 350, // Reduced from 400 to allow more flexibility
    Z_INDEX: 50,

    // Responsive breakpoints
    MOBILE_MAX_WIDTH: 640, // sm breakpoint
    TABLET_MAX_WIDTH: 1024, // lg breakpoint
  },

  // Edit dropdown
  EDIT_DROPDOWN: {
    GAP: 20, // Extra space above popup
    WIDTH: 380,
    MAX_HEIGHT: 280,
    Z_INDEX: 60,
  },

  // Default fallback if bottom bar detection fails
  FALLBACK: {
    BOTTOM_BAR_HEIGHT: 80, // Estimated height of fixed bottom button bar
  },
} as const;

/**
 * Calculate cart positions based on detected bottom bar height
 * @param bottomBarHeight - Height of the fixed bottom bar in pixels (0 if none)
 * @param windowWidth - Current window width for responsive calculations
 */
export function calculateCartPositions(bottomBarHeight: number, windowWidth?: number) {
  // Ensure we have valid numbers
  const safeBottomBarHeight =
    typeof bottomBarHeight === 'number' && !isNaN(bottomBarHeight) ? bottomBarHeight : 0;
  const safeWindowWidth =
    typeof windowWidth === 'number' && !isNaN(windowWidth) ? windowWidth : 1024;

  const isMobile = safeWindowWidth < CART_CONSTANTS.POPUP.MOBILE_MAX_WIDTH;
  const isTablet = safeWindowWidth < CART_CONSTANTS.POPUP.TABLET_MAX_WIDTH;

  // Calculate button position
  const buttonBottom =
    safeBottomBarHeight > 0
      ? safeBottomBarHeight + CART_CONSTANTS.BUTTON.MARGIN_NORMAL
      : CART_CONSTANTS.BUTTON.MARGIN_NORMAL;

  // Calculate popup position (above button with gap)
  const popupBottom = buttonBottom + CART_CONSTANTS.BUTTON.SIZE + CART_CONSTANTS.POPUP.GAP;

  // Calculate edit dropdown position (above popup)
  const editDropdownBottom = popupBottom + CART_CONSTANTS.EDIT_DROPDOWN.GAP;

  // Responsive adjustments
  const buttonRight = isMobile ? 16 : CART_CONSTANTS.BUTTON.MARGIN_RIGHT; // Closer to edge on mobile
  const popupRight = isMobile ? 8 : CART_CONSTANTS.BUTTON.MARGIN_RIGHT;
  const popupWidth = isMobile ? safeWindowWidth - 16 : CART_CONSTANTS.POPUP.WIDTH_NORMAL;
  const popupHeight = isMobile ? 450 : CART_CONSTANTS.POPUP.HEIGHT_NORMAL; // Reduced from 500 to 450 for mobile

  const result = {
    button: {
      bottom: buttonBottom,
      right: buttonRight,
      bottomClass: `bottom-[${buttonBottom}px]`,
      rightClass: `right-[${buttonRight}px]`,
    },
    popup: {
      bottom: popupBottom,
      right: popupRight,
      width: popupWidth,
      height: popupHeight,
      bottomClass: `bottom-[${popupBottom}px]`,
      rightClass: `right-[${popupRight}px]`,
    },
    editDropdown: {
      bottom: editDropdownBottom,
      right: popupRight + 24, // Slightly offset from popup
      bottomClass: `bottom-[${editDropdownBottom}px]`,
    },
    hasBottomBar: safeBottomBarHeight > 0,
    isMobile,
    isTablet,
  };

  return result;
}

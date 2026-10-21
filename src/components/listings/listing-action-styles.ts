// Action-row styling shared by the listing detail page and the details dialog: the global primary
// (#00BFFF) fails AA with white text (2.1:1). Brand navy #0F4C81 comes from the logo wordmark; white on it is 8.9:1.
export const ACTION_BASE =
  'h-auto min-h-11 rounded-lg px-3 sm:px-4 text-sm font-medium whitespace-normal text-center leading-tight sm:whitespace-nowrap transition-colors duration-150 [&_svg]:size-[18px] focus-visible:ring-[#0F4C81]';
export const ACTION_PRIMARY =
  'border-0 bg-[#0F4C81] text-white hover:bg-[#0A3D75] active:bg-[#08305c]';
export const ACTION_SECONDARY =
  'border border-[#0F4C81]/30 bg-white text-foreground hover:border-[#0F4C81]/50 hover:bg-[#0F4C81]/5 hover:text-foreground active:bg-[#0F4C81]/10 [&_svg]:text-[#0F4C81]';
export const ACTION_GHOST =
  'border-transparent bg-transparent text-[#0F4C81] hover:bg-[#0F4C81]/10 hover:text-[#0F4C81] active:bg-[#0F4C81]/15';
